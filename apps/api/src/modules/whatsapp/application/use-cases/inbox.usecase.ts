import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../../../core/errors/app.error';
import { normalizePhone } from '../../../../shared/utils/phone.util';
import { IWaProvider, WA_PROVIDER, WaIncomingMessage } from '../../domain/interfaces/wa-provider.interface';
import { ChatMessageRow, StudentContact, WaChatRepository } from '../../infrastructure/wa-chat.repository';
import { InboxMediaStore } from '../../infrastructure/inbox-media.store';

/** أكبر ملف بنحفظه من أولياء الأمور (فيديو كبير بيتسجّل من غير الملف) */
export const MAX_INBOX_MEDIA_BYTES = 16 * 1024 * 1024;
const MAX_REPLY_LENGTH = 4000;

export interface InboxStudent {
  id: string;
  fullName: string;
  studentCode: string | null;
  isActive: boolean;
  /** الرقم ده رقم ولي الأمر ولا رقم الطالب نفسه */
  relation: 'parent' | 'student';
}

export interface InboxConversation {
  phone: string;
  students: InboxStudent[];
  lastAt: string;
  lastDirection: 'in' | 'out';
  lastPreview: string;
  unread: number;
}

export type InboxThreadItem =
  | {
      kind: 'message';
      id: string;
      direction: 'in' | 'out';
      source: 'parent' | 'app' | 'phone';
      body: string;
      media: null | {
        type: string;
        mime: string | null;
        seconds: number | null;
        size: number | null;
        status: string | null;
      };
      status: 'pending' | 'sent' | 'failed';
      error: string | null;
      at: string;
    }
  | {
      kind: 'notification';
      id: string;
      templateKey: string | null;
      body: string;
      status: string;
      at: string;
    };

const MEDIA_LABELS: Record<string, string> = {
  audio: '🎤 رسالة صوتية', image: '📷 صورة', video: '🎬 فيديو',
  document: '📄 ملف', sticker: 'ملصق', unsupported: 'رسالة',
};

/** أسباب فشل الإرسال من الـ provider ← رسالة مفهومة للمدرس */
function sendErrorMessage(code?: string): string {
  switch (code) {
    case 'not_connected': return 'الواتساب مش متصل. وصّله من صفحة الواتساب وجرّب تاني.';
    case 'phone_not_on_whatsapp': return 'الرقم ده مش عليه واتساب.';
    case 'invalid_phone': return 'رقم التليفون غلط.';
    case 'circuit_open': return 'الإرسال واقف مؤقتاً بعد كذا فشل ورا بعض (حماية من الحظر). جرّب بعد شوية.';
    default: return code ? `الرسالة مااتبعتتش: ${code}` : 'الرسالة مااتبعتتش.';
  }
}

/**
 * صندوق وارد الواتساب (WA-110): المحادثات مع أولياء الأمور، والرد عليهم من البرنامج.
 * - الوارد: نص + فويس نوت + صور + فيديو + ملفات (بتتحفظ في InboxMediaStore).
 * - رد المدرس من موبايله بيظهر في المحادثة (source='phone').
 * - الإشعارات التلقائية (wa_messages_log) بتتعرض جوّه المحادثة كسياق.
 * - الرد بيعدّي من نفس طابور الإرسال المحمي من الحظر، بأولوية (مابيستناش الفاصل).
 */
@Injectable()
export class InboxUseCase {
  private readonly logger = new Logger(InboxUseCase.name);

  constructor(
    private readonly repo: WaChatRepository,
    private readonly media: InboxMediaStore,
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
  ) {}

  // ─── الوارد ─────────────────────────────────────────────────

  /** بيتنادى من BaileysProvider لكل رسالة جديدة (من ولي الأمر أو من موبايل المركز) */
  async recordIncoming(tenantId: string, msg: WaIncomingMessage): Promise<ChatMessageRow | null> {
    const phone = normalizePhone(msg.phone);
    if (!phone) return null;

    let mediaType: string | null = null;
    let mediaPath: string | null = null;
    let mediaStatus: string | null = null;
    if (msg.media) {
      mediaType = msg.media.type;
      if (msg.media.size && msg.media.size > MAX_INBOX_MEDIA_BYTES) {
        mediaStatus = 'too_large';
      } else {
        try {
          const buffer = await msg.media.download();
          if (buffer.length > MAX_INBOX_MEDIA_BYTES) {
            mediaStatus = 'too_large';
          } else {
            mediaPath = this.media.save(buffer, msg.media.mime, msg.media.fileName);
            mediaStatus = 'stored';
          }
        } catch (err: any) {
          this.logger.warn(`Inbox media download failed (${phone}): ${err?.message}`);
          mediaStatus = 'failed';
        }
      }
    } else if (msg.unsupportedType) {
      mediaType = 'unsupported';
      mediaStatus = 'unsupported';
    }

    if (!msg.body && !mediaType) return null;

    const row = await this.repo.insert(tenantId, {
      phone,
      direction: msg.fromMe ? 'out' : 'in',
      source: msg.fromMe ? 'phone' : 'parent',
      body: msg.body,
      mediaType,
      mediaPath,
      mediaMime: msg.media?.mime ?? (msg.unsupportedType ?? null),
      mediaSeconds: msg.media?.seconds ?? null,
      mediaSize: msg.media?.size ?? null,
      mediaStatus,
      waMessageId: msg.messageId,
      isRead: msg.fromMe,
      createdAt: msg.timestamp,
    });
    if (row) this.logger.log(`Inbox ${row.direction} ${mediaType ?? 'text'} — ${phone}`);
    return row;
  }

  // ─── القراية ─────────────────────────────────────────────────

  private indexStudents(students: StudentContact[]): Map<string, InboxStudent[]> {
    const byPhone = new Map<string, InboxStudent[]>();
    const add = (raw: string | null, s: StudentContact, relation: 'parent' | 'student') => {
      if (!raw) return;
      const key = normalizePhone(raw);
      if (!key) return;
      const list = byPhone.get(key) ?? [];
      if (!list.some((x) => x.id === s.id)) {
        list.push({ id: s.id, fullName: s.fullName, studentCode: s.studentCode, isActive: s.isActive, relation });
      }
      byPhone.set(key, list);
    };
    for (const s of students) {
      add(s.parentPhone, s, 'parent');
      add(s.studentPhone, s, 'student');
    }
    // الطلاب النشطين الأول
    for (const list of byPhone.values()) list.sort((a, b) => Number(b.isActive) - Number(a.isActive));
    return byPhone;
  }

  /**
   * المحادثات، الأحدث الأول. الإخوات اللي ليهم نفس رقم ولي الأمر بيظهروا كلهم (بيحل WA-112 هنا).
   * search: اسم طالب أو كود أو جزء من الرقم.
   */
  async listConversations(tenantId: string, opts: { search?: string; unreadOnly?: boolean; limit?: number; offset?: number }) {
    const [convs, students] = await Promise.all([
      this.repo.listConversations(tenantId),
      this.repo.listStudentContacts(tenantId),
    ]);
    const byPhone = this.indexStudents(students);

    let items: InboxConversation[] = convs.map((c) => ({
      phone: c.phone,
      students: byPhone.get(c.phone) ?? [],
      lastAt: new Date(c.lastAt).toISOString(),
      lastDirection: c.lastDirection,
      lastPreview: c.lastBody || MEDIA_LABELS[c.lastMediaType ?? ''] || '',
      unread: c.unread,
    }));

    if (opts.unreadOnly) items = items.filter((c) => c.unread > 0);
    const q = opts.search?.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, '');
      items = items.filter((c) =>
        c.students.some((s) => s.fullName.toLowerCase().includes(q) || (s.studentCode ?? '').toLowerCase().includes(q))
        || (digits.length >= 3 && (c.phone.includes(digits) || ('0' + c.phone.slice(2)).includes(digits))));
    }

    const total = items.length;
    const offset = Math.max(0, opts.offset ?? 0);
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
    const state = await this.provider.getConnectionState(tenantId).catch(() => null);
    return { data: items.slice(offset, offset + limit), total, connected: state?.status === 'connected' };
  }

  async unreadCount(tenantId: string) {
    return this.repo.unreadTotals(tenantId);
  }

  /** رسايل المحادثة + الإشعارات التلقائية، مترتبة من الأقدم للأحدث */
  async getThread(tenantId: string, rawPhone: string, opts: { before?: string; limit?: number }) {
    const phone = this.parsePhone(rawPhone);
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
    const before = opts.before ? new Date(opts.before) : undefined;
    if (before && isNaN(before.getTime())) throw new AppError('VALIDATION_ERROR', 'تاريخ غير صالح', 400);

    const messages = await this.repo.listMessages(tenantId, phone, limit + 1, before);
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);
    // الإشعارات في نفس المدى الزمني بتاع الصفحة دي بس
    const oldest = hasMore ? page[page.length - 1]?.created_at : undefined;
    const notifications = await this.repo.listNotifications(tenantId, phone, limit, before, oldest);

    const items: InboxThreadItem[] = [
      ...page.map((m) => this.toThreadMessage(m)),
      ...notifications.map((n: any) => ({
        kind: 'notification' as const,
        id: n.id,
        templateKey: n.template_key,
        body: n.body,
        status: n.status,
        at: new Date(n.sent_at ?? n.created_at).toISOString(),
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const students = this.indexStudents(await this.repo.listStudentContacts(tenantId)).get(phone) ?? [];
    const state = await this.provider.getConnectionState(tenantId).catch(() => null);
    return { phone, students, items, hasMore, connected: state?.status === 'connected' };
  }

  async markRead(tenantId: string, rawPhone: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markConversationRead(tenantId, this.parsePhone(rawPhone)) };
  }

  /** مسار الملف + نوعه لـ GET /inbox/messages/:id/media */
  async getMedia(tenantId: string, id: string): Promise<{ path: string; mime: string }> {
    const row = await this.repo.findById(tenantId, id);
    if (!row?.media_path) throw new AppError('NOT_FOUND', 'الملف مش موجود', 404);
    const full = this.media.resolve(row.media_path);
    if (!full) throw new AppError('NOT_FOUND', 'الملف مش موجود على الجهاز', 404);
    return { path: full, mime: (row.media_mime ?? 'application/octet-stream').split(';')[0] };
  }

  // ─── الرد ───────────────────────────────────────────────────

  /**
   * بيسجّل الرد pending ويرجّعه على طول، والإرسال الفعلي في الخلفية (الطابور ممكن يكون مشغول
   * بإرسال جماعي). الواجهة بتحدّث المحادثة وبتشوف الحالة sent/failed.
   */
  async reply(tenantId: string, userId: string | null, rawPhone: string, rawBody: unknown) {
    const phone = this.parsePhone(rawPhone);
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if (!body) throw new AppError('VALIDATION_ERROR', 'اكتب الرسالة الأول', 400);
    if (body.length > MAX_REPLY_LENGTH) throw new AppError('VALIDATION_ERROR', `الرسالة طويلة (أقصى حد ${MAX_REPLY_LENGTH} حرف)`, 400);

    const row = await this.repo.insert(tenantId, {
      phone, direction: 'out', source: 'app', body, status: 'pending', sentBy: userId, isRead: true,
    });
    if (!row) throw new AppError('INTERNAL', 'تعذّر حفظ الرسالة', 500);
    void this.deliver(tenantId, row.id, phone, body);
    return this.toThreadMessage(row);
  }

  async retry(tenantId: string, id: string) {
    const row = await this.repo.findById(tenantId, id);
    if (!row || row.direction !== 'out' || row.source !== 'app') throw new AppError('NOT_FOUND', 'الرسالة مش موجودة', 404);
    if (row.status !== 'failed') throw new AppError('INVALID_STATE', 'الرسالة دي مش فاشلة', 409);
    await this.repo.markPending(tenantId, id);
    void this.deliver(tenantId, id, row.phone, row.body);
    return this.toThreadMessage({ ...row, status: 'pending', error_message: null });
  }

  /** الإرسال الفعلي — بيستنى في الطابور، وبيحدّث الحالة. مابيرميش أخطاء */
  async deliver(tenantId: string, id: string, phone: string, body: string): Promise<void> {
    try {
      const result = await this.provider.sendMessage(tenantId, phone, body, { priority: true });
      if (result.success) await this.repo.markSent(tenantId, id, result.messageId ?? null);
      else await this.repo.markFailed(tenantId, id, sendErrorMessage(result.error));
    } catch (err: any) {
      this.logger.error(`Inbox reply ${id} failed: ${err?.message}`);
      await this.repo.markFailed(tenantId, id, sendErrorMessage(err?.message)).catch(() => undefined);
    }
  }

  // ─── مساعدات ────────────────────────────────────────────────

  private parsePhone(raw: string): string {
    const phone = normalizePhone(String(raw ?? ''));
    if (!/^\d{8,15}$/.test(phone)) throw new AppError('VALIDATION_ERROR', 'رقم تليفون غير صالح', 400);
    return phone;
  }

  private toThreadMessage(m: ChatMessageRow): InboxThreadItem {
    return {
      kind: 'message',
      id: m.id,
      direction: m.direction,
      source: m.source,
      body: m.body,
      media: m.media_type
        ? { type: m.media_type, mime: m.media_mime, seconds: m.media_seconds, size: m.media_size, status: m.media_status }
        : null,
      status: m.status,
      error: m.error_message,
      at: new Date(m.created_at).toISOString(),
    };
  }
}

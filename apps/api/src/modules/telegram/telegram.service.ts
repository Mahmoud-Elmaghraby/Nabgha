import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { KyselyService } from '../../shared/infrastructure/database/kysely.service';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { ModuleSettingsRepository } from '../settings/infrastructure/settings.repository';
import { TelegramLinksRepository, TelegramEntityType } from './infrastructure/telegram-links.repository';

const LAST_UPDATE_ID_KEY = 'telegram_last_update_id';
const POLL_TIMEOUT_SECONDS = 30;

export interface TelegramUpdate {
  updateId: number;
  chatId: string;
  text: string;
}

/**
 * Client خفيف لـ Telegram Bot API. الاستقبال بقى عن طريق Long Polling (getUpdates)
 * بدل Webhook — القرار ده مش تفضيل أسلوب بس، ده حل لمشكلة حقيقية: النشر الفعلي
 * للعميل شغال Desktop mode (Electron جوه جهاز المركز) من غير IP عام أو بورت مفتوح،
 * فمستحيل تيليجرام "يدق" على سيرفرنا. الـ polling طلب صادر بس (زي أي HTTP call عادي)،
 * فشغال من أي جهاز عادي وبيلغي الحاجة لأي endpoint عام مكشوف على الإنترنت
 * (وبالتبعية، بيلغي فئة كاملة من الثغرات الأمنية اللي كانت موجودة مع الـ webhook القديم).
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly kysely: KyselyService,
    private readonly settingsRepo: ModuleSettingsRepository,
    private readonly links: TelegramLinksRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getBotToken(tenantId: string): Promise<string | null> {
    return this.settingsRepo.get(tenantId, 'telegram_bot_token');
  }

  /**
   * بيفحص لو نفس التوكن ده متسجل بالفعل عند tenant تاني نشط غير الحالي.
   * ضروري جدًا لأن Telegram Bot API بيسمح بمستهلك getUpdates واحد بس لكل توكن —
   * لو نفس التوكن اتسجل عند tenant-ين، الاتنين هيتنازعوا على استقبال الرسايل
   * (409 Conflict من تليجرام، ورسايل هتضيع أو تتوجه لتينانت غلط) — بالظبط زي
   * احتياج رقم واتساب منفصل لكل tenant. مفيش طريقة تانية نمنعها إلا بفحص كل
   * الـ tenants النشطين وقت الحفظ.
   */
  async findTenantUsingToken(token: string, excludingTenantId: string): Promise<string | null> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    for (const t of tenants) {
      if (t.id === excludingTenantId) continue;
      const existing = await this.settingsRepo.get(t.id, 'telegram_bot_token');
      if (existing && existing === token) return t.name;
    }
    return null;
  }

  async sendMessage(tenantId: string, chatId: string, text: string): Promise<boolean> {
    const token = await this.getBotToken(tenantId);
    if (!token) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
      return true;
    } catch (err: any) {
      this.logger.warn(`Telegram send failed (tenant ${tenantId}): ${err.message}`);
      return false;
    }
  }

  /**
   * إرسال صورة مع نص كـ caption — مطلوبة لإشعار GRADE_RECORDED لما يكون فيه
   * صورة مرفقة بالحصة (ورقة امتحان ممسوحة مثلاً)، مرآة لـ WA sendImage. بنستخدم
   * multipart/form-data (باكدج form-data) لأن Telegram Bot API sendPhoto محتاج
   * الصورة كملف مرفوع، مش base64 أو رابط داخلي.
   */
  async sendPhoto(tenantId: string, chatId: string, image: Buffer, caption?: string): Promise<boolean> {
    const token = await this.getBotToken(tenantId);
    if (!token) return false;
    try {
      const form = new FormData();
      form.append('chat_id', chatId);
      if (caption) form.append('caption', caption);
      form.append('photo', image, { filename: 'grade.jpg', contentType: 'image/jpeg' });

      await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return true;
    } catch (err: any) {
      this.logger.warn(`Telegram sendPhoto failed (tenant ${tenantId}): ${err.message}`);
      return false;
    }
  }

  /**
   * بيبعت إشعار لجهة مربوطة فعلاً (طالب/ولي أمر حاليًا، وقابل للتوسع لاحقًا لأي
   * entityType تاني زي 'teacher'). بيرجع false بهدوء لو مفيش ربط تليجرام أصلاً —
   * ده سلوك متوقع (مش كل ولي أمر هيربط تليجرام)، مش حالة خطأ.
   */
  async sendNotification(
    tenantId: string,
    entityType: TelegramEntityType,
    entityId: string,
    text: string,
  ): Promise<boolean> {
    const chatId = await this.links.findChatId(tenantId, entityType, entityId);
    if (!chatId) return false;
    return this.sendMessage(tenantId, chatId, text);
  }

  /** بيربط chat_id بجهة عن طريق كودها الظاهري (student_code حاليًا) — بيرجع false لو الكود مش موجود */
  async linkChat(tenantId: string, entityType: TelegramEntityType, entityCode: string, chatId: string): Promise<boolean> {
    const entityId = await this.resolveEntityIdByCode(tenantId, entityType, entityCode);
    if (!entityId) return false;
    await this.links.upsertLink(tenantId, entityType, entityId, chatId);
    return true;
  }

  /** نقطة التوسع الوحيدة المطلوبة لدعم جهة جديدة (مثلاً 'teacher') مستقبلاً — case إضافي هنا بس */
  private async resolveEntityIdByCode(tenantId: string, entityType: TelegramEntityType, code: string): Promise<string | null> {
    const db = this.kysely.getTenantDb(tenantId);
    switch (entityType) {
      case 'student': {
        const student = await db
          .selectFrom('students')
          .select(['id'])
          .where('student_code', '=', code)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();
        return (student as any)?.id ?? null;
      }
      default:
        return null;
    }
  }

  async getBotInfo(tenantId: string): Promise<{ username: string; name: string } | null> {
    const token = await this.getBotToken(tenantId);
    if (!token) return null;
    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
      return {
        username: res.data.result.username,
        name: res.data.result.first_name,
      };
    } catch {
      return null;
    }
  }

  /**
   * Long polling — بيرجع رسايل جديدة بس (بعد آخر offset محفوظ)، وبيحدّث الـ offset
   * بنفسه فور نجاح الاستدعاء بصرف النظر عن نجاح معالجة كل رسالة بعد كده — ده سلوك
   * مقصود ومطابق للممارسة القياسية لـ Telegram Bot API (لو فشلنا نعالج رسالة معينة،
   * الأنسب نعتبرها اتاكلت مش نفضل نعيد جيبها للأبد ونعلّق باقي الرسايل وراها).
   * أي خطأ شبكة/توكن هنا بيتقذف لفوق — مسؤولية إعادة المحاولة/الـ backoff على
   * TelegramPollingService، مش على الـ client الخفيف ده.
   */
  async getUpdates(tenantId: string): Promise<TelegramUpdate[]> {
    const token = await this.getBotToken(tenantId);
    if (!token) return [];

    const lastIdRaw = await this.settingsRepo.get(tenantId, LAST_UPDATE_ID_KEY);
    const offset = lastIdRaw ? Number(lastIdRaw) + 1 : undefined;

    const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
      params: { offset, timeout: POLL_TIMEOUT_SECONDS, allowed_updates: ['message'] },
      timeout: (POLL_TIMEOUT_SECONDS + 10) * 1000,
    });

    const results: any[] = res.data?.result ?? [];
    if (results.length === 0) return [];

    const maxUpdateId = Math.max(...results.map((u) => u.update_id));
    await this.settingsRepo.set(tenantId, LAST_UPDATE_ID_KEY, String(maxUpdateId));

    return results
      .filter((u) => u.message?.text && u.message?.chat?.id)
      .map((u) => ({
        updateId: u.update_id,
        chatId: String(u.message.chat.id),
        text: String(u.message.text).trim(),
      }));
  }

  /**
   * قطع اتصال البوت عن التينانت — بيمسح التوكن المحفوظ (فـ hasToken هترجع false
   * فورًا) وبيصفّر offset الاستقبال (telegram_last_update_id). التصفير مهم:
   * لو التينانت وصل بوت جديد بعدين، الـ offset القديم كان هيبقى رقم update_id
   * تابع لبوت مختلف تمامًا، فممكن يخلي getUpdates يتجاهل كل رسايل البوت الجديد
   * (لأنه هيفضل يستنى update_id أكبر من رقم عمره ما هيوصله). مش بتلمس أي بيانات
   * قديمة (telegram_links / telegram_messages / telegram_inbound_messages) —
   * لو رجع يربط نفس البوت تاني، تاريخ الطلاب المربوطين يفضل زي ما هو.
   */
  async disconnect(tenantId: string): Promise<void> {
    await this.settingsRepo.set(tenantId, 'telegram_bot_token', '');
    await this.settingsRepo.set(tenantId, LAST_UPDATE_ID_KEY, '');
  }

  async getDeepLink(tenantId: string, entityCode: string): Promise<string | null> {
    const botInfo = await this.getBotInfo(tenantId);
    if (!botInfo) return null;
    return `https://t.me/${botInfo.username}?start=${entityCode}`;
  }
}

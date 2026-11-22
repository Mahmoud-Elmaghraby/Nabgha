import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import * as path from 'path';
import * as fs from 'fs';
import * as qrcode from 'qrcode';
import type { IWaProvider, WaConnectionState, WaSendResult } from '../domain/interfaces/wa-provider.interface';
import { normalizePhone } from '../../../shared/utils/phone.util';

// ─── Circuit Breaker Config ────────────────────────────────
/** عدد الفشل المتتالي قبل إغلاق الدائرة */
const CIRCUIT_FAILURE_THRESHOLD = 5;
/** مدة إغلاق الدائرة (ساعة) قبل إعادة المحاولة */
const CIRCUIT_COOLDOWN_MS = 60 * 60 * 1000;

// ─── Typing Simulation Config ──────────────────────────────
/** الحد الأدنى لوقت الكتابة (ms) */
const TYPING_MIN_MS = 1500;
/** الحد الأقصى لوقت الكتابة (ms) */
const TYPING_MAX_MS = 4000;
/** سرعة الكتابة البشرية تقريباً: 40ms لكل حرف */
const TYPING_MS_PER_CHAR = 40;

// ─── Text Variation Config ─────────────────────────────────
/**
 * أحرف Unicode غير مرئية — كل رسالة تأخذ حرفاً مختلفاً
 * بيخلي كل رسالة فريدة من الناحية التقنية ويمنع كشف الـ bulk spam
 */
const INVISIBLE_CHARS = ['\u200B', '\u200C', '\u200D', '\uFEFF'] as const;

interface CircuitBreakerState {
  consecutiveFailures: number;
  openUntil: Date | null;
}

@Injectable()
export class BaileysProvider implements IWaProvider, OnModuleDestroy {
  private readonly logger = new Logger(BaileysProvider.name);

  // ─── State Maps ───────────────────────────────────────────
  private sockets         = new Map<string, ReturnType<typeof makeWASocket>>();
  private states          = new Map<string, WaConnectionState>();
  private qrCallbacks     = new Map<string, (qr: string) => void>();
  private connectedCallbacks    = new Map<string, (phone: string) => void>();
  private disconnectedCallbacks = new Map<string, (reason: string) => void>();
  private messageCallbacks      = new Map<string, (phone: string, body: string) => void>();
  private reconnectAttempts     = new Map<string, number>();
  private circuitBreakers       = new Map<string, CircuitBreakerState>();
  /**
   * طابور إرسال واحد لكل tenant — يضمن إن كل الرسايل (إشعار فردي، bulk، retry
   * cron، أو أي حلقة إشعارات متوازية زي "إنهاء الحصة") بتتبعت فعليًا واحدة ورا
   * التانية على نفس الاتصال، مهما كان عدد الأماكن اللي بتنادي sendMessage/
   * sendImage/sendDocument بالتوازي في نفس اللحظة. من غيرها، كل نداء بيحسب
   * تأخيره (anti-ban delay) لوحده، فلو نداءين استنوا بالتوازي هيخلصوا الانتظار
   * مع بعض ويبعتوا في نفس اللحظة تقريبًا — بيلغي فايدة التأخير بالكامل
   * (اكتُشف Aug 31 2026 في حلقة إشعارات "معذور" عند إنهاء حصة فيها عدة غيابات).
   */
  private sendQueues            = new Map<string, Promise<unknown>>();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ═══════════════════════════════════════════════════════════
  // Circuit Breaker
  // ═══════════════════════════════════════════════════════════

  private getCircuit(tenantId: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(tenantId)) {
      this.circuitBreakers.set(tenantId, { consecutiveFailures: 0, openUntil: null });
    }
    return this.circuitBreakers.get(tenantId)!;
  }

  /**
   * يتحقق إذا كانت الدائرة مفتوحة (الإرسال موقوف مؤقتاً).
   * لو انتهى وقت الـ cooldown، يغلق الدائرة تلقائياً ويسمح بالإرسال.
   */
  private isCircuitOpen(tenantId: string): boolean {
    const circuit = this.getCircuit(tenantId);
    if (!circuit.openUntil) return false;

    if (new Date() > circuit.openUntil) {
      circuit.consecutiveFailures = 0;
      circuit.openUntil = null;
      this.logger.log(`🟢 Circuit breaker CLOSED for tenant ${tenantId} — resuming sends`);
      return false;
    }

    const remainingMin = Math.ceil((circuit.openUntil.getTime() - Date.now()) / 60000);
    this.logger.warn(`🔴 Circuit breaker OPEN for tenant ${tenantId} — ${remainingMin}min remaining`);
    return true;
  }

  private recordSendSuccess(tenantId: string): void {
    const circuit = this.getCircuit(tenantId);
    if (circuit.consecutiveFailures > 0) {
      this.logger.log(`✅ Send success — resetting circuit for tenant ${tenantId}`);
      circuit.consecutiveFailures = 0;
      circuit.openUntil = null;
    }
  }

  private recordSendFailure(tenantId: string, error: string): void {
    const circuit = this.getCircuit(tenantId);
    circuit.consecutiveFailures++;

    this.logger.warn(
      `⚠️ Send failure [${circuit.consecutiveFailures}/${CIRCUIT_FAILURE_THRESHOLD}] ` +
      `for tenant ${tenantId}: ${error}`,
    );

    if (circuit.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuit.openUntil = new Date(Date.now() + CIRCUIT_COOLDOWN_MS);
      this.logger.error(
        `🔴 Circuit breaker OPEN for tenant ${tenantId} — ` +
        `${circuit.consecutiveFailures} consecutive failures — pausing sends for 1 hour`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Anti-Ban: Typing Simulation
  // ═══════════════════════════════════════════════════════════

  /**
   * يحاكي سلوك الكتابة البشري قبل إرسال الرسالة:
   *   1. يبعت "جاري الكتابة..."
   *   2. ينتظر وقتاً متناسباً مع طول الرسالة
   *   3. يوقف مؤشر الكتابة
   *
   * لا يعمل presenceSubscribe (اتشال عمداً — راجع الملاحظة داخل الدالة، Aug 2026).
   * الفشل لا يوقف الإرسال — يتجاوزه بصمت.
   */
  private async simulateHumanTyping(
    sock: ReturnType<typeof makeWASocket>,
    jid: string,
    textLength: number,
  ): Promise<void> {
    try {
      // 1. Start composing
      // ⚠️ لا تضيف sock.presenceSubscribe(jid) هنا — كان موجود قبل كده واتشال عمداً
      // (Aug 31 2026): presenceSubscribe بيخلي الحساب "يتابع" presence رقم مش
      // موجود في جهات اتصاله؛ لما البرنامج يبعت لعشرات الأرقام يبقى ده subscribe
      // جماعي على أرقام غريبة — نمط سلوك بوت واضح لواتساب، ومن الأسباب المؤكدة
      // لحظر/تحذير أرقام المدرسين (راجع تقرير تحليل حظر الأرقام).
      await sock.sendPresenceUpdate('composing', jid);

      // 2. Typing duration based on message length, clamped to human range
      const rawTypingMs = textLength * TYPING_MS_PER_CHAR;
      const typingMs    = Math.min(Math.max(rawTypingMs, TYPING_MIN_MS), TYPING_MAX_MS);
      const humanJitter = Math.random() * 800;
      await this.sleep(typingMs + humanJitter);

      // 3. Stop composing
      await sock.sendPresenceUpdate('paused', jid);
      await this.sleep(300 + Math.random() * 400);
    } catch (err: any) {
      this.logger.debug(`Typing simulation skipped (non-critical): ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Anti-Ban: Text Variation
  // ═══════════════════════════════════════════════════════════

  /**
   * يضيف حرف Unicode غير مرئي عشوائي جوه نص الرسالة (مش في آخرها).
   * يجعل كل رسالة فريدة تقنياً ويمنع كشفها كـ duplicate/spam — من غير ما يلزق
   * الحرف المخفي بآخر حاجة في الرسالة (زي رابط تليجرام/أي رابط تاني بيكون
   * آخر سطر عادةً)، لأن ده كان بيخرّب الرابط فعليًا (حرف زيادة غير مرئي
   * بيتحط في نص الرابط نفسه، فتليجرام كان بيرفضه كـ start parameter غير صالح).
   */
  private addTextVariation(text: string): string {
    const char = INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
    if (text.length < 2) return text + char;
    // نطاق [1, text.length - 1] — أبداً في البداية (index 0) وأبداً ملزوق
    // بعد آخر حرف (text.length)، يعني مستحيل يتلزق بآخر رابط في الرسالة
    const index = 1 + Math.floor(Math.random() * (text.length - 1));
    return text.slice(0, index) + char + text.slice(index);
  }

  // ═══════════════════════════════════════════════════════════
  // Send Queue — Per-Tenant Serialization
  // ═══════════════════════════════════════════════════════════

  /**
   * ينفّذ task واحدة بس في كل مرة لكل tenant، بالترتيب اللي اتنادت بيه —
   * راجع توثيق sendQueues أعلاه للسبب. فشل مهمة سابقة ما بيوقفش الطابور
   * (catch صامت على النسخة المخزّنة)، لكن نتيجة/خطأ المهمة الحالية لسه
   * بيوصل للمنادي الأصلي عادي.
   */
  private enqueueSend<T>(tenantId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.sendQueues.get(tenantId) ?? Promise.resolve();
    const result = previous.then(task, task);
    this.sendQueues.set(tenantId, result.catch(() => undefined));
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Connection Management
  // ═══════════════════════════════════════════════════════════

  private getSessionDir(tenantId: string): string {
    const baseDir = path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'wa-sessions');
    const dir = path.join(baseDir, tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async connect(tenantId: string): Promise<void> {
    const currentState = this.states.get(tenantId);
    if (currentState?.status === 'connected') {
      this.logger.log(`Already connected for tenant ${tenantId}`);
      return;
    }

    // لو فيه socket قديم عالق (QR منتهي الصلاحية مثلاً)، نقفله ونبدأ من جديد
    const staleSocket = this.sockets.get(tenantId);
    if (staleSocket) {
      try { staleSocket.end(undefined); } catch {}
      this.sockets.delete(tenantId);
    }

    const sessionDir = this.getSessionDir(tenantId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const { default: pino } = await import('pino');
    const baileysLogger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      printQRInTerminal: false,
      logger: baileysLogger,
    });

    this.sockets.set(tenantId, sock);
    this.states.set(tenantId, { status: 'connecting' });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        this.states.set(tenantId, {
          status: 'connecting',
          qrCode: qrImage,
          qrExpiresAt: new Date(Date.now() + 60_000),
        });
        this.qrCallbacks.get(tenantId)?.(qrImage);
        await this.redis.setex(`wa:qr:${tenantId}`, 60, qrImage);
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0] ?? '';
        this.states.set(tenantId, { status: 'connected', phone });
        this.connectedCallbacks.get(tenantId)?.(phone);
        await this.redis.set(`wa:status:${tenantId}`, 'connected');
        await this.redis.set(`wa:phone:${tenantId}`, phone);
        this.reconnectAttempts.delete(tenantId);
        // إعادة تعيين Circuit Breaker عند الاتصال الناجح
        this.getCircuit(tenantId).consecutiveFailures = 0;
        this.getCircuit(tenantId).openUntil = null;
        this.logger.log(`✅ Tenant ${tenantId} connected — phone: ${phone}`);
      }

      if (connection === 'close') {
        const statusCode  = (lastDisconnect?.error as any)?.output?.statusCode;
        const isBanned    = statusCode === DisconnectReason.forbidden;   // 403
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;   // 401

        if (isBanned) {
          // ─── حظر مؤكد من واتساب ────────────────────────────
          this.logger.error(`🚫 Tenant ${tenantId} BANNED by WhatsApp (403)`);
          this.states.set(tenantId, { status: 'banned' });
          this.disconnectedCallbacks.get(tenantId)?.('banned');
          await this.redis.set(`wa:status:${tenantId}`, 'banned');
          this.sockets.delete(tenantId);
          return;
        }

        this.states.set(tenantId, { status: 'disconnected' });
        await this.redis.set(`wa:status:${tenantId}`, 'disconnected');
        this.sockets.delete(tenantId);

        if (isLoggedOut) {
          // ─── تسجيل خروج من الجهاز ──────────────────────────
          this.logger.warn(`Tenant ${tenantId} logged out — deleting session files`);
          this.disconnectedCallbacks.get(tenantId)?.('logged_out');
          this.reconnectAttempts.delete(tenantId);
          fs.rmSync(this.getSessionDir(tenantId), { recursive: true, force: true });
          return;
        }

        // ─── انقطاع مؤقت — إعادة اتصال بتصاعد أُسّي ──────────
        this.disconnectedCallbacks.get(tenantId)?.('reconnecting');
        const attempts = (this.reconnectAttempts.get(tenantId) ?? 0) + 1;
        this.reconnectAttempts.set(tenantId, attempts);
        const delay = Math.min(3000 * Math.pow(2, attempts - 1), 5 * 60 * 1000);
        this.logger.warn(
          `Tenant ${tenantId} disconnected (code: ${statusCode}) — ` +
          `reconnecting in ${Math.round(delay / 1000)}s (attempt ${attempts})`,
        );
        setTimeout(() => this.connect(tenantId), delay);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const phone = msg.key.remoteJid?.split('@')[0] ?? '';
          const body  =
            msg.message.conversation ??
            msg.message.extendedTextMessage?.text ??
            '';
          if (phone && body) {
            this.messageCallbacks.get(tenantId)?.(phone, body);
          }
        }
      }
    });
  }

  /** قطع الاتصال بدون حذف ملفات الجلسة — يُستخدم عند restart أو انقطاع مؤقت */
  async disconnect(tenantId: string): Promise<void> {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      try { sock.end(undefined); } catch {}
      this.sockets.delete(tenantId);
    }
    this.states.set(tenantId, { status: 'disconnected' });
    await this.redis.set(`wa:status:${tenantId}`, 'disconnected');
  }

  /** تسجيل خروج كامل — يحذف ملفات الجلسة ويحتاج إعادة مسح QR */
  async logout(tenantId: string): Promise<void> {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      try { await sock.logout(); } catch {}
      this.sockets.delete(tenantId);
    }
    this.states.set(tenantId, { status: 'disconnected' });
    await this.redis.set(`wa:status:${tenantId}`, 'disconnected');
    const sessionDir = this.getSessionDir(tenantId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    this.logger.warn(`Tenant ${tenantId} logged out — session files deleted`);
  }

  async getConnectionState(tenantId: string): Promise<WaConnectionState> {
    const cached = this.states.get(tenantId);
    if (cached) return cached;
    const status = await this.redis.get(`wa:status:${tenantId}`);
    const phone  = await this.redis.get(`wa:phone:${tenantId}`);
    return {
      status: (status as any) ?? 'disconnected',
      phone:  phone ?? undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Sending — Anti-Ban Pipeline
  // ═══════════════════════════════════════════════════════════

  async sendMessage(tenantId: string, phone: string, body: string): Promise<WaSendResult> {
    if (this.isCircuitOpen(tenantId)) {
      return { success: false, error: 'circuit_open' };
    }

    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };

    // ── Anti-Ban: طابور تسلسلي لكل tenant — راجع توثيق sendQueues/enqueueSend ──
    return this.enqueueSend(tenantId, async () => {
      try {
        const normalizedPhone = this.normalizePhone(phone);
        const jid = `${normalizedPhone}@s.whatsapp.net`;

        // ── Anti-Ban: Typing simulation ──────────────────────
        await this.simulateHumanTyping(sock, jid, body.length);

        // ── Anti-Ban: Text variation ──────────────────────────
        const variedBody = this.addTextVariation(body);

        this.logger.debug(`Sending WA message to ${jid} for tenant ${tenantId}`);
        const result = await sock.sendMessage(jid, { text: variedBody });

        this.recordSendSuccess(tenantId);
        return { success: true, messageId: result?.key?.id ?? undefined };
      } catch (err: any) {
        this.logger.error(`Send failed for tenant ${tenantId}: ${err.message}`);
        this.recordSendFailure(tenantId, err.message);
        return { success: false, error: err.message };
      }
    });
  }

  async sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    fileName: string,
    caption?: string,
  ): Promise<WaSendResult> {
    if (this.isCircuitOpen(tenantId)) {
      return { success: false, error: 'circuit_open' };
    }

    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };

    // ── Anti-Ban: طابور تسلسلي لكل tenant — راجع توثيق sendQueues/enqueueSend ──
    return this.enqueueSend(tenantId, async () => {
      try {
        const normalizedPhone = this.normalizePhone(phone);
        const jid = `${normalizedPhone}@s.whatsapp.net`;

        // ── Anti-Ban: Typing simulation (بناءً على طول الـ caption) ──
        await this.simulateHumanTyping(sock, jid, caption?.length ?? 30);

        this.logger.debug(`Sending WA document to ${jid} for tenant ${tenantId}`);
        const result = await sock.sendMessage(jid, {
          document,
          fileName,
          mimetype: 'application/pdf',
          caption: caption ? this.addTextVariation(caption) : undefined,
        });

        this.recordSendSuccess(tenantId);
        return { success: true, messageId: result?.key?.id ?? undefined };
      } catch (err: any) {
        this.logger.error(`Send document failed for tenant ${tenantId}: ${err.message}`);
        this.recordSendFailure(tenantId, err.message);
        return { success: false, error: err.message };
      }
    });
  }

  async sendImage(
    tenantId: string,
    phone: string,
    image: Buffer,
    caption?: string,
  ): Promise<WaSendResult> {
    if (this.isCircuitOpen(tenantId)) {
      return { success: false, error: 'circuit_open' };
    }

    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };

    // ── Anti-Ban: طابور تسلسلي لكل tenant — راجع توثيق sendQueues/enqueueSend ──
    return this.enqueueSend(tenantId, async () => {
      try {
        const normalizedPhone = this.normalizePhone(phone);
        const jid = `${normalizedPhone}@s.whatsapp.net`;

        // ── Anti-Ban: Typing simulation ──────────────────────
        await this.simulateHumanTyping(sock, jid, caption?.length ?? 20);

        this.logger.debug(`Sending WA image to ${jid} for tenant ${tenantId}`);
        const result = await sock.sendMessage(jid, {
          image,
          caption: caption ? this.addTextVariation(caption) : undefined,
        });

        this.recordSendSuccess(tenantId);
        return { success: true, messageId: result?.key?.id ?? undefined };
      } catch (err: any) {
        this.logger.error(`Send image failed for tenant ${tenantId}: ${err.message}`);
        this.recordSendFailure(tenantId, err.message);
        return { success: false, error: err.message };
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Phone Check
  // ═══════════════════════════════════════════════════════════

  async checkPhone(tenantId: string, phone: string): Promise<{ exists: boolean; jid?: string }> {
    const sock = this.sockets.get(tenantId);
    if (!sock) return { exists: false };
    try {
      const normalized = this.normalizePhone(phone);
      const results = await sock.onWhatsApp(normalized);
      this.logger.debug(`checkPhone ${normalized}: ${JSON.stringify(results)}`);
      const result = results?.[0];
      return { exists: !!result?.exists, jid: result?.jid };
    } catch (err: any) {
      this.logger.error(`checkPhone failed: ${err.message}`);
      return { exists: false };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Callbacks
  // ═══════════════════════════════════════════════════════════

  onQrCode(tenantId: string, callback: (qr: string) => void): void {
    this.qrCallbacks.set(tenantId, callback);
  }

  onConnected(tenantId: string, callback: (phone: string) => void): void {
    this.connectedCallbacks.set(tenantId, callback);
  }

  onDisconnected(tenantId: string, callback: (reason: string) => void): void {
    this.disconnectedCallbacks.set(tenantId, callback);
  }

  onMessage(tenantId: string, callback: (phone: string, body: string) => void): void {
    this.messageCallbacks.set(tenantId, callback);
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  async onModuleDestroy(): Promise<void> {
    for (const [tenantId, sock] of this.sockets) {
      this.logger.log(`Closing socket for tenant ${tenantId}`);
      try { sock.end(undefined); } catch {}
    }
    this.sockets.clear();
    this.circuitBreakers.clear();
    this.sendQueues.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════

  private normalizePhone(phone: string): string {
    return normalizePhone(phone);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

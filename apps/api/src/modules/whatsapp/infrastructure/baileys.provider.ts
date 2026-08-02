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

@Injectable()
export class BaileysProvider implements IWaProvider, OnModuleDestroy {
  private readonly logger = new Logger(BaileysProvider.name);
  private sockets = new Map<string, ReturnType<typeof makeWASocket>>();
  private states = new Map<string, WaConnectionState>();
  private qrCallbacks = new Map<string, (qr: string) => void>();
  private connectedCallbacks = new Map<string, (phone: string) => void>();
  private disconnectedCallbacks = new Map<string, (reason: string) => void>();
  private messageCallbacks = new Map<string, (phone: string, body: string) => void>();
  private reconnectAttempts = new Map<string, number>();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

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

    // لو فيه socket قديم عالق (QR منتهي الصلاحية مثلاً)، نقفله ونبدأ من جديد للحصول على QR جديد
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
        this.states.set(tenantId, { status: 'connecting', qrCode: qrImage, qrExpiresAt: new Date(Date.now() + 60000) });
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
        this.logger.log(`Tenant ${tenantId} connected — phone: ${phone}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const reason = shouldReconnect ? 'reconnecting' : 'logged_out';

        this.states.set(tenantId, { status: 'disconnected' });
        this.disconnectedCallbacks.get(tenantId)?.(reason);
        await this.redis.set(`wa:status:${tenantId}`, 'disconnected');
        this.sockets.delete(tenantId);

        if (shouldReconnect) {
          // تصاعد أُسّي للتأخير — بدل محاولة كل 3 ثواني للأبد (خطر لو المشكلة حظر مؤقت)
          const attempts = (this.reconnectAttempts.get(tenantId) ?? 0) + 1;
          this.reconnectAttempts.set(tenantId, attempts);
          const delay = Math.min(3000 * Math.pow(2, attempts - 1), 5 * 60 * 1000);
          this.logger.warn(`Tenant ${tenantId} disconnected — reconnecting in ${Math.round(delay / 1000)}s (attempt ${attempts})`);
          setTimeout(() => this.connect(tenantId), delay);
        } else {
          this.logger.warn(`Tenant ${tenantId} logged out`);
          this.reconnectAttempts.delete(tenantId);
          fs.rmSync(this.getSessionDir(tenantId), { recursive: true, force: true });
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const phone = msg.key.remoteJid?.split('@')[0] ?? '';
          const body =
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

  async disconnect(tenantId: string): Promise<void> {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      await sock.logout();
      this.sockets.delete(tenantId);
    }
    this.states.set(tenantId, { status: 'disconnected' });
    await this.redis.set(`wa:status:${tenantId}`, 'disconnected');
    fs.rmSync(this.getSessionDir(tenantId), { recursive: true, force: true });
  }

  async getConnectionState(tenantId: string): Promise<WaConnectionState> {
    const cached = this.states.get(tenantId);
    if (cached) return cached;
    const status = await this.redis.get(`wa:status:${tenantId}`);
    const phone = await this.redis.get(`wa:phone:${tenantId}`);
    return {
      status: (status as any) ?? 'disconnected',
      phone: phone ?? undefined,
    };
  }

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

  async sendMessage(tenantId: string, phone: string, body: string): Promise<WaSendResult> {
    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const jid = `${normalizedPhone}@s.whatsapp.net`;
      this.logger.debug(`Sending WA message to ${jid} for tenant ${tenantId}`);
      const result = await sock.sendMessage(jid, { text: body });
      return { success: true, messageId: result?.key?.id ?? undefined };
    } catch (err: any) {
      this.logger.error(`Send failed for tenant ${tenantId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    fileName: string,
    caption?: string,
  ): Promise<WaSendResult> {
    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const jid = `${normalizedPhone}@s.whatsapp.net`;
      this.logger.debug(`Sending WA document to ${jid} for tenant ${tenantId}`);
      const result = await sock.sendMessage(jid, {
        document,
        fileName,
        mimetype: 'application/pdf',
        caption,
      });
      return { success: true, messageId: result?.key?.id ?? undefined };
    } catch (err: any) {
      this.logger.error(`Send document failed for tenant ${tenantId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendImage(
    tenantId: string,
    phone: string,
    image: Buffer,
    caption?: string,
  ): Promise<WaSendResult> {
    const sock = this.sockets.get(tenantId);
    if (!sock) return { success: false, error: 'not_connected' };
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const jid = `${normalizedPhone}@s.whatsapp.net`;
      this.logger.debug(`Sending WA image to ${jid} for tenant ${tenantId}`);
      const result = await sock.sendMessage(jid, { image, caption });
      return { success: true, messageId: result?.key?.id ?? undefined };
    } catch (err: any) {
      this.logger.error(`Send image failed for tenant ${tenantId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    // Egyptian numbers starting with 0 → prepend country code 20
    if (digits.startsWith('0')) {
      digits = '20' + digits.slice(1);
    }
    return digits;
  }

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

  async onModuleDestroy(): Promise<void> {
    for (const [tenantId, sock] of this.sockets) {
      this.logger.log(`Closing socket for tenant ${tenantId}`);
      sock.end(undefined);
    }
    this.sockets.clear();
  }
}

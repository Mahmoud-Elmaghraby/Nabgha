export interface WaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WaConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'banned';
  phone?: string;
  qrCode?: string;
  qrExpiresAt?: Date;
}

export type WaMediaType = 'audio' | 'image' | 'video' | 'document' | 'sticker';

/** رسالة جاية من واتساب — من ولي الأمر، أو من موبايل المركز نفسه (fromMe) — WA-110 */
export interface WaIncomingMessage {
  /** رقم الطرف التاني بصيغة 20XXXXXXXXXX */
  phone: string;
  /** true = المركز هو اللي بعتها من الموبايل مباشرة (مش من البرنامج) */
  fromMe: boolean;
  messageId: string | null;
  timestamp: Date;
  /** النص، أو الكابشن لو صورة/فيديو/ملف */
  body: string;
  media?: {
    type: WaMediaType;
    mime: string;
    seconds?: number;
    size?: number;
    fileName?: string;
    download: () => Promise<Buffer>;
  };
  /** نوع رسالة مش بندعمه (موقع، جهة اتصال…) — بنسجّل إن فيه رسالة بس */
  unsupportedType?: string;
}

export interface IWaProvider {
  connect(tenantId: string): Promise<void>;
  disconnect(tenantId: string): Promise<void>;
  logout(tenantId: string): Promise<void>;
  getConnectionState(tenantId: string): Promise<WaConnectionState>;
  /** priority: يتخطى فترة الانتظار بين الرسايل (لرسايل عاجلة زي كود دخول ولي الأمر) — بس لسه في نفس الطابور */
  sendMessage(tenantId: string, phone: string, body: string, opts?: { priority?: boolean }): Promise<WaSendResult>;
  sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    fileName: string,
    caption?: string,
  ): Promise<WaSendResult>;
  sendImage(
    tenantId: string,
    phone: string,
    image: Buffer,
    caption?: string,
  ): Promise<WaSendResult>;
  checkPhone(tenantId: string, phone: string): Promise<{ exists: boolean; jid?: string }>;
  onQrCode(tenantId: string, callback: (qr: string) => void): void;
  onConnected(tenantId: string, callback: (phone: string) => void): void;
  onDisconnected(tenantId: string, callback: (reason: string) => void): void;
  onMessage(tenantId: string, callback: (msg: WaIncomingMessage) => void): void;
  /** فيه إعادة اتصال تلقائي متجدولة (عشان مراقب الصحة مايبدأش اتصال تاني فوقها) */
  isReconnecting(tenantId: string): boolean;
}

export const WA_PROVIDER = Symbol('IWaProvider');

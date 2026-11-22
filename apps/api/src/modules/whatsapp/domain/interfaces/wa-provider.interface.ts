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

export interface IWaProvider {
  connect(tenantId: string): Promise<void>;
  disconnect(tenantId: string): Promise<void>;
  logout(tenantId: string): Promise<void>;
  getConnectionState(tenantId: string): Promise<WaConnectionState>;
  sendMessage(tenantId: string, phone: string, body: string): Promise<WaSendResult>;
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
  onMessage(tenantId: string, callback: (phone: string, body: string) => void): void;
}

export const WA_PROVIDER = Symbol('IWaProvider');

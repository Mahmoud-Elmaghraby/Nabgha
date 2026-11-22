export type WaSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'banned';

export class WaSessionEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public phone: string | null,
    public status: WaSessionStatus,
    public qrCode: string | null,
    public qrExpiresAt: Date | null,
    public connectedAt: Date | null,
    public warmupStartedAt: Date | null,
    public warmupDay: number,
    public isBanned: boolean,
    public bannedUntil: Date | null,
    public lastHealthCheck: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  get isConnected(): boolean {
    return this.status === 'connected';
  }

  // بيرجع الحد اليومي الفعلي: أثناء فترة التسخين بيصعد تدريجياً، وبعدها بيستخدم
  // الحد اللي المستخدم حدده في الإعدادات فعلياً.
  // بنحسب يوم التسخين من الوقت الفعلي المنقضي من warmupStartedAt، مش من warmupDay
  // المُخزّن (اللي بيتحدث بواسطة cron يومي بيشترط إن الجلسة تكون متصلة بالظبط وقت
  // نص الليل) — عشان لو الجلسة قطعت واتصلت تاني قبل/بعد نص الليل بيوم واحد،
  // التسخين يفضل يتقدم طبيعي مع الوقت بدل ما يتجمد عند نفس اليوم لأجل غير مسمى.
  getCurrentDailyLimit(targetLimit: number, warmupEnabled = true): number {
    if (!warmupEnabled) return targetLimit;
    if (!this.warmupStartedAt) return Math.min(10, targetLimit);
    const warmupCurve = [10, 10, 25, 25, 25, 50, 50, 50, 50, 50];
    const elapsedMs = Date.now() - this.warmupStartedAt.getTime();
    const elapsedDays = Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
    const day = Math.min(elapsedDays, warmupCurve.length - 1);
    return Math.min(warmupCurve[day], targetLimit);
  }

  get isWarmingUp(): boolean {
    return this.warmupDay < 10;
  }

  markConnected(phone: string): void {
    this.phone = phone;
    this.status = 'connected';
    this.connectedAt = new Date();
    this.isBanned = false;
    this.bannedUntil = null;
    if (!this.warmupStartedAt) {
      this.warmupStartedAt = new Date();
      this.warmupDay = 0;
    }
    this.updatedAt = new Date();
  }

  markDisconnected(): void {
    this.status = 'disconnected';
    this.updatedAt = new Date();
  }

  markBanned(): void {
    this.status = 'banned';
    this.isBanned = true;
    this.bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.updatedAt = new Date();
  }

  incrementWarmupDay(): void {
    this.warmupDay += 1;
    this.updatedAt = new Date();
  }

  setQrCode(qr: string): void {
    this.qrCode = qr;
    this.qrExpiresAt = new Date(Date.now() + 60 * 1000);
    this.status = 'connecting';
    this.updatedAt = new Date();
  }

  clearQrCode(): void {
    this.qrCode = null;
    this.qrExpiresAt = null;
    this.updatedAt = new Date();
  }
}

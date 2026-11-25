/** "من 3 ساعات" / "من يومين" — لعرض عمر آخر نسخة احتياطية (BACKUP-007) */
export function backupAge(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'من أقل من دقيقة';
  if (minutes < 60) return minutes === 1 ? 'من دقيقة' : minutes === 2 ? 'من دقيقتين' : `من ${minutes.toLocaleString('ar-EG')} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'من ساعة' : hours === 2 ? 'من ساعتين' : `من ${hours.toLocaleString('ar-EG')} ساعات`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'من يوم' : days === 2 ? 'من يومين' : `من ${days.toLocaleString('ar-EG')} أيام`;
}

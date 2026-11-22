import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { buildAttendanceMessage, playAttendanceWarningAlarm } from '../lib/attendanceAlerts';
import type { AttendanceAlertMessage } from '../lib/attendanceAlerts';

interface ScanResult {
  studentId?: string;
  studentName?: string;
  isUnpaid?: boolean;
  wasPrevAbsent?: boolean;
  alreadyMarked?: boolean;
  error?: string;
}

// نفس الكارت لو فضل قدام الكاميرا مايتسكّنش تاني إلا بعد المدة دي
const SAME_CODE_WINDOW_MS = 8000;

interface Props {
  onScan: (qrCode: string) => Promise<ScanResult | void>;
  onClose: () => void;
}

export function QrCameraScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [scanMsg, setScanMsg] = useState<AttendanceAlertMessage | null>(null);
  const cooldownRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  // AudioContext واحد بس — المتصفح ليه حد، وكان بيتعمل واحد جديد مع كل سكان فالصوت بيقف بعد شوية
  const audioRef = useRef<AudioContext | null>(null);
  const beep = (freq: number) => {
    try {
      const ctx = audioRef.current ?? (audioRef.current = new AudioContext());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      osc.frequency.value = freq;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* الصوت اختياري */ }
  };
  const containerId = 'qr-camera-container';

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (cooldownRef.current) return;
        const now = Date.now();
        const last = lastCodeRef.current;
        if (last && last.code === decodedText && now - last.at < SAME_CODE_WINDOW_MS) return;
        lastCodeRef.current = { code: decodedText, at: now };
        cooldownRef.current = true;
        let ok = false;
        try {
          const result = await onScan(decodedText);
          ok = !!result?.studentId;
          if (result?.alreadyMarked) {
            setScanMsg({ text: `ℹ️ ${result.studentName} — متسجّل قبل كده`, level: 'success' });
            setTimeout(() => setScanMsg(null), 2500);
          } else if (result?.studentId) {
            const msg = buildAttendanceMessage(result.studentName ?? '', {
              isUnpaid: !!result.isUnpaid, wasPrevAbsent: !!result.wasPrevAbsent,
            });
            setScanMsg(msg);
            if (msg.level === 'warning') {
              // صوت إنذار مختلف — تفضل الرسالة ظاهرة لحد السكان اللي بعده (مفيش تايمر إخفاء)
              playAttendanceWarningAlarm();
            } else {
              setTimeout(() => setScanMsg(null), 2500);
            }
          } else {
            setScanMsg({ text: `❌ ${result?.error || 'QR غير صحيح أو غير مسجل'}`, level: 'error' });
            setTimeout(() => setScanMsg(null), 3000);
          }
        } catch {
          setScanMsg({ text: '❌ QR غير صحيح أو غير مسجل', level: 'error' });
          setTimeout(() => setScanMsg(null), 2500);
        }
        beep(ok ? 880 : 300);
        // cooldown ثانية واحدة بين كل سكان
        setTimeout(() => { cooldownRef.current = false; }, 1500);
      },
      () => {}
    ).then(() => {
      setIsStarting(false);
    }).catch(() => {
      setError('تعذر فتح الكاميرا — تأكد من منح الإذن');
      setIsStarting(false);
    });

    return () => {
      try { scanner.stop().catch(() => {}); } catch {}
      audioRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white text-sm font-medium">سكان QR الطلاب</p>
        <button onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={onClose} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm">إغلاق</button>
          </div>
        ) : (
          <>
            {isStarting && <p className="text-white/60 text-sm animate-pulse">جاري تشغيل الكاميرا...</p>}
            <div className="relative">
              <div id={containerId} className="rounded-2xl overflow-hidden" style={{ width: 300, height: 300 }} />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
              </div>
            </div>
            {scanMsg && (
              <div className={`px-6 py-3 rounded-2xl text-sm font-bold text-white ${
                scanMsg.level === 'warning' ? 'bg-amber-500' : scanMsg.level === 'error' ? 'bg-red-500' : 'bg-emerald-500'
              }`}>
                {scanMsg.text}
              </div>
            )}
            {!scanMsg && <p className="text-white/60 text-sm">وجّه الكاميرا نحو QR الطالب</p>}
          </>
        )}
      </div>
    </div>
  );
}

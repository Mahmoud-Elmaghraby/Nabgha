import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpinnerStudent } from '../api/spinner.api';

interface Props {
  students: SpinnerStudent[];
  /** الفايز مايدخلش اللفّات الجاية */
  removeWinners: boolean;
  soundOn: boolean;
  onWinner?: (winner: SpinnerStudent) => void;
}

// ألوان القطاعات بالتبادل (ألوان نبغة)
const COLORS = ['#0E3B2E', '#D4AB53', '#1F6B4E', '#E9D8A6', '#2F7D62', '#B8893A', '#3B5B4F', '#F1E4C3'];
const LIGHT = new Set(['#D4AB53', '#E9D8A6', '#B8893A', '#F1E4C3']);

const SIZE = 320;
const C = SIZE / 2;
const R = C - 8;
const SPIN_MS = 6500;

/** رقم عشوائي آمن (crypto.getRandomValues) ومن غير انحياز — عشان القرعة تبقى عادلة فعلاً */
function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

function polar(angleDeg: number, radius: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function shortName(full: string, max: number): string {
  const two = full.trim().split(/\s+/).slice(0, 2).join(' ');
  return two.length > max ? two.slice(0, max - 1) + '…' : two;
}

/** زاوية الدوران الفعلية أثناء الحركة (من الـ transform matrix) */
function currentAngle(el: SVGGElement | null): number {
  if (!el) return 0;
  const m = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(Number);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

const pickColor = (i: number, n: number) =>
  // لو آخر قطاع هيبقى نفس لون أول قطاع (جنب بعض في الدايرة) نغيّره
  i === n - 1 && n > 1 && (n - 1) % COLORS.length === 0 ? COLORS[2] : COLORS[i % COLORS.length];

export function SpinWheel({ students, removeWinners, soundOn, onWinner }: Props) {
  const [removed, setRemoved]   = useState<Set<string>>(new Set());
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pointerName, setPointerName] = useState<string | null>(null);
  const [winner, setWinner]     = useState<SpinnerStudent | null>(null);
  const groupRef = useRef<SVGGElement>(null);
  const rafRef   = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const audioRef = useRef<AudioContext | null>(null);

  // الفايز بيفضل ظاهر على العجلة لحد اللفّة الجاية، وبعدين بيتشال
  const active = useMemo(
    () => (removeWinners ? students.filter((s) => !removed.has(s.id)) : students),
    [students, removed, removeWinners],
  );
  const n = active.length;
  const slice = n > 0 ? 360 / n : 360;
  const showLabels = n <= 40;
  const fontSize = n <= 8 ? 14 : n <= 16 ? 12 : n <= 26 ? 10 : 8;
  const maxChars = n <= 8 ? 16 : n <= 16 ? 14 : 12;

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); clearTimeout(timerRef.current); }, []);

  const tick = () => {
    if (!soundOn) return;
    try {
      const ctx = audioRef.current ?? (audioRef.current = new AudioContext());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 1300;
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.05);
    } catch { /* الصوت اختياري */ }
  };

  const remaining = removeWinners && winner ? n - 1 : n;

  const handleSpin = () => {
    if (spinning) return;
    // نشيل الفايز اللي فات (لو الاختيار شغال) قبل اللفّة الجديدة
    let pool = active;
    if (removeWinners && winner) {
      const next = new Set(removed).add(winner.id);
      setRemoved(next);
      pool = students.filter((s) => !next.has(s.id));
    }
    if (pool.length === 0) return;
    const count = pool.length;
    const sl = 360 / count;

    setWinner(null);
    setSpinning(true);

    // الفايز بيتحدد الأول (عشوائي عادل) والعجلة بتقف على قطاعه هو بالظبط
    const idx = secureRandomInt(count);
    const chosen = pool[idx];
    const center = (idx + 0.5) * sl;
    const jitter = (Math.random() - 0.5) * sl * 0.6;
    const base = rotation - (rotation % 360);
    const target = base + 360 * (6 + secureRandomInt(3)) + ((360 - center - jitter + 720) % 360);
    // frame عشان العجلة ترسم القائمة الجديدة قبل ما تبدأ تلف
    requestAnimationFrame(() => setRotation(target));

    // الاسم اللي تحت المؤشر فعلاً بيتحدّث مع الحركة
    let last = -1;
    const loop = () => {
      const ang = currentAngle(groupRef.current);
      const under = Math.floor((((360 - ang) % 360) + 360) % 360 / sl) % count;
      if (under !== last) {
        last = under;
        setPointerName(pool[under]?.fullName ?? null);
        tick();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    timerRef.current = window.setTimeout(() => {
      cancelAnimationFrame(rafRef.current);
      setPointerName(chosen.fullName);
      setWinner(chosen);
      setSpinning(false);
      onWinner?.(chosen);
    }, SPIN_MS + 120);
  };

  if (students.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">لا يوجد طلاب متاحين للاختيار حالياً</div>;
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* الاسم */}
      <div className={`min-h-[72px] w-full max-w-md rounded-2xl px-5 py-3 text-center border-2 transition-all ${
        winner ? 'border-[#D4AB53] bg-[#D4AB53]/10 scale-105 shadow-lg' : 'border-gray-200 bg-white'
      }`}>
        {winner ? (
          <>
            <div className="text-xs font-bold text-[#B8893A] mb-0.5">🎉 الفايز</div>
            <div className="text-2xl sm:text-4xl font-black text-[#0E3B2E] leading-tight">{winner.fullName}</div>
          </>
        ) : (
          <div className={`text-xl sm:text-2xl font-bold pt-2.5 ${spinning ? 'text-[#0E3B2E]' : 'text-gray-400'}`}>
            {spinning ? pointerName ?? '…' : 'اضغط لف العجلة'}
          </div>
        )}
      </div>

      {/* العجلة */}
      <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 drop-shadow-md">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-[#D4AB53]" />
        </div>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
          <circle cx={C} cy={C} r={R + 6} fill="#0E3B2E" />
          <g
            ref={groupRef}
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${C}px ${C}px`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.1, 1)` : 'none',
            }}
          >
            {n === 1 ? (
              <g>
                <circle cx={C} cy={C} r={R} fill={COLORS[0]} />
                <text x={C} y={C - 50} textAnchor="middle" fontSize={16} fontWeight={700} fill="#fff"
                  style={{ fontFamily: 'Cairo, sans-serif' }}>{shortName(active[0].fullName, 18)}</text>
              </g>
            ) : active.map((s, i) => {
              const a0 = i * slice;
              const [x0, y0] = polar(a0, R);
              const [x1, y1] = polar(a0 + slice, R);
              const color = pickColor(i, n);
              const dim = winner && s.id !== winner.id;
              return (
                <g key={s.id} opacity={dim ? 0.5 : 1}>
                  <path d={`M${C},${C} L${x0},${y0} A${R},${R} 0 ${slice > 180 ? 1 : 0} 1 ${x1},${y1} Z`}
                    fill={color} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={n > 60 ? 0.3 : 1} />
                  {showLabels && (
                    <text
                      // النص الشمال بيتقلب 180° عشان مايبقاش مقلوب
                      transform={`rotate(${a0 + slice / 2 > 180 ? a0 + slice / 2 + 90 : a0 + slice / 2 - 90} ${C} ${C})`}
                      x={a0 + slice / 2 > 180 ? C - R + 12 : C + R - 12} y={C} dy="0.35em"
                      textAnchor={a0 + slice / 2 > 180 ? 'end' : 'start'} direction="rtl"
                      fontSize={fontSize} fontWeight={700} fill={LIGHT.has(color) ? '#0E3B2E' : '#FFFFFF'}
                      style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}
                    >
                      {shortName(s.fullName, maxChars)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={C} cy={C} r={26} fill="#0E3B2E" stroke="#D4AB53" strokeWidth={4} />
          <text x={C} y={C} dy="0.35em" textAnchor="middle" fontSize={12} fontWeight={800} fill="#D4AB53"
            style={{ fontFamily: 'Cairo, sans-serif' }}>{n}</text>
        </svg>
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning || remaining <= 0}
        className="px-10 py-3.5 text-lg font-black bg-[#D4AB53] text-[#0E3B2E] rounded-full shadow-lg hover:brightness-95 disabled:opacity-50 transition active:scale-95"
      >
        {spinning ? 'بتلف…' : remaining <= 0 ? 'كل الطلاب اتختاروا' : winner ? '🎯 لفّة تانية' : '🎯 لف العجلة'}
      </button>
      {!showLabels && <p className="text-xs text-gray-400">العدد كبير ({n} طالب) — الاسم بيظهر فوق العجلة وهي بتلف</p>}
    </div>
  );
}

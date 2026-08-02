import { useState, useRef } from 'react';
import type { SpinnerStudent } from '../api/spinner.api';

interface Props {
  students: SpinnerStudent[];
  onWinnerSelected?: (winner: SpinnerStudent) => void;
}

// 8 ألوان ثابتة للعجلة — زخرفية بحتة، مش مرتبطة بعدد الطلاب خالص
const SLICE_COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#BA7517', '#378ADD', '#639922', '#888780'];

// نقاط 8 قطاعات متساوية على دائرة نصف قطرها 100، مركزها (110,110) — محسوبة مسبقاً (زوايا كل 45 درجة)
const SLICE_POINTS = [
  [110, 10], [180.71, 39.29], [210, 110], [180.71, 180.71],
  [110, 210], [39.29, 180.71], [10, 110], [39.29, 39.29],
];

export function SpinWheel({ students, onWinnerSelected }: Props) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState('اضغط لف العجلة');
  const [landed, setLanded] = useState(false);
  const winnerRef = useRef<SpinnerStudent | null>(null);

  const count = students.length;

  const handleSpin = () => {
    if (spinning || count === 0) return;
    setSpinning(true);
    setLanded(false);

    // اختيار الفايز الحقيقي فوراً (قبل بداية الحركة)، والحركة كلها بعد كده بصرية بس
    const winnerIndex = Math.floor(Math.random() * count);
    const winner = students[winnerIndex];
    winnerRef.current = winner;

    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const newRotation = rotation + 360 * extraSpins + Math.floor(Math.random() * 360);
    setRotation(newRotation);

    // خانة الاسم: تيك-تاك متسارع في الأول ومتباطئ تدريجياً (زي عداد الحظ)
    const delays: number[] = [];
    let d = 55, total = 0;
    while (total < 4000) { delays.push(d); total += d; d *= 1.16; }

    let idx = 0;
    const tick = () => {
      if (idx >= delays.length - 1) {
        setDisplayName(winner.fullName);
        setLanded(true);
        setSpinning(false);
        onWinnerSelected?.(winner);
        return;
      }
      setDisplayName(students[Math.floor(Math.random() * count)].fullName);
      idx++;
      setTimeout(tick, delays[idx]);
    };
    tick();
  };

  if (count === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        لا يوجد طلاب متاحين للاختيار حالياً
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`rounded-xl px-4 py-3.5 text-lg font-bold border-2 transition-colors min-w-[220px] text-center ${
          landed ? 'border-[#1D9E75] text-[#1D9E75] bg-[#1D9E75]/5' : 'border-gray-200 text-gray-500'
        }`}
      >
        {displayName}
      </div>

      <div className="relative w-56 h-56">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-[#222]" />
        </div>
        <svg viewBox="0 0 220 220" className="w-full h-full">
          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: '110px 110px',
              transition: spinning ? 'transform 4s cubic-bezier(0.12, 0.67, 0.15, 1)' : 'none',
            }}
          >
            {SLICE_POINTS.map((p, i) => {
              const next = SLICE_POINTS[(i + 1) % SLICE_POINTS.length];
              return (
                <path
                  key={i}
                  d={`M110,110 L${p[0]},${p[1]} A100,100 0 0 1 ${next[0]},${next[1]} Z`}
                  fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className="px-8 py-3 text-lg font-bold bg-[#D4AB53] text-white rounded-full shadow-lg hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
      >
        {spinning ? 'جاري الدوران...' : '🎯 لف العجلة'}
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Quote, MapPin, Mic } from 'lucide-react';
import { TESTIMONIALS, STATS, type Testimonial } from './landing.config';

// ─── قسم "مدرسين بيشتغلوا بنبغة" ───────────────────────────
// كروت فيها صورة + اسم + مادة + تسجيل صوتي بصوت المدرس نفسه.
// تسجيل واحد بس بيشتغل في المرة (لو شغّلت تاني الأول بيقف).

const PALETTE = ['#0E3B2E', '#1F6B4E', '#2F7D62', '#8A6D2B', '#3B5B4F'];

function initials(name: string): string {
  const clean = name.replace(/^(أ\/|أ\.|م\/|د\/|د\.|الأستاذ|الأستاذة|مستر|مس)\s*/u, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Avatar({ t, index }: { t: Testimonial; index: number }) {
  const [broken, setBroken] = useState(false);
  if (t.photo && !broken) {
    return (
      <img src={t.photo} alt={t.name} loading="lazy" onError={() => setBroken(true)}
        className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md" />
    );
  }
  return (
    <div className="w-16 h-16 rounded-2xl ring-4 ring-white shadow-md flex items-center justify-center text-xl font-black text-[#D4AB53]"
      style={{ backgroundColor: PALETTE[index % PALETTE.length] }}>
      {initials(t.name)}
    </div>
  );
}

function VoicePlayer({ src, id, activeId, onPlay }: {
  src: string; id: number; activeId: number | null; onPlay: (id: number) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [time, setTime]         = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed]     = useState(false);

  // لو تسجيل تاني اشتغل، الحالي يقف
  useEffect(() => {
    if (activeId !== id && ref.current && !ref.current.paused) ref.current.pause();
  }, [activeId, id]);

  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      onPlay(id);
      try { await a.play(); } catch { setFailed(true); }
    } else {
      a.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // RTL: البداية على اليمين
    const ratio = (rect.right - e.clientX) / rect.width;
    a.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
  };

  if (failed) return null;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#0E3B2E]/[0.04] border border-[#0E3B2E]/10 px-3 py-2.5">
      <button onClick={toggle} aria-label={playing ? 'إيقاف' : 'اسمع تجربته'}
        className="w-10 h-10 shrink-0 rounded-full bg-[#0E3B2E] text-[#D4AB53] flex items-center justify-center hover:scale-105 transition shadow">
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 -mr-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span className="flex items-center gap-1 font-semibold text-[#1F6B4E]">
            <Mic className="w-3 h-3" /> {playing || time > 0 ? 'بيتكلم عن تجربته' : 'اسمع تجربته بصوته'}
          </span>
          {(time > 0 || duration > 0) && <span dir="ltr">{fmt(time > 0 ? time : duration)}</span>}
        </div>
        <div className="h-1.5 rounded-full bg-[#0E3B2E]/10 cursor-pointer overflow-hidden" onClick={seek}>
          <div className="h-full bg-[#D4AB53] rounded-full transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio ref={ref} src={src} preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)} />
    </div>
  );
}

export function Testimonials() {
  const [activeId, setActiveId] = useState<number | null>(null);
  if (TESTIMONIALS.length === 0 && STATS.length === 0) return null;

  return (
    <section id="teachers" className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
      <div className="text-center mb-10">
        <span className="text-xs font-bold text-[#1F6B4E] bg-[#1F6B4E]/10 px-3 py-1 rounded-full">مدرسين زيّك</span>
        <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] mt-4 mb-3">مدرسين بيشتغلوا بنبغة كل يوم</h2>
        <p className="text-gray-500">مش كلامنا… اسمعها منهم</p>
      </div>

      {STATS.length > 0 && (
        <div className={`grid gap-3 mb-10 ${STATS.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${STATS.length >= 4 ? 'sm:grid-cols-4' : ''}`}>
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white border border-gray-100 py-5 text-center shadow-sm">
              <div className="text-xl sm:text-3xl font-black text-[#0E3B2E]" dir="ltr">{s.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {TESTIMONIALS.length > 0 && (
        <div className={`grid gap-5 ${TESTIMONIALS.length === 1 ? 'max-w-md mx-auto' : TESTIMONIALS.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {TESTIMONIALS.map((t, i) => (
            <article key={t.name + i} className="relative rounded-3xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition flex flex-col gap-4">
              <Quote className="absolute top-5 left-5 w-8 h-8 text-[#D4AB53]/25" />
              <div className="flex items-center gap-4">
                <Avatar t={t} index={i} />
                <div className="min-w-0">
                  <h3 className="font-black text-[#0E3B2E] text-lg leading-tight">{t.name}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {t.subject}{t.stage ? ` — ${t.stage}` : ''}
                  </p>
                  {(t.area || t.since) && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      {t.area && <><MapPin className="w-3 h-3" />{t.area}</>}
                      {t.area && t.since && <span className="mx-1">•</span>}
                      {t.since && <span>مع نبغة من {t.since}</span>}
                    </p>
                  )}
                </div>
              </div>
              {t.quote && (
                <p className="text-gray-700 leading-relaxed text-[15px]">«{t.quote}»</p>
              )}
              {t.audio && (
                <div className="mt-auto">
                  <VoicePlayer src={t.audio} id={i} activeId={activeId} onPlay={setActiveId} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

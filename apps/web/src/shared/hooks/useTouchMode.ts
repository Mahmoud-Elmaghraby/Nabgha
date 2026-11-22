import { useCallback, useEffect, useState } from 'react';

// وضع الشاشة التفاعلية: أزرار وحقول أكبر + منع تكبير اللمس المزدوج + ملء الشاشة.
// auto = يتفعّل لوحده لو الجهاز بيشتغل باللمس (pointer: coarse).
export type TouchPref = 'auto' | 'on' | 'off';
const KEY = 'nabgha_touch_mode';

function readPref(): TouchPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch { /* ignore */ }
  return 'auto';
}

export function useTouchMode() {
  const [pref, setPrefState] = useState<TouchPref>(readPref);
  const [coarse, setCoarse] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)');
    if (!mq) return;
    const h = () => setCoarse(mq.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const touchActive = pref === 'on' || (pref === 'auto' && coarse);

  useEffect(() => {
    document.documentElement.classList.toggle('touch-ui', touchActive);
  }, [touchActive]);

  const setPref = useCallback((next: TouchPref) => {
    setPrefState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  const toggleTouch = useCallback(() => setPref(touchActive ? 'off' : 'on'), [touchActive, setPref]);

  const fullscreenSupported = !!document.documentElement.requestFullscreen;
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }, []);

  return { touchActive, toggleTouch, isFullscreen, fullscreenSupported, toggleFullscreen };
}

import { useState, useCallback } from 'react';

export type LayoutMode = 'navbar' | 'sidebar';

const STORAGE_KEY = 'nabgha_layout_mode';

function getInitialMode(): LayoutMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'navbar' || stored === 'sidebar') return stored;
  } catch { /* ignore */ }
  return 'navbar'; // الافتراضي: ناف بار أفقي
}

export function useLayoutPreference() {
  const [mode, setModeState] = useState<LayoutMode>(getInitialMode);

  const setMode = useCallback((next: LayoutMode) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setModeState(prev => {
      const next: LayoutMode = prev === 'navbar' ? 'sidebar' : 'navbar';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { mode, setMode, toggle };
}

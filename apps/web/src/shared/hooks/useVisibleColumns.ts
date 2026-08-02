import { useState, useEffect, useCallback } from 'react';
import { settingsApi } from '@/features/settings/api/settings.api';

export function useVisibleColumns(moduleName: string, defaultVisible: string[]) {
  const [visible, setVisible] = useState<Set<string>>(new Set(defaultVisible));

  useEffect(() => {
    let cancelled = false;
    settingsApi.getVisibleColumns(moduleName).then((res) => {
      if (cancelled) return;
      const saved = res.data?.data;
      if (Array.isArray(saved) && saved.length > 0) {
        setVisible(new Set(saved));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [moduleName]);

  const toggle = useCallback((key: string) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    await settingsApi.saveVisibleColumns(moduleName, Array.from(visible));
  }, [moduleName, visible]);

  return { visible, toggle, save };
}

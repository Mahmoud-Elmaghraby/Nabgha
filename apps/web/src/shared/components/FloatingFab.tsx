import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { useToast } from './Toast';

interface OngoingSession {
  id: string;
  title: string;
  groupName: string;
  status: string;
}

export function FloatingFab() {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [position, setPosition] = useState(() => ({ x: 16, y: window.innerHeight - 180 }));
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const moved = useRef(false);

  const { data: ongoingSessions = [] } = useQuery({
    queryKey: ['ongoing-sessions-fab'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions?status=ongoing&limit=10');
      return (res.data.data?.data ?? []) as OngoingSession[];
    },
    refetchInterval: 30_000,
    retry: false,
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStart.current.px + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStart.current.py + dy));
    setPosition({ x: newX, y: newY });
  }, []);

  const handleUp = useCallback(() => {
    dragStart.current = null;
    setDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    moved.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y };
    setDragging(true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    moved.current = false;
    const t = e.touches[0];
    dragStart.current = { mx: t.clientX, my: t.clientY, px: position.x, py: position.y };
    setDragging(true);

    const handleTouchMove = (ev: TouchEvent) => {
      if (!dragStart.current) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - dragStart.current.mx;
      const dy = touch.clientY - dragStart.current.my;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
      const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStart.current.px + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStart.current.py + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      dragStart.current = null;
      setDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleClick = () => {
    if (moved.current) return;
    setOpen(prev => !prev);
    setShowSessions(false);
  };

  const handleCollect = () => {
    setOpen(false);
    navigate('/finance/collect');
  };

  const handleAttendance = () => {
    if (ongoingSessions.length === 0) {
      toast.info('لا توجد حصص جارية الآن');
      setOpen(false);
      return;
    }
    if (ongoingSessions.length === 1) {
      setOpen(false);
      navigate('/sessions?openAttendance=' + ongoingSessions[0].id);
      return;
    }
    setShowSessions(true);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowSessions(false); }} />
      )}

      <div
        className="fixed z-50"
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        {open && !showSessions && (
          <div className="absolute bottom-16 left-0 flex flex-col gap-2 items-start">
            <button onClick={handleCollect}
              className="flex items-center gap-2 bg-white text-[#0E3B2E] rounded-2xl px-4 py-2.5 shadow-lg border border-gray-100 text-sm font-bold whitespace-nowrap hover:bg-[#0E3B2E] hover:text-white transition-colors">
              <span className="text-base">💰</span>
              تحصيل سريع
            </button>
            <button onClick={handleAttendance}
              className="flex items-center gap-2 bg-white text-[#0E3B2E] rounded-2xl px-4 py-2.5 shadow-lg border border-gray-100 text-sm font-bold whitespace-nowrap hover:bg-[#0E3B2E] hover:text-white transition-colors">
              <span className="text-base">📋</span>
              حضور الحصة
              {ongoingSessions.length > 0 && (
                <span className="bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {ongoingSessions.length}
                </span>
              )}
            </button>
          </div>
        )}

        {open && showSessions && (
          <div className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-48">
            <p className="text-xs font-bold text-gray-500 px-4 py-2 border-b border-gray-50">اختر الحصة:</p>
            {ongoingSessions.map(s => (
              <button key={s.id} onClick={() => { setOpen(false); setShowSessions(false); navigate('/sessions?openAttendance=' + s.id); }}
                className="w-full flex flex-col px-4 py-3 hover:bg-gray-50 text-right border-b border-gray-50 last:border-0">
                <p className="text-sm font-medium text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-400">{s.groupName}</p>
              </button>
            ))}
          </div>
        )}

        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleClick}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-all select-none ${
            open ? 'bg-gray-700 rotate-45' : 'bg-[#0E3B2E]'
          } ${dragging ? 'scale-110 shadow-2xl' : 'hover:scale-105'}`}>
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </div>
    </>
  );
}

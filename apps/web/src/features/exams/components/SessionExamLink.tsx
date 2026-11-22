import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { examsApi } from '../api/exams.api';
import { useExams } from '../hooks/useExams';
import { PrintMenu } from './PrintMenu';

interface Props {
  sessionId: string;
  grade?:    string | null;
  /** المجموع الجديد بعد الربط — عشان شاشة الدرجات تتحقق بيه فوراً */
  onOutOfChange?: (outOf: number) => void;
}

/**
 * شريط صغير في شاشة رصد الدرجات: الامتحان المربوط بالحصة (طباعة / فك الربط)
 * أو اختيار امتحان من البنك — درجة الحصة النهائية بتبقى مجموع الامتحان.
 */
export function SessionExamLink({ sessionId, grade, onOutOfChange }: Props) {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('exams.view');
  const canEdit = hasPermission('exams.edit');

  const key = ['exams', 'by-session', sessionId];
  const { data: linked, isLoading } = useQuery({
    queryKey: key,
    queryFn:  () => examsApi.getSessionExam(sessionId),
    enabled:  canView && !!sessionId,
  });

  const [picking, setPicking] = useState(false);
  const [examId, setExamId]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  const { data: exams } = useExams({ limit: 100, grade: grade || undefined }, picking);

  if (!canView || isLoading) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['sessions'] });
  };

  const link = async () => {
    if (!examId) return;
    setBusy(true); setError('');
    try {
      const r = await examsApi.linkSession(examId, sessionId);
      onOutOfChange?.(r.outOf);
      setPicking(false); setExamId('');
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'تعذّر الربط');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm('فك ربط الامتحان بالحصة؟ الدرجات المتسجلة مش هتتأثر.')) return;
    setBusy(true);
    try { await examsApi.unlinkSession(sessionId); refresh(); } finally { setBusy(false); }
  };

  if (linked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 bg-emerald-50/60 border-b border-emerald-100 text-xs">
        <span className="text-emerald-900">
          📄 الامتحان: <strong>{linked.title}</strong> — من {linked.totalDegree} درجة
        </span>
        <div className="flex items-center gap-1.5">
          {hasPermission('exams.export') && <PrintMenu examId={linked.id} title={linked.title} compact />}
          {canEdit && (
            <button onClick={unlink} disabled={busy} className="px-2 py-1 text-gray-500 hover:text-red-600">فك الربط</button>
          )}
        </div>
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="px-5 py-2 border-b border-gray-100 text-xs space-y-1.5">
      {!picking ? (
        <button onClick={() => setPicking(true)} className="text-[#0E3B2E] hover:underline">
          + ربط بامتحان من البنك (الدرجة النهائية هتبقى مجموع الامتحان)
        </button>
      ) : (
        <div className="flex gap-2 items-center">
          <select value={examId} onChange={(e) => setExamId(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
            <option value="">اختار امتحان{grade ? ` (${grade})` : ''}...</option>
            {(exams?.data ?? []).filter((x) => x.totalDegree > 0).map((x) => (
              <option key={x.id} value={x.id}>
                {x.kind === 'quiz' ? '📝 ' : ''}{x.title} — {x.totalDegree} درجة
              </option>
            ))}
          </select>
          <button onClick={link} disabled={!examId || busy}
            className="px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg disabled:opacity-50">ربط</button>
          <button onClick={() => { setPicking(false); setError(''); }} className="px-2 py-1.5 text-gray-500">إلغاء</button>
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}

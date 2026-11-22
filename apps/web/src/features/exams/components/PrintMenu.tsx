import { useEffect, useRef, useState } from 'react';
import { examsApi } from '../api/exams.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { VERSION_KEYS, VERSION_LABELS, type VersionKey } from '../types/exam.types';

interface Props {
  examId:    string;
  title:     string;
  disabled?: boolean;
  /** بيتنادى قبل التحميل (مثلاً حفظ الأسئلة في المحرر الأول) */
  beforeExport?: () => Promise<void>;
  compact?:  boolean;
}

/**
 * قائمة الطباعة: الورقة الأصلية + نموذج الإجابة، أو نماذج مختلفة (أ/ب/ج/د)
 * كل نموذج بنفس الأسئلة بترتيب مختلف وليه نموذج إجابة خاص بيه.
 */
export function PrintMenu({ examId, title, disabled, beforeExport, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr]   = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const download = async (answerKey: boolean, version?: VersionKey) => {
    const key = `${version ?? '-'}:${answerKey ? 1 : 0}`;
    setBusy(key); setErr('');
    try {
      await beforeExport?.();
      const blob = await examsApi.exportPdf(examId, answerKey, version);
      const v = version ? ` - نموذج ${VERSION_LABELS[version]}` : '';
      downloadBlob(blob, `${title}${v}${answerKey ? ' - نموذج الإجابة' : ''}.pdf`);
    } catch {
      setErr('تعذّر التصدير — تأكد إن الامتحان فيه أسئلة');
    } finally {
      setBusy(null);
    }
  };

  const Item = ({ answerKey, version, label }: { answerKey: boolean; version?: VersionKey; label: string }) => {
    const key = `${version ?? '-'}:${answerKey ? 1 : 0}`;
    return (
      <button
        type="button"
        onClick={() => download(answerKey, version)}
        disabled={busy !== null}
        className={`flex-1 px-2.5 py-1.5 text-xs rounded-md border disabled:opacity-50 ${
          answerKey ? 'border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100' : 'border-gray-200 hover:bg-gray-50'
        }`}
      >
        {busy === key ? 'جاري...' : label}
      </button>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={`flex items-center gap-1 ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        طباعة PDF ▾
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 w-72 bg-white border border-gray-100 rounded-xl shadow-xl p-3 space-y-3" dir="rtl">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-gray-500">الورقة الأصلية</div>
            <div className="flex gap-1.5">
              <Item answerKey={false} label="ورقة الأسئلة" />
              <Item answerKey label="✓ نموذج الإجابة" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-gray-500">
              نماذج مختلفة <span className="font-normal text-gray-400">(ضد الغش — ترتيب أسئلة واختيارات مختلف)</span>
            </div>
            {VERSION_KEYS.map((v) => (
              <div key={v} className="flex items-center gap-1.5">
                <span className="w-14 text-xs text-gray-600">نموذج {VERSION_LABELS[v]}</span>
                <Item answerKey={false} version={v} label="الأسئلة" />
                <Item answerKey version={v} label="✓ الإجابة" />
              </div>
            ))}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
      )}
    </div>
  );
}

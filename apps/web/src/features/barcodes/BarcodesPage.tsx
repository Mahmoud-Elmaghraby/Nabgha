import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { generateLabelsPDF, generateCardsPDF, A4_LABEL_TEMPLATES, type A4LabelTemplateKey } from '@/shared/services/pdf/pdf.service';
import { useToast } from '@/shared/components/Toast';
import { LabelsPreviewModal } from './LabelsPreviewModal';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { DAY_LABELS } from '@/features/groups/types/group.types';
import type { StudentQRData } from '@/shared/services/pdf/pdf.service';
import { loadLabelStyle } from '@/shared/services/pdf/label-renderer';

function useStudentsSearch(q: string) {
  return useQuery({
    queryKey: ['barcodes-search', q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const res = await apiClient.get('/students', { params: { search: q, limit: 20 } });
      return res.data.data?.data ?? [];
    },
    enabled: q.trim().length >= 2,
  });
}

function useCardDesignerSettings() {
  return useQuery({
    queryKey: ['settings', 'card-designer'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/card-designer');
      return res.data.data;
    },
  });
}

function useCenterSettings() {
  return useQuery({
    queryKey: ['center-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/center');
      return res.data.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

type PrintMode = 'label-pdf' | 'label-print' | 'card-pdf';

export default function BarcodesPage() {
  const toast = useToast();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentQRData[]>([]);
  const [searchQ, setSearchQ] = useState('');
  // الطباعة المباشرة على طابعة الليبل هي الأكتر استخدام — بقت الافتراضي
  const [printMode, setPrintMode] = useState<PrintMode>('label-print');
  // عدد النسخ: رقم عام لكل الطلاب + تعديل لطالب معيّن (مثلاً معاه ملزمتين زيادة)
  const [defaultCopies, setDefaultCopies] = useState(1);
  const [copyOverrides, setCopyOverrides] = useState<Record<string, number>>({});
  const copiesOf = (id: string) => copyOverrides[id] ?? defaultCopies;
  const setStudentCopies = (id: string, n: number) =>
    setCopyOverrides(prev => ({ ...prev, [id]: Math.min(20, Math.max(1, n)) }));
  const copiesMap = Object.fromEntries(selectedStudents.map(s => [s.id, copiesOf(s.id)]));
  const totalLabels = selectedStudents.reduce((a, s) => a + copiesOf(s.id), 0);
  const [loading, setLoading] = useState(false);
  const [showLabelsPreview, setShowLabelsPreview] = useState(false);
  const [sheetKey, setSheetKey] = useState<A4LabelTemplateKey>(() => {
    try { return (localStorage.getItem('nabgha-a4-label-sheet') as A4LabelTemplateKey) || '3x4'; } catch { return '3x4'; }
  });
  const pickSheet = (k: A4LabelTemplateKey) => {
    setSheetKey(k);
    try { localStorage.setItem('nabgha-a4-label-sheet', k); } catch { /* ignore */ }
  };

  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];
  const { data: searchResults = [] } = useStudentsSearch(searchQ);
  const { data: cardSettings } = useCardDesignerSettings();
  const { data: centerSettings } = useCenterSettings();

  const getGroupLabel = (g: any) => {
    let schedulePart = '';
    if (g.schedule && g.schedule.length > 0) {
      schedulePart = g.schedule.map((s: any) => `${DAY_LABELS[s.day as keyof typeof DAY_LABELS]} ${s.startTime}`).join('، ');
    }
    return [g.subjectGradeLabel, schedulePart].filter(Boolean).join(' | ');
  };

  const centerName = centerSettings?.centerName || 'نبغة';

  // كل طالب بيتعلّم بالمجموعات اللي جه منها — لو مجموعة اتشالت والطالب في مجموعة تانية
  // متختارة يفضل موجود (قبل كده كان بيتشال)، والطالب اللي اتضاف بالبحث مابيتشالش أبداً
  const toggleGroup = async (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(g => g !== groupId));
      setSelectedStudents(prev => prev.flatMap((s: any) => {
        if (!s.fromGroup?.includes(groupId)) return [s];
        const rest = s.fromGroup.filter((g: string) => g !== groupId);
        return rest.length > 0 || s.manual ? [{ ...s, fromGroup: rest }] : [];
      }));
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
      try {
        const res = await apiClient.get(`/groups/${groupId}/students`);
        const students = (res.data.data ?? [])
          .filter((s: any) => s.isActive !== false) // الموقوفين مالهمش كارت
          .map((s: any) => ({
            id: s.studentId || s.id,
            studentCode: s.studentCode,
            fullName: s.studentName || s.fullName,
            grade: s.grade,
            fromGroup: [groupId],
          }));
        setSelectedStudents(prev => {
          const byId = new Map(prev.map((s: any) => [s.id, s]));
          const merged = prev.map((s: any) => {
            const hit = students.find((x: any) => x.id === s.id);
            return hit ? { ...s, fromGroup: [...(s.fromGroup ?? []), groupId] } : s;
          });
          return [...merged, ...students.filter((s: StudentQRData) => !byId.has(s.id))];
        });
      } catch {
        toast.error('تعذّر تحميل طلاب المجموعة');
        setSelectedGroups(prev => prev.filter(g => g !== groupId));
      }
    }
  };

  const addFromSearch = (student: any) => {
    if (!selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        grade: student.grade,
        manual: true,
      } as StudentQRData]);
    } else {
      setSelectedStudents(prev => prev.map((s: any) => (s.id === student.id ? { ...s, manual: true } : s)));
    }
    setSearchQ('');
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const handlePrint = async () => {
    if (selectedStudents.length === 0) return;
    if (printMode === 'label-print') {
      setShowLabelsPreview(true);
      return;
    }
    setLoading(true);
    try {
      if (printMode === 'label-pdf') {
        const sheet = A4_LABEL_TEMPLATES.find(t => t.key === sheetKey) ?? A4_LABEL_TEMPLATES[0];
        const expanded = selectedStudents.flatMap(s => Array.from({ length: copiesOf(s.id) }, () => s));
        await generateLabelsPDF(expanded, {
          style: loadLabelStyle(),
          centerName,
          cols: sheet.cols, rows: sheet.rows,
          marginXmm: sheet.marginXmm, marginYmm: sheet.marginYmm,
          gapXmm: sheet.gapXmm, gapYmm: sheet.gapYmm,
        });
      } else if (printMode === 'card-pdf') {
        if (!cardSettings?.frontImage) {
          toast.error('لم يتم إعداد صورة الكارت — اذهب للإعدادات → إعداد الكارت');
          setLoading(false);
          return;
        }
        await generateCardsPDF(selectedStudents, {
          backgroundImage: cardSettings.frontImage,
          qr: {
            x: cardSettings.groupX,
            y: cardSettings.groupY,
            size: cardSettings.qrSize,
          },
          name: {
            x: cardSettings.groupX + cardSettings.qrSize + 6,
            y: cardSettings.groupY + cardSettings.qrSize * 0.3,
            fontSize: Math.round(cardSettings.qrSize * 0.18),
          },
          code: {
            x: cardSettings.groupX + cardSettings.qrSize + 6,
            y: cardSettings.groupY + cardSettings.qrSize * 0.6,
            fontSize: Math.round(cardSettings.qrSize * 0.13),
          },
          cardWidth: 85.6,
          cardHeight: 54,
          centerName,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التوليد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">طباعة الباركود</h1>
        <p className="text-xs text-gray-400">اختر الطلاب وطريقة الطباعة</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* طريقة الطباعة */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">طريقة الطباعة</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'label-print', icon: '🖨️', label: 'طباعة مباشرة', desc: 'طابعة الليبل' },
              { key: 'label-pdf', icon: '📄', label: 'ليبل PDF', desc: 'ورق استيكر A4' },
              { key: 'card-pdf', icon: '🪪', label: 'كارت PDF', desc: 'إعدادات الكارت' },
            ].map(m => (
              <button key={m.key} onClick={() => setPrintMode(m.key as PrintMode)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  printMode === m.key ? 'border-[#0E3B2E] bg-[#0E3B2E]/5' : 'border-gray-100 hover:border-gray-200'
                }`}>
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className="text-xs font-bold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400">{m.desc}</p>
              </button>
            ))}
          </div>
          {printMode === 'label-pdf' && (
            <div className="mt-3">
              <label className="text-xs text-gray-500 mb-1.5 block">نوع ورق الاستيكر (A4)</label>
              <select value={sheetKey} onChange={e => pickSheet(e.target.value as A4LabelTemplateKey)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {A4_LABEL_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">اطبع من الـ PDF بمقاس "الحجم الفعلي / 100%" مش "ملاءمة الصفحة"</p>
            </div>
          )}
          {printMode === 'card-pdf' && cardSettings?.frontImage && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl p-2">
              <span>✅</span>
              <span>إعدادات الكارت محملة — جاهز للطباعة</span>
            </div>
          )}
          {printMode === 'card-pdf' && !cardSettings?.frontImage && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-2">
              <span>⚠️</span>
              <span>لم يتم إعداد صورة الكارت — اذهب للإعدادات → إعداد الكارت</span>
            </div>
          )}
        </div>

        {/* اختيار المجموعات */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">اختر المجموعات</p>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد مجموعات</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {groups.map((g: any) => (
                <button key={g.id} onClick={() => toggleGroup(g.id)}
                  className={`px-3 py-2 rounded-xl text-sm border transition-all text-right flex flex-col items-start gap-1 w-full ${
                    selectedGroups.includes(g.id)
                      ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#0E3B2E]/30'
                  }`}>
                  <div className="font-bold flex w-full justify-between items-center">
                    <span>{g.name}</span>
                    {selectedGroups.includes(g.id) && <span>✓</span>}
                  </div>
                  {getGroupLabel(g) && (
                    <div className={`text-[11px] font-medium ${selectedGroups.includes(g.id) ? 'text-emerald-100' : 'text-gray-500'}`}>
                      {getGroupLabel(g)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* بحث عن طلاب */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">إضافة طلاب بالبحث</p>
          <div className="relative">
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="ابحث باسم الطالب أو الكود..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            {searchResults.length > 0 && searchQ.length >= 2 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
                {searchResults.map((s: any) => (
                  <button key={s.id} onClick={() => addFromSearch(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-right border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center text-[#0E3B2E] font-bold text-sm shrink-0">
                      {s.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.studentCode}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* الطلاب المختارين */}
        {selectedStudents.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-700">
                الطلاب المختارين ({selectedStudents.length})
                {printMode !== 'card-pdf' && totalLabels !== selectedStudents.length && (
                  <span className="text-xs font-normal text-gray-400"> — {totalLabels} ليبل</span>
                )}
              </p>
              <button onClick={() => { setSelectedStudents([]); setSelectedGroups([]); setCopyOverrides({}); }}
                className="text-xs text-red-500 hover:text-red-700">مسح الكل</button>
            </div>
            {printMode !== 'card-pdf' && (
              <div className="flex flex-wrap items-center gap-2 mb-3 text-sm bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-gray-600">عدد النسخ لكل طالب:</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDefaultCopies(c => Math.max(1, c - 1))} className="w-7 h-7 rounded-lg border border-gray-200 bg-white">−</button>
                  <span className="w-8 text-center font-bold text-[#0E3B2E]">{defaultCopies}</span>
                  <button onClick={() => setDefaultCopies(c => Math.min(20, c + 1))} className="w-7 h-7 rounded-lg border border-gray-200 bg-white">+</button>
                </div>
                <span className="text-xs text-gray-400">ولو طالب معاه ملازم أكتر غيّر عدده من جنب اسمه</span>
                {Object.keys(copyOverrides).length > 0 && (
                  <button onClick={() => setCopyOverrides({})} className="text-xs text-[#0E3B2E] underline mr-auto">رجّع الكل {defaultCopies}</button>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {selectedStudents.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 bg-[#0E3B2E]/5 border border-[#0E3B2E]/20 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800">{s.fullName}</span>
                  <span className="text-xs text-gray-400 font-mono">{s.studentCode}</span>
                  {printMode !== 'card-pdf' && (
                    <span className="flex items-center gap-0.5 mr-1 bg-white rounded-lg border border-gray-200">
                      <button onClick={() => setStudentCopies(s.id, copiesOf(s.id) - 1)} className="w-5 h-5 text-xs text-gray-500">−</button>
                      <span className={`text-xs font-bold min-w-[18px] text-center ${copiesOf(s.id) > 1 ? 'text-[#B8893A]' : 'text-gray-500'}`}>×{copiesOf(s.id)}</span>
                      <button onClick={() => setStudentCopies(s.id, copiesOf(s.id) + 1)} className="w-5 h-5 text-xs text-gray-500">+</button>
                    </span>
                  )}
                  <button onClick={() => removeStudent(s.id)} className="text-red-400 hover:text-red-600 text-sm mr-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* زرار الطباعة */}
        <button onClick={handlePrint} disabled={loading || selectedStudents.length === 0}
          className="w-full bg-[#0E3B2E] text-white rounded-2xl py-4 font-bold text-base disabled:opacity-50 hover:bg-[#1F6B4E] transition-colors flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري التوليد...
            </>
          ) : (
            <>
              {printMode === 'label-print' ? '🖨️ معاينة وطباعة' : '📄 توليد PDF'}
              {selectedStudents.length > 0 && (printMode === 'card-pdf'
                ? ` (${selectedStudents.length} طالب)`
                : ` (${totalLabels} ليبل)`)}
            </>
          )}
        </button>

      </div>

      {showLabelsPreview && (
        <LabelsPreviewModal
          students={selectedStudents}
          copies={copiesMap}
          centerName={centerName}
          onClose={() => setShowLabelsPreview(false)}
        />
      )}
    </div>
  );
}

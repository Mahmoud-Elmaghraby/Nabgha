import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { generateLabelsPDF, generateCardsPDF } from '@/shared/services/pdf/pdf.service';
import { useToast } from '@/shared/components/Toast';
import { LabelsPreviewModal } from './LabelsPreviewModal';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { DAY_LABELS } from '@/features/groups/types/group.types';
import type { StudentQRData } from '@/shared/services/pdf/pdf.service';

function useGroups() {
  return useQuery({
    queryKey: ['barcodes-groups'],
    queryFn: async () => {
      const res = await apiClient.get('/groups', { params: { limit: 1000 } });
      return res.data.data?.data ?? [];
    },
  });
}

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
  const [printMode, setPrintMode] = useState<PrintMode>('label-pdf');
  const [loading, setLoading] = useState(false);
  const [showLabelsPreview, setShowLabelsPreview] = useState(false);

  const { data: groups = [] } = useGroups();
  const { data: searchResults = [] } = useStudentsSearch(searchQ);
  const { data: cardSettings } = useCardDesignerSettings();
  const { data: centerSettings } = useCenterSettings();
  const { data: subjects = [] } = useSubjects();

  const getGroupLabel = (g: any) => {
    let subjectPart = '';
    if (g.subjectGradeId) {
      for (const item of subjects) {
        const grade = item.grades.find((x: any) => x.id === g.subjectGradeId);
        if (grade) {
          subjectPart = `${item.subject.name} - ${grade.grade}`;
          break;
        }
      }
    }

    let schedulePart = '';
    if (g.schedule && g.schedule.length > 0) {
      const times = g.schedule.map((s: any) => `${DAY_LABELS[s.day as keyof typeof DAY_LABELS]} ${s.startTime}`).join('، ');
      schedulePart = times;
    }

    return [subjectPart, schedulePart].filter(Boolean).join(' | ');
  };

  const centerName = centerSettings?.centerName || 'نبغة';

  const toggleGroup = async (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(g => g !== groupId));
      setSelectedStudents(prev => prev.filter(s => !(s as any).fromGroup?.includes(groupId)));
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
      try {
        const res = await apiClient.get(`/groups/${groupId}/students`);
        const students = (res.data.data ?? []).map((s: any) => ({
          id: s.studentId || s.id,
          studentCode: s.studentCode,
          fullName: s.studentName || s.fullName,
          grade: s.grade,
          fromGroup: [groupId],
        }));
        setSelectedStudents(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          return [...prev, ...students.filter((s: StudentQRData) => !existingIds.has(s.id))];
        });
      } catch {}
    }
  };

  const addFromSearch = (student: any) => {
    if (!selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        grade: student.grade,
      }]);
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
        await generateLabelsPDF(selectedStudents, { centerName });
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
              { key: 'label-pdf', icon: '📄', label: 'ليبل PDF', desc: 'A4 شبكة 3×4' },
              { key: 'label-print', icon: '🖨️', label: 'طباعة مباشرة', desc: 'Label Printer' },
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
              <p className="text-sm font-bold text-gray-700">الطلاب المختارين ({selectedStudents.length})</p>
              <button onClick={() => { setSelectedStudents([]); setSelectedGroups([]); }}
                className="text-xs text-red-500 hover:text-red-700">مسح الكل</button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {selectedStudents.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 bg-[#0E3B2E]/5 border border-[#0E3B2E]/20 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800">{s.fullName}</span>
                  <span className="text-xs text-gray-400 font-mono">{s.studentCode}</span>
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
              {printMode === 'label-print' ? '🖨️ طباعة مباشرة' : '📄 توليد PDF'}
              {selectedStudents.length > 0 && ` (${selectedStudents.length} طالب)`}
            </>
          )}
        </button>

      </div>

      {showLabelsPreview && (
        <LabelsPreviewModal
          students={selectedStudents}
          centerName={centerName}
          onClose={() => setShowLabelsPreview(false)}
        />
      )}
    </div>
  );
}

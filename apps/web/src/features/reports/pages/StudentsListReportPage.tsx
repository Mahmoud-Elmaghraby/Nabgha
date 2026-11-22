import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { GRADE_OPTIONS } from '@nabgha/types';
import { SectionDataTable } from '../components/SectionDataTable';

export default function StudentsListReportPage() {
  const { data: subjects = [] } = useSubjects();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const allGroups = groupsData?.data ?? [];
  const toast = useToast();
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isActive, setIsActive] = useState('');
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  // المجموعات المتاحة تتفلتر حسب الصف و/أو المادة المختارين — عن طريق حساب
  // كل subjectGradeId اللي بيطابق الاختيار الحالي (من بيانات المواد اللي فيها
  // كل صف مرتبط بمادة)، وبعدين نستبعد أي مجموعة مش مرتبطة بأي واحد منهم.
  const computeGroups = (gradeVal: string, subjectVal: string) => {
    if (!gradeVal && (!subjectVal || subjectVal === 'none')) return allGroups;
    const matchingIds = new Set(
      subjects
        .filter(s => !subjectVal || subjectVal === 'none' || s.subject.id === subjectVal)
        .flatMap(s => s.grades.filter(g => !gradeVal || g.grade === gradeVal).map(g => g.id))
    );
    return allGroups.filter(g => g.subjectGradeId && matchingIds.has(g.subjectGradeId));
  };
  const groups = computeGroups(grade, subjectId);

  // لو الصف/المادة اتغيروا وبقت المجموعة المختارة مش ضمن الخيارات المتاحة، نفضّيها
  const handleGradeChange = (v: string) => {
    setGrade(v);
    const next = computeGroups(v, subjectId);
    if (groupId && !next.some(g => g.id === groupId)) setGroupId('');
  };
  const handleSubjectChange = (v: string) => {
    setSubjectId(v);
    const next = computeGroups(grade, v);
    if (groupId && !next.some(g => g.id === groupId)) setGroupId('');
  };

  const params = {
    grade: grade || undefined,
    subjectId: subjectId || undefined,
    groupId: groupId || undefined,
    isActive: isActive || undefined,
  };

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'students-list', params],
    queryFn: () => reportsApi.preview('students-list', params),
    placeholderData: keepPreviousData,
  });

  const section = previewData?.sections?.[0];
  const hasRows = (section?.rows.length ?? 0) > 0;

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('students-list', params, format);
      downloadBlob(blob, `قائمة-الطلاب-${Date.now()}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-500 mb-1 block">المرحلة الدراسية</label>
              <select value={grade} onChange={e => handleGradeChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">كل المراحل</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-500 mb-1 block">المادة</label>
              <select value={subjectId} onChange={e => handleSubjectChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">كل المواد</option>
                <option value="none">بدون مجموعة</option>
                {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-500 mb-1 block">المجموعة</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">كل المجموعات</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">الحالة</label>
              <select value={isActive} onChange={e => setIsActive(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">الكل</option>
                <option value="true">نشط فقط</option>
                <option value="false">غير نشط فقط</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleGenerate('xlsx')} disabled={downloadLoading !== null || !hasRows}
                className="px-4 py-2 text-sm border border-[#0E3B2E] text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                {downloadLoading === 'xlsx' ? 'جاري...' : 'تحميل Excel'}
              </button>
              <button onClick={() => handleGenerate('pdf')} disabled={downloadLoading !== null || !hasRows}
                className="px-4 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50">
                {downloadLoading === 'pdf' ? 'جاري...' : 'تحميل PDF'}
              </button>
            </div>
          </div>

          {section && <SectionDataTable section={section} isLoading={isFetching && !previewData} showTitle={false} />}
        </div>

  );
}

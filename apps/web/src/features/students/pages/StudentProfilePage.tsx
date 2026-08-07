import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudent, useStudentGroups, useStudentMutations, useStudentAttendance } from '../hooks/useStudents';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useGroupMutations, useGroups } from '@/features/groups/hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useStudentFinancialProfile, useStudentPayments } from '@/features/finance/hooks/useFinance';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { StudentFormModal } from '../components/StudentFormModal';
import { StudentQrModal } from '../components/StudentQrModal';
import { apiClient } from '@/shared/lib/api/client';
import { DAY_LABELS } from '@/features/groups/types/group.types';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { DUE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/features/finance/types/finance.types';
import { ATTENDANCE_STATUS_LABELS, SESSION_TYPE_LABELS, type AttendanceStatus, type SessionType } from '@/features/sessions/types/session.types';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: student, isLoading } = useStudent(id!);
  const { data: studentGroups = [] } = useStudentGroups(id!);
  const { toggleActive, deleteStudent } = useStudentMutations();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const { addStudent, removeStudent, updateDiscount } = useGroupMutations();
  const [editingDiscountGroupId, setEditingDiscountGroupId] = useState<string | null>(null);
  const [editingDiscountValue, setEditingDiscountValue] = useState(0);
  const { data: allGroups } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();

  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [activeTab, setActiveTab] = useState<'groups' | 'finance' | 'attendance' | 'grades'>('groups');

  const { data: waStatus } = useQuery({
    queryKey: ['wa-status'],
    queryFn: async () => {
      const res = await apiClient.get('/whatsapp/status');
      const d = res.data.data;
      return { connected: d.status === 'connected' };
    },
    staleTime: 1000 * 30,
  });

  const { data: phoneCheck } = useQuery({
    queryKey: ['check-phone', student?.parentPhone],
    queryFn: async () => {
      const res = await apiClient.post('/whatsapp/check-phone', { phone: student!.parentPhone });
      return res.data.data as { exists: boolean };
    },
    enabled: !!student?.parentPhone,
    staleTime: 1000 * 60 * 5,
  });

  const { data: financialProfile, isLoading: loadingDues } = useStudentFinancialProfile(
    activeTab === 'finance' ? id! : ''
  );
  const { data: paymentsData, isLoading: loadingPayments } = useStudentPayments(
    activeTab === 'finance' ? id! : ''
  );

  // نفس الـ query بيتغذّى بيها تبويب "الحضور" وتبويب "الدرجات" مع بعض — الدرجات
  // أصلاً هي عمود degree/outOf على نفس سجل الحضور، مفيش داعي لـ endpoint جديد
  const { data: attendanceRecords = [], isLoading: loadingAttendance } = useStudentAttendance(
    id!, activeTab === 'attendance' || activeTab === 'grades'
  );

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">جاري التحميل...</div>
    </div>
  );

  if (!student) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">الطالب غير موجود</p>
    </div>
  );

  const enrolledGroupIds = new Set(studentGroups.map((g: any) => g.groupId));

  const availableGroups = (allGroups?.data || []).filter((g: any) => {
    if (!g.isActive) return false;
    if (enrolledGroupIds.has(g.id)) return false;
    if (!student) return false;
    if (!g.subjectGradeId) return true;
    if (!student.grade) return true;
    return g.subjectGradeLabel?.endsWith(` — ${student.grade}`) ?? true;
  });

  const handleDelete = async () => {
    if (!(await confirm('هل أنت متأكد من حذف هذا الطالب؟', { danger: true }))) return;
    try {
      await deleteStudent.mutateAsync(id!);
      navigate('/students');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'لا يمكن حذف الطالب');
    }
  };

  const handleAddToGroup = async () => {
    if (!selectedGroupId) return;
    try {
      await addStudent.mutateAsync({ groupId: selectedGroupId, payload: { studentId: id!, discount } });
      setAddingGroup(false);
      setSelectedGroupId('');
      setDiscount(0);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء إضافة الطالب للمجموعة');
    }
  };

  const handleSaveDiscount = (groupId: string) => {
    updateDiscount.mutate({ groupId, studentId: id!, discount: editingDiscountValue }, {
      onSuccess: () => setEditingDiscountGroupId(null),
      onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء تعديل الخصم'),
    });
  };

  const handleRemoveFromGroup = async (groupId: string) => {
    if (!(await confirm('هل تريد إزالة الطالب من هذه المجموعة؟', { danger: true }))) return;
    try {
      await removeStudent.mutateAsync({ groupId, studentId: id! });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء إزالة الطالب من المجموعة');
    }
  };

  // حسابات مالية
  const allDues = financialProfile?.dues ?? [];
  const allPayments = paymentsData?.data ?? [];
  const totalDues = allDues.reduce((s: number, d: any) => s + d.dueAmount, 0);
  const totalPaid = allDues.reduce((s: number, d: any) => s + d.paidAmount, 0);
  const totalRemaining = allDues.reduce((s: number, d: any) => s + (d.status === 'waived' ? 0 : Math.max(0, d.dueAmount - d.discountApplied - d.paidAmount)), 0);
  const openDuesCount = allDues.filter((d: any) => d.status === 'unpaid' || d.status === 'partial').length;

  // إحصائيات الحضور
  const attendanceTotal = attendanceRecords.length;
  const attendanceStats = {
    present: attendanceRecords.filter(r => r.status === 'present').length,
    absent: attendanceRecords.filter(r => r.status === 'absent').length,
    late: attendanceRecords.filter(r => r.status === 'late').length,
    excused: attendanceRecords.filter(r => r.status === 'excused').length,
  };
  const attendanceRate = attendanceTotal > 0
    ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceTotal) * 100)
    : null;

  // درجات/امتحانات: نفس سجلات الحضور اللي ليها درجة مسجلة (degree/outOf) —
  // بنفس منطق تقرير "درجات الطالب" الموجود في الـ reports، بس هنا كـ تبويب مباشر في البروفايل
  const gradeRecords = attendanceRecords
    .filter(r => r.degree !== null && r.outOf !== null && r.outOf > 0)
    .map(r => ({ ...r, percentage: Math.round((r.degree! / r.outOf!) * 100) }));
  const avgPercentage = gradeRecords.length > 0
    ? Math.round(gradeRecords.reduce((s, r) => s + r.percentage, 0) / gradeRecords.length)
    : null;

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/students')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">بروفايل الطالب</h1>
            <p className="text-xs text-gray-400">{student.studentCode}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* بطاقة الطالب الرئيسية */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-[#0E3B2E] to-[#1F6B4E] px-6 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                  {student.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{student.fullName}</h2>
                  <p className="text-white/70 text-sm mt-0.5">{student.grade || 'بدون مرحلة'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold text-[#D4AB53] tracking-widest">{student.studentCode}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      student.isActive ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'
                    }`}>
                      {student.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowQr(true)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                </svg>
              </button>
            </div>
          </div>

          {/* بيانات التواصل */}
          <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-gray-50">
            <div>
              <p className="text-xs text-gray-400 mb-1">هاتف ولي الأمر</p>
              <p className="text-sm font-medium text-gray-800 font-mono">{student.parentPhone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">هاتف الطالب</p>
              <p className="text-sm font-medium text-gray-800 font-mono">{student.studentPhone || '—'}</p>
            </div>
            {student.dateOfBirth && (
              <div>
                <p className="text-xs text-gray-400 mb-1">تاريخ الميلاد</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(student.dateOfBirth).toLocaleDateString('ar-EG')}
                </p>
              </div>
            )}
            {student.school && (
              <div>
                <p className="text-xs text-gray-400 mb-1">المدرسة</p>
                <p className="text-sm font-medium text-gray-800">{student.school}</p>
              </div>
            )}
            {student.parentOccupation && (
              <div>
                <p className="text-xs text-gray-400 mb-1">وظيفة ولي الأمر</p>
                <p className="text-sm font-medium text-gray-800">{student.parentOccupation}</p>
              </div>
            )}
            {student.address && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">العنوان</p>
                <p className="text-sm font-medium text-gray-800">{student.address}</p>
              </div>
            )}
            {student.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-600">{student.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-3 flex items-center gap-2">
            {hasPermission('students.edit') && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#0E3B2E] border border-[#0E3B2E]/20 rounded-lg hover:bg-[#0E3B2E]/5 transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                تعديل
              </button>
            )}
            {hasPermission('students.edit') && (
              <button onClick={() => toggleActive.mutate(id!)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  student.isActive
                    ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}>
                {student.isActive ? 'تعطيل' : 'تفعيل'}
              </button>
            )}
            {hasPermission('students.delete') && (
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors mr-auto">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                حذف
              </button>
            )}
          </div>
        </div>

        {/* WA Warning */}
        {waStatus?.connected && phoneCheck && phoneCheck.exists === false && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
            <svg className="w-5 h-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-sm">رقم ولي الأمر <span className="font-mono font-semibold">{student.parentPhone}</span> غير مسجل على واتساب</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[
              { key: 'groups', label: 'المجموعات', count: studentGroups.length },
              { key: 'finance', label: 'المالية', count: openDuesCount > 0 ? openDuesCount : null },
              { key: 'attendance', label: 'الحضور', count: attendanceTotal > 0 ? attendanceStats.absent : null },
              { key: 'grades', label: 'الدرجات', count: null },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key ? 'text-[#0E3B2E]' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="mr-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-[#0E3B2E]" />
                )}
              </button>
            ))}
          </div>

          <div className="p-4">

            {/* ─── Tab: المجموعات ─── */}
            {activeTab === 'groups' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{studentGroups.length} مجموعة</p>
                  {hasPermission('groups.edit') && (
                    <button onClick={() => setAddingGroup(!addingGroup)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                      </svg>
                      إضافة لمجموعة
                    </button>
                  )}
                </div>
                {addingGroup && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">اختر المجموعة</label>
                      <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                        <option value="">اختر مجموعة</option>
                        {availableGroups.map((g: any) => (
                          <option key={g.id} value={g.id}>
                            {getGroupSelectLabel(g)} ({g.studentCount}/{g.maxStudents})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">خصم (ج.م)</label>
                      <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setAddingGroup(false)}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">إلغاء</button>
                      <button onClick={handleAddToGroup} disabled={!selectedGroupId || addStudent.isPending}
                        className="flex-1 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50">
                        {addStudent.isPending ? 'جاري...' : 'إضافة'}
                      </button>
                    </div>
                  </div>
                )}
                {studentGroups.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">الطالب غير مسجل في أي مجموعة</p>
                ) : (
                  studentGroups.map((g: any) => (
                    <div key={g.enrollmentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{g.groupName}</p>
                        {g.subjectGradeLabel && (
                          <p className="text-xs text-gray-400 mt-0.5">{g.subjectGradeLabel}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {editingDiscountGroupId === g.groupId ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={0} value={editingDiscountValue}
                                onChange={e => setEditingDiscountValue(Number(e.target.value))}
                                className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs"
                                autoFocus
                              />
                              <button onClick={() => handleSaveDiscount(g.groupId)} className="text-xs text-green-600 font-medium">✓</button>
                              <button onClick={() => setEditingDiscountGroupId(null)} className="text-xs text-gray-400">✕</button>
                            </div>
                          ) : hasPermission('groups.edit') ? (
                            <button
                              onClick={() => { setEditingDiscountGroupId(g.groupId); setEditingDiscountValue(g.discount); }}
                              className="text-xs text-[#0E3B2E] bg-[#0E3B2E]/10 px-2 py-0.5 rounded-full hover:bg-[#0E3B2E]/20 transition-colors"
                            >
                              {g.discount > 0 ? `خصم: ${g.discount} ج.م` : 'بدون خصم'}
                            </button>
                          ) : (
                            g.discount > 0 && (
                              <span className="text-xs text-[#0E3B2E] bg-[#0E3B2E]/10 px-2 py-0.5 rounded-full">
                                خصم: {g.discount} ج.م
                              </span>
                            )
                          )}
                          <span className="text-xs text-gray-400">
                            {g.schedule?.map((s: any) => `${DAY_LABELS[s.day as keyof typeof DAY_LABELS]} ${s.startTime}`).join(' · ')}
                          </span>
                        </div>
                      </div>
                      {hasPermission('groups.edit') && (
                        <button onClick={() => handleRemoveFromGroup(g.groupId)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                          إزالة
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ─── Tab: المالية ─── */}
            {activeTab === 'finance' && (
              <div className="space-y-4">

                {/* زرار تحصيل سريع */}
                <button
                  onClick={() => navigate(`/finance/collect?studentId=${id}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#0E3B2E] text-white rounded-xl font-medium text-sm hover:bg-[#1F6B4E] transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round"/>
                  </svg>
                  تحصيل سريع
                </button>

                {(loadingDues || loadingPayments) ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                ) : (
                  <>
                    {/* إحصائيات مالية */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">إجمالي الفواتير</p>
                        <p className="text-base font-bold text-gray-800">{totalDues.toLocaleString('ar-EG')}</p>
                        <p className="text-xs text-gray-400">ج.م</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <p className="text-xs text-emerald-600 mb-1">المدفوع</p>
                        <p className="text-base font-bold text-emerald-700">{totalPaid.toLocaleString('ar-EG')}</p>
                        <p className="text-xs text-emerald-600">ج.م</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center border ${totalRemaining > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                        <p className={`text-xs mb-1 ${totalRemaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>المتبقي</p>
                        <p className={`text-base font-bold ${totalRemaining > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {totalRemaining.toLocaleString('ar-EG')}
                        </p>
                        <p className={`text-xs ${totalRemaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>ج.م</p>
                      </div>
                    </div>

                    {/* الفواتير */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">الفواتير ({allDues.length})</p>
                      {allDues.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد فواتير</p>
                      ) : (
                        <div className="space-y-2">
                          {allDues.map((due: any) => {
                            const remaining = due.status === 'waived' ? 0 : Math.max(0, due.dueAmount - due.discountApplied - due.paidAmount);
                            return (
                              <div key={due.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{due.subjectName || 'غير محدد'}</p>
                                  <p className="text-xs text-gray-400">{due.month} {due.gradeName ? `— ${due.gradeName}` : ''}</p>
                                  {due.discountApplied > 0 && (
                                    <p className="text-xs text-[#0E3B2E]">خصم: {due.discountApplied} ج.م</p>
                                  )}
                                </div>
                                <div className="text-left shrink-0 mr-2">
                                  <p className="text-sm font-bold text-gray-800">{remaining.toLocaleString('ar-EG')} ج</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${DUE_STATUS_LABELS[due.status as keyof typeof DUE_STATUS_LABELS]?.class}`}>
                                    {DUE_STATUS_LABELS[due.status as keyof typeof DUE_STATUS_LABELS]?.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* الإيصالات */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">الإيصالات ({allPayments.length})</p>
                      {allPayments.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد إيصالات</p>
                      ) : (
                        <div className="space-y-2">
                          {allPayments.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-400">#{p.receiptNumber}</span>
                                  <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS]}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString('ar-EG') : '—'}
                                  {p.treasuryName ? ` — ${p.treasuryName}` : ''}
                                </p>
                              </div>
                              <div className="text-left shrink-0 mr-2">
                                <p className="text-sm font-bold text-emerald-700">{Number(p.amount).toLocaleString('ar-EG')} ج</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS]?.class}`}>
                                  {PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS]?.label}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─── Tab: الحضور ─── */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
                {loadingAttendance ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                ) : attendanceRecords.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">لا يوجد سجل حضور لهذا الطالب</p>
                ) : (
                  <>
                    {/* إحصائيات الحضور */}
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
                        <p className="text-base font-bold text-emerald-700">{attendanceStats.present}</p>
                        <p className="text-xs text-emerald-600">حاضر</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2.5 text-center border border-amber-100">
                        <p className="text-base font-bold text-amber-700">{attendanceStats.late}</p>
                        <p className="text-xs text-amber-600">متأخر</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
                        <p className="text-base font-bold text-red-600">{attendanceStats.absent}</p>
                        <p className="text-xs text-red-500">غايب</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-2.5 text-center border border-purple-100">
                        <p className="text-base font-bold text-purple-700">{attendanceStats.excused}</p>
                        <p className="text-xs text-purple-600">معذور</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                        <p className="text-base font-bold text-gray-800">{attendanceRate}%</p>
                        <p className="text-xs text-gray-400">نسبة الحضور</p>
                      </div>
                    </div>

                    {/* سجل الحصص */}
                    <div className="space-y-2">
                      {attendanceRecords.map(record => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{record.sessionTitle}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400">
                                {new Date(record.startDate).toLocaleDateString('ar-EG')}
                              </span>
                              {record.groupName && (
                                <span className="text-xs text-gray-400">· {record.groupName}</span>
                              )}
                              {record.subjectName && (
                                <span className="text-xs text-gray-400">· {record.subjectName}</span>
                              )}
                              <span className="text-xs text-gray-400">
                                · {SESSION_TYPE_LABELS[record.sessionType as SessionType] ?? record.sessionType}
                              </span>
                            </div>
                          </div>
                          <div className="text-left shrink-0 mr-2 flex flex-col items-end gap-1">
                            {record.degree !== null && (
                              <span className="text-xs text-gray-500 font-mono">
                                {record.degree}{record.outOf !== null ? `/${record.outOf}` : ''}
                              </span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${ATTENDANCE_STATUS_LABELS[record.status as AttendanceStatus]?.class}`}>
                              {ATTENDANCE_STATUS_LABELS[record.status as AttendanceStatus]?.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─── Tab: الدرجات ─── */}
            {activeTab === 'grades' && (
              <div className="space-y-4">
                {loadingAttendance ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                ) : gradeRecords.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">لا يوجد درجات مسجلة لهذا الطالب بعد</p>
                ) : (
                  <>
                    {/* إحصائيات الدرجات */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className="text-base font-bold text-gray-800">{gradeRecords.length}</p>
                        <p className="text-xs text-gray-400">عدد الامتحانات</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center border ${
                        avgPercentage !== null && avgPercentage < 50 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
                      }`}>
                        <p className={`text-base font-bold ${avgPercentage !== null && avgPercentage < 50 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {avgPercentage}%
                        </p>
                        <p className={`text-xs ${avgPercentage !== null && avgPercentage < 50 ? 'text-red-500' : 'text-emerald-600'}`}>متوسط الدرجات</p>
                      </div>
                    </div>

                    {/* سجل الدرجات */}
                    <div className="space-y-2">
                      {gradeRecords.map(record => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{record.sessionTitle}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400">
                                {new Date(record.startDate).toLocaleDateString('ar-EG')}
                              </span>
                              {record.groupName && <span className="text-xs text-gray-400">· {record.groupName}</span>}
                              {record.subjectName && <span className="text-xs text-gray-400">· {record.subjectName}</span>}
                              <span className="text-xs text-gray-400">
                                · {SESSION_TYPE_LABELS[record.sessionType as SessionType] ?? record.sessionType}
                              </span>
                            </div>
                          </div>
                          <div className="text-left shrink-0 mr-2">
                            <p className="text-sm font-bold text-gray-800">{record.degree}/{record.outOf}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                              record.percentage < 50
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : record.percentage < 75
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              {record.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && <StudentFormModal open={editing} student={student} onClose={() => setEditing(false)} />}
      {showQr && <StudentQrModal student={student} onClose={() => setShowQr(false)} />}
    </div>
  );
}

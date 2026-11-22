import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTreasuries, usePaymentMutations, useDueMutations } from '../hooks/useFinance';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useStudentGroups } from '@/features/students/hooks/useStudents';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { DUE_STATUS_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import { apiClient } from '../../../shared/lib/api/client';
import { QrCameraScanner } from '../../sessions/components/QrCameraScanner';
import type { MonthlyDue } from '../types/finance.types';
import { ThermalReceipt } from '../components/ThermalReceipt';

interface StudentResult {
  studentId: string;
  studentName: string;
  studentCode: string;
}

interface StudentDues {
  studentId: string;
  studentName: string;
  studentCode: string;
  dues: MonthlyDue[];
}

export default function CollectPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDues | null>(null);
  const [selectedDues, setSelectedDues] = useState<Set<string>>(new Set());
  const [treasuryId, setTreasuryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [printData, setPrintData] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<any>(null);

  const [searchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { data: treasuries = [] } = useTreasuries();
  const { create: createPayment } = usePaymentMutations();
  const { createManual } = useDueMutations();
  const { data: subjects = [] } = useSubjects();

  // ─── فاتورة يدوية (دفع مقدم / اشتراك في نص الشهر) ───
  const [showManualDue, setShowManualDue] = useState(false);
  const [manualSubjectGradeId, setManualSubjectGradeId] = useState('');
  const [manualMonth, setManualMonth] = useState(new Date().toISOString().slice(0, 7));
  const [manualAmount, setManualAmount] = useState('');
  const [manualProrate, setManualProrate] = useState(false);
  const [manualStartDay, setManualStartDay] = useState(new Date().getDate());
  const [manualError, setManualError] = useState<string | null>(null);

  // المجموعات اللي الطالب المختار مشترك فيها فعلاً — عشان الفاتورة اليدوية
  // تعرض بس المواد اللي هو منضم لها، مش كل مواد السنتر
  const { data: studentGroups = [] } = useStudentGroups(selectedStudent?.studentId ?? '');
  const enrolledSubjectGradeIds = new Set(
    studentGroups.filter(g => g.isActive).map(g => g.subjectGradeId).filter(Boolean)
  );
  const discountBySubjectGradeId = new Map(
    studentGroups.filter(g => g.isActive && g.subjectGradeId).map(g => [g.subjectGradeId as string, g.discount])
  );

  const gradeOptions = subjects
    .flatMap(item =>
      item.grades.map(g => ({ value: g.id, label: `${item.subject.name} — ${g.grade}`, fee: Number(g.fee) }))
    )
    .filter(o => enrolledSubjectGradeIds.has(o.value))
    .map(o => ({ ...o, discount: discountBySubjectGradeId.get(o.value) ?? 0 }));
  const selectedGradeOption = gradeOptions.find(g => g.value === manualSubjectGradeId);
  const [manualDiscount, setManualDiscount] = useState(0);

  const daysInMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  useEffect(() => {
    if (!selectedGradeOption) return;
    if (!manualProrate) {
      setManualAmount(String(selectedGradeOption.fee));
      setManualDiscount(selectedGradeOption.discount);
    } else {
      const total = daysInMonth(manualMonth);
      const remaining = Math.max(1, total - manualStartDay + 1);
      const prorated = Math.round((selectedGradeOption.fee / total) * remaining);
      const proratedDiscount = Math.round((selectedGradeOption.discount / total) * remaining);
      setManualAmount(String(prorated));
      setManualDiscount(proratedDiscount);
    }
  }, [selectedGradeOption, manualProrate, manualStartDay, manualMonth]);

  const openManualDue = () => {
    setManualSubjectGradeId('');
    setManualMonth(new Date().toISOString().slice(0, 7));
    setManualAmount('');
    setManualProrate(false);
    setManualStartDay(new Date().getDate());
    setManualError(null);
    setShowManualDue(true);
  };

  const handleCreateManualDue = async () => {
    if (!selectedStudent || !manualSubjectGradeId || !manualAmount) return;
    setManualError(null);
    try {
      await createManual.mutateAsync({
        studentId: selectedStudent.studentId,
        subjectGradeId: manualSubjectGradeId,
        month: manualMonth,
        dueAmount: Number(manualAmount),
        discountApplied: manualDiscount,
      });
      setShowManualDue(false);
      // إعادة تحميل فواتير الطالب عشان الفاتورة الجديدة تظهر على طول
      const res = await apiClient.get('/finance/collect/student/' + selectedStudent.studentId + '/dues');
      setSelectedStudent(res.data.data);
    } catch (err: any) {
      setManualError(err?.response?.data?.error?.message || 'حدث خطأ أثناء إنشاء الفاتورة');
    }
  };

  useEffect(() => {
    if (treasuries.length > 0 && !treasuryId) {
      setTreasuryId(treasuries[0].id);
    }
  }, [treasuries]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const studentId = searchParams.get('studentId');
    if (!studentId) return;
    setLoading(true);
    apiClient.get(`/finance/collect/student/${studentId}/dues`)
      .then(res => {
        const data = res.data.data;
        setSelectedStudent(data);
        setQuery(data.studentName);
        setSelectedDues(new Set());
      })
      .catch(err => setError(err?.response?.data?.error?.message || 'حدث خطأ'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedStudent(null);
    setSelectedDues(new Set());
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get('/finance/collect/search?q=' + encodeURIComponent(val));
        setSuggestions(res.data.data);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelectStudent = async (student: StudentResult) => {
    setQuery(student.studentName);
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/collect/student/' + student.studentId + '/dues');
      const data = res.data.data as StudentDues;
      setSelectedStudent(data);
      setSelectedDues(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  const toggleDue = (id: string) => {
    setSelectedDues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDuesList = selectedStudent?.dues.filter(d => selectedDues.has(d.id)) ?? [];
  const totalAmount = selectedDuesList.reduce((s, d) => s + (d.dueAmount - d.discountApplied - d.paidAmount), 0);

  const handleCollect = async () => {
    if (!selectedStudent || selectedDuesList.length === 0 || !treasuryId) return;
    setLoading(true);
    setError(null);
    try {
      const payments = selectedDuesList.map(d => ({
        monthlyDueId: d.id,
        amount: d.dueAmount - d.discountApplied - d.paidAmount,
      }));
      const res = await apiClient.post('/finance/collect/multi', {
        payments, treasuryId, paymentMethod, notes: notes || undefined,
      });
      // بنستخدم استجابة السيرفر الفعلية (المبلغ + رقم الإيصال الحقيقي من الـ
      // sequence) بدل ما نعتمد على قيم محسوبة في الفرونت أو Date.now() كرقم
      // إيصال وهمي — ده المصدر الوحيد الموثوق فيه لأي حاجة بتتطبع على الإيصال
      const createdPayments: { amount: number; receiptNumber: number }[] = res.data?.data ?? [];
      const actualTotal = createdPayments.length > 0
        ? createdPayments.reduce((s, p) => s + p.amount, 0)
        : totalAmount;
      const totalDiscount = selectedDuesList.reduce((s, d) => s + d.discountApplied, 0);
      setSuccess('✅ تم تحصيل ' + selectedDuesList.length + ' فاتورة بإجمالي ' + actualTotal.toLocaleString('ar-EG') + ' جنيه');
      setPrintData({
        receiptNumber: createdPayments[0]?.receiptNumber ?? Date.now(),
        studentName: selectedStudent.studentName,
        studentCode: selectedStudent.studentCode,
        amount: actualTotal,
        discountApplied: totalDiscount,
        paymentMethod,
        subjectName: selectedDuesList.map(d => d.subjectName).filter(Boolean).join(' / '),
        month: selectedDuesList.map(d => d.month).filter(Boolean).join(' / '),
        paidAt: new Date().toISOString(),
        // لو اتحصّل أكتر من فاتورة مواد مختلفة مرة واحدة، بناخد سياق أول فاتورة بس للبراندنج
        monthlyDueId: selectedDuesList[0]?.id,
      });
      setTimeout(() => {
        setQuery('');
        setSelectedStudent(null);
        setSelectedDues(new Set());
        setNotes('');
        setSuccess(null);
        inputRef.current?.focus();
      }, 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'حدث خطأ في التحصيل');
    } finally { setLoading(false); }
  };

  const handleCameraScan = async (qrCode: string) => {
    setShowCamera(false);
    let code = qrCode;
    try {
      const parsed = JSON.parse(qrCode);
      if (parsed.code) code = parsed.code;
    } catch {}
    handleQueryChange(code);
    try {
      const res = await apiClient.get('/finance/collect/search?q=' + encodeURIComponent(code));
      const results = res.data.data;
      if (results.length === 1) {
        handleSelectStudent(results[0]);
      } else {
        setSuggestions(results);
      }
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length === 1) {
      handleSelectStudent(suggestions[0]);
    }
  };

  return (
    <>
      <FinanceLayout>
        <div className="space-y-4 max-w-lg mx-auto" dir="rtl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">تحصيل سريع</h2>
            <p className="text-sm text-gray-400">سكان باركود الطالب أو ابحث بالاسم</p>
          </div>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-700 font-medium text-sm text-center">
              {success}
            </div>
          )}

          <div className="relative">
            <div className="flex items-center gap-3 bg-white border-2 border-[#0E3B2E] rounded-2xl px-4 py-3 shadow-sm">
              <svg className="w-5 h-5 text-[#0E3B2E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اسم الطالب أو الكود أو الباركود..."
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                autoComplete="off"
              />
              {searching && <div className="w-4 h-4 border-2 border-[#0E3B2E] border-t-transparent rounded-full animate-spin shrink-0" />}
              {query && !searching && (
                <button onClick={() => { setQuery(''); setSelectedStudent(null); setSuggestions([]); inputRef.current?.focus(); }}
                  className="text-gray-400 hover:text-gray-600 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button onClick={() => setShowCamera(true)}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0E3B2E] text-white hover:bg-[#1a5c44] transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-2xl border border-gray-100 shadow-lg z-20 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s.studentId} onClick={() => handleSelectStudent(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center text-[#0E3B2E] font-bold text-sm shrink-0">
                      {s.studentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.studentName}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.studentCode}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {loading && !selectedStudent && (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          )}

          {selectedStudent && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center text-[#0E3B2E] font-bold">
                  {selectedStudent.studentName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{selectedStudent.studentName}</p>
                  <p className="text-xs text-gray-400 font-mono">{selectedStudent.studentCode}</p>
                </div>
                {hasPermission('finance.collect') && (
                  <button onClick={openManualDue}
                    className="text-xs text-[#0E3B2E] border border-[#0E3B2E]/30 rounded-lg px-3 py-1.5 hover:bg-[#0E3B2E]/5 transition-colors shrink-0">
                    + فاتورة يدوية
                  </button>
                )}
              </div>

              {selectedStudent.dues.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-medium">لا توجد فواتير مفتوحة</p>
                  <p className="text-sm mt-1">الطالب خالص جميع فواتيره</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 px-1">اختر الفواتير للتحصيل:</p>
                    {selectedStudent.dues.map(due => {
                      const remaining = due.dueAmount - due.discountApplied - due.paidAmount;
                      const isSelected = selectedDues.has(due.id);
                      return (
                        <button key={due.id} onClick={() => toggleDue(due.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-right ${
                            isSelected ? 'border-[#0E3B2E] bg-[#0E3B2E]/5' : 'border-gray-100 bg-white'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-[#0E3B2E] bg-[#0E3B2E]' : 'border-gray-300'
                          }`}>
                            {isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{due.subjectName}</p>
                            <p className="text-xs text-gray-400">{due.month} — {due.gradeName}</p>
                            {due.paidAmount > 0 && (
                              <p className="text-xs text-amber-600">مدفوع مسبقاً: {due.paidAmount.toLocaleString('ar-EG')}ج</p>
                            )}
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-base font-bold text-[#0E3B2E]">{remaining.toLocaleString('ar-EG')} ج</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${DUE_STATUS_LABELS[due.status].class}`}>
                              {DUE_STATUS_LABELS[due.status].label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={() => {
                    if (selectedDues.size === selectedStudent.dues.length) setSelectedDues(new Set());
                    else setSelectedDues(new Set(selectedStudent.dues.map(d => d.id)));
                  }} className="text-xs text-[#0E3B2E] font-medium px-1">
                    {selectedDues.size === selectedStudent.dues.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  </button>

                  {selectedDues.size > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">طريقة الدفع</label>
                          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                            <option value="cash">💵 كاش</option>
                            <option value="visa">💳 فيزا</option>
                            <option value="instapay">📱 إنستاباي</option>
                            <option value="vodafone">📱 فودافون</option>
                            <option value="bank">🏦 تحويل</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">الخزينة</label>
                          <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                            {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات</label>
                        <input value={notes} onChange={e => setNotes(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                          placeholder="اختياري" />
                      </div>
                    </div>
                  )}

                  {selectedDues.size > 0 && hasPermission('finance.collect') && (
                    <button onClick={handleCollect} disabled={loading}
                      className="w-full bg-[#0E3B2E] text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 hover:bg-[#1a5c44] transition-colors shadow-lg">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          جاري التحصيل...
                        </span>
                      ) : (
                        <>
                          💰 تحصيل {selectedDues.size} فاتورة
                          <span className="mr-2 text-white/80">({totalAmount.toLocaleString('ar-EG')} جنيه)</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </FinanceLayout>

      {printData && (
        <ThermalReceipt
          receipt={printData}
          onClose={() => setPrintData(null)}
          autoPrint={false}
        />
      )}

      {showCamera && (
        <QrCameraScanner
          onScan={handleCameraScan}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showManualDue && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">فاتورة يدوية</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {selectedStudent.studentName} — لدفع مقدم لشهر لسه ما اتولدش، أو اشتراك في نص الشهر
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المادة والصف</label>
              <select value={manualSubjectGradeId} onChange={e => setManualSubjectGradeId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">اختر المادة والصف</option>
                {gradeOptions.map(o => <option key={o.value} value={o.value}>{o.label} ({o.fee} ج.م)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الشهر</label>
              <input type="month" value={manualMonth} onChange={e => setManualMonth(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={manualProrate} onChange={e => setManualProrate(e.target.checked)}
                className="w-4 h-4 accent-[#0E3B2E]" />
              احتساب المبلغ بالتناسب (اشتراك في نص الشهر)
            </label>

            {manualProrate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">يبدأ الاشتراك من يوم</label>
                <input type="number" min={1} max={31} value={manualStartDay}
                  onChange={e => setManualStartDay(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المبلغ {manualProrate && <span className="text-gray-400 font-normal">(مقترح تلقائياً — يمكن تعديله)</span>}
              </label>
              <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              {manualDiscount > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  هيتطبق خصم {manualDiscount.toLocaleString('ar-EG')} ج.م المسجل للطالب — الصافي المطلوب: {Math.max(0, Number(manualAmount || 0) - manualDiscount).toLocaleString('ar-EG')} ج.م
                </p>
              )}
            </div>

            {manualError && <p className="text-sm text-red-500">{manualError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={handleCreateManualDue} disabled={createManual.isPending || !manualSubjectGradeId || !manualAmount}
                className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {createManual.isPending ? 'جاري الإنشاء...' : 'إنشاء الفاتورة'}
              </button>
              <button onClick={() => setShowManualDue(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

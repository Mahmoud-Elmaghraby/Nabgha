import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions.api';
import type { CreateSessionPayload, UpdateAttendancePayload, BulkUpdateAttendancePayload, ListSessionsParams, AddExternalAttendanceIdentifier } from '../types/session.types';

export const SESSION_KEYS = {
  all:        ['sessions'] as const,
  list:       (params?: ListSessionsParams) => ['sessions', 'list', params] as const,
  detail:     (id: string) => ['sessions', id] as const,
  attendance: (id: string) => ['sessions', id, 'attendance'] as const,
};

export function useSessions(params?: ListSessionsParams) {
  return useQuery({
    queryKey: SESSION_KEYS.list(params),
    queryFn: () => sessionsApi.list(params),
    // في السيرفر فيه كرون بيبدّل حالة الحصص (مجدولة → جارية → منتهية) أوتوماتيك
    // حسب مواعيدها من غير أي فعل من المستخدم — فلازم القايمة تتحدّث لوحدها كل
    // فترة قصيرة، وإلا هتفضل عارضة حالة قديمة (مثلاً "مجدولة" وهي بقت "جارية"
    // فعلياً)، وأي محاولة تعديل يدوي (زرار بدء/إنهاء) هترفض من الباك إند بسبب
    // اختلاف الحالة الحقيقية عن اللي متعرضة.
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: SESSION_KEYS.detail(id),
    queryFn: () => sessionsApi.getById(id),
    enabled: !!id,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}

export function usePreviousAbsent(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'previous-absent'],
    queryFn: () => sessionsApi.getPreviousAbsent(sessionId),
    enabled: !!sessionId,
    // تحديث دوري في الخلفية بس — مش هيتسأل من جديد مع كل سكان،
    // بس لو الشاشة فاضلة مفتوحة فترة طويلة الداتا تفضل حديثة
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useUnpaidStudents(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'unpaid'],
    queryFn: () => sessionsApi.getUnpaidStudents(sessionId),
    enabled: !!sessionId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useAbsenceReport(sessionId: string | null) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'absence-report'],
    queryFn: () => sessionsApi.getAbsenceReport(sessionId!),
    enabled: !!sessionId,
  });
}

export function useSessionAttendance(sessionId: string) {
  return useQuery({
    queryKey: SESSION_KEYS.attendance(sessionId),
    queryFn: () => sessionsApi.getAttendance(sessionId),
    enabled: !!sessionId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

export function useSessionMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SESSION_KEYS.all });
  };

  const create = useMutation({
    mutationFn: (payload: CreateSessionPayload) => sessionsApi.create(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateSessionPayload> }) =>
      sessionsApi.update(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: invalidate,
  });

  // start/complete/cancel: لو الطلب فشل بسبب اختلاف الحالة (مثلاً الكرون بدّل
  // الحالة تلقائي قبل ما المستخدم يضغط الزرار)، نعمل invalidate كمان عند
  // الفشل — عشان الواجهة تتصحح فوراً بدل ما تستنى دورة الـ refetchInterval
  const start = useMutation({
    mutationFn: (id: string) => sessionsApi.start(id),
    onSuccess: invalidate,
    onError: invalidate,
  });

  const complete = useMutation({
    mutationFn: (id: string) => sessionsApi.complete(id),
    onSuccess: invalidate,
    onError: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => sessionsApi.cancel(id),
    onSuccess: invalidate,
    onError: invalidate,
  });

  const generateToday = useMutation({
    mutationFn: (date?: string) => sessionsApi.generateToday(date),
    onSuccess: invalidate,
  });

  return { create, update, remove, start, complete, cancel, generateToday };
}

export function useAttendanceMutations(sessionId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SESSION_KEYS.attendance(sessionId) });
    qc.invalidateQueries({ queryKey: SESSION_KEYS.detail(sessionId) });
    qc.invalidateQueries({ queryKey: SESSION_KEYS.all });
  };

  const updateOne = useMutation({
    mutationFn: ({ studentId, payload }: { studentId: string; payload: UpdateAttendancePayload }) =>
      sessionsApi.updateAttendance(sessionId, studentId, payload),
    onSuccess: invalidate,
  });

  const bulkUpdate = useMutation({
    mutationFn: (payload: BulkUpdateAttendancePayload) =>
      sessionsApi.bulkUpdateAttendance(sessionId, payload),
    onSuccess: invalidate,
  });

  const scanQr = useMutation({
    mutationFn: (qrCode: string) => sessionsApi.scanQr(sessionId, qrCode),
    onSuccess: invalidate,
  });

  const addExternal = useMutation({
    mutationFn: (identifier: AddExternalAttendanceIdentifier) => sessionsApi.addExternalAttendance(sessionId, identifier),
    // نستخدم invalidate العام (مش بس attendance الحصة الحالية) لأن العملية ممكن
    // تعدّل حضور طالب في حصة تانية تماماً (إعفاء غياب أو استهلاك رصيد)
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_KEYS.all }),
  });

  return { updateOne, bulkUpdate, scanQr, addExternal };
}

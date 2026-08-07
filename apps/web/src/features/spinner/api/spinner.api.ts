import { apiClient } from '@/shared/lib/api/client';

export interface SpinnerStudent {
  id: string;
  fullName: string;
}

export const spinnerApi = {
  // أي حصة حالتها "ongoing" دلوقتي (بغض النظر عن المجموعة)
  getOngoingSessions: async () => {
    const res = await apiClient.get('/sessions', { params: { status: 'ongoing', limit: 20 } });
    return res.data.data?.data ?? [];
  },

  // الطلاب الحاضرين فعلياً في حصة معينة (status = present)
  getPresentStudentsInSession: async (sessionId: string): Promise<SpinnerStudent[]> => {
    const res = await apiClient.get(`/sessions/${sessionId}/attendance`);
    const rows = res.data.data ?? [];
    return rows
      .filter((r: any) => r.status === 'present')
      .map((r: any) => ({ id: r.studentId, fullName: r.studentName }));
  },

  // كل طلاب مجموعة معينة (بدون فلترة حضور)
  getGroupStudents: async (groupId: string): Promise<SpinnerStudent[]> => {
    const res = await apiClient.get(`/groups/${groupId}/students`);
    return (res.data.data ?? []).map((s: any) => ({ id: s.studentId, fullName: s.fullName }));
  },

  // كل طلاب مادة معينة (بدون فلترة حضور)
  getSubjectStudents: async (subjectId: string): Promise<SpinnerStudent[]> => {
    const res = await apiClient.get('/students', { params: { subjectId, limit: 500 } });
    return (res.data.data?.data ?? []).map((s: any) => ({ id: s.id, fullName: s.fullName }));
  },
};

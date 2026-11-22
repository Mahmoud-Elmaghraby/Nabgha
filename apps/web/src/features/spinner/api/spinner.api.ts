import { apiClient } from '@/shared/lib/api/client';

export interface SpinnerStudent {
  id: string;
  fullName: string;
}

export interface SpinnerSession {
  id: string;
  title: string;
  status: 'scheduled' | 'ongoing';
  groupName: string | null;
  grade: string | null;
  startTime: string | null;
}

/** تاريخ النهارده بتوقيت الجهاز (YYYY-MM-DD) — مش UTC عشان بالليل مايقلبش لليوم اللي بعده */
function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const unique = (list: SpinnerStudent[]) => {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
};

export const spinnerApi = {
  /**
   * حصص النهارده المفتوحة: الجارية + المجدولة النهارده.
   * (مدرسين كتير بيسجلوا الحضور من غير ما يدوسوا "بدء الحصة"، فكانت الحصة مابتظهرش خالص)
   */
  getTodaySessions: async (): Promise<SpinnerSession[]> => {
    const today = todayLocal();
    const [ongoing, scheduled] = await Promise.all([
      apiClient.get('/sessions', { params: { status: 'ongoing', limit: 50 } }),
      apiClient.get('/sessions', { params: { status: 'scheduled', from: today, to: today, limit: 50 } }),
    ]);
    const rows = [...(ongoing.data.data?.data ?? []), ...(scheduled.data.data?.data ?? [])];
    return rows.map((s: any) => ({
      id: s.id, title: s.title, status: s.status, groupName: s.groupName ?? null,
      grade: s.grade ?? null, startTime: s.startTime ?? null,
    }));
  },

  /** الطلاب اللي حضروا فعلاً — حاضر أو متأخر (المتأخر كان بيتشال من العجلة غلط) */
  getPresentStudentsInSession: async (sessionId: string): Promise<SpinnerStudent[]> => {
    const res = await apiClient.get(`/sessions/${sessionId}/attendance`);
    const rows = res.data.data ?? [];
    return unique(rows
      .filter((r: any) => r.status === 'present' || r.status === 'late')
      .map((r: any) => ({ id: r.studentId, fullName: r.studentName })));
  },

  /** طلاب المجموعة الحاليين (من غير الموقوفين) */
  getGroupStudents: async (groupId: string): Promise<SpinnerStudent[]> => {
    const res = await apiClient.get(`/groups/${groupId}/students`);
    return unique((res.data.data ?? [])
      .filter((s: any) => s.isActive !== false)
      .map((s: any) => ({ id: s.studentId, fullName: s.fullName })));
  },

  /** كل طلاب المادة النشطين — بيجيب كل الصفحات (كان بيقف عند أول 500 ومن غير ما يستبعد الموقوفين) */
  getSubjectStudents: async (subjectId: string): Promise<SpinnerStudent[]> => {
    const all: SpinnerStudent[] = [];
    const limit = 500;
    for (let page = 1; page <= 20; page++) {
      const res = await apiClient.get('/students', {
        params: { subjectId, isActive: 'true', page: String(page), limit: String(limit) },
      });
      const data = res.data.data?.data ?? [];
      all.push(...data.map((s: any) => ({ id: s.id, fullName: s.fullName })));
      const total = Number(res.data.data?.total ?? 0);
      if (data.length < limit || all.length >= total) break;
    }
    return unique(all);
  },
};

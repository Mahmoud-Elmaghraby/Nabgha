import { create } from 'zustand';

interface SelectedStudent {
  id: string;
  fullName: string;
  studentCode: string | null;
}

interface ReportsStudentStore {
  selectedStudent: SelectedStudent | null;
  setSelectedStudent: (student: SelectedStudent | null) => void;
}

/**
 * يخزّن الطالب المختار حالياً عبر تقارير الطلاب (كشف حساب/حضور/درجات)
 * عشان لو المستخدم غيّر التاب، الطالب يفضل نفسه من غير ما يدوّر تاني.
 * الحالة دي في الذاكرة بس (تتصفّر مع أي refresh للصفحة) — ده سلوك مقصود.
 */
export const useReportsStudentStore = create<ReportsStudentStore>((set) => ({
  selectedStudent: null,
  setSelectedStudent: (student) => set({ selectedStudent: student }),
}));

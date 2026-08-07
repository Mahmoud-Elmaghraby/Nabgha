import { create } from 'zustand';

export interface ParentStudent {
  id: string;
  fullName: string;
  grade: string | null;
}

interface ParentAuthState {
  slug: string | null;
  accessToken: string | null;
  students: ParentStudent[];
  isAuthenticated: boolean;
  initAuth: () => void;
  setAuth: (slug: string, accessToken: string, students: ParentStudent[]) => void;
  setStudents: (students: ParentStudent[]) => void;
  clearAuth: () => void;
}

// بوابة الأهالي مالهاش refresh token — التوكن صالح لمدة 30 يوم وبس (شوف
// ParentPortalService.verifyOtp في الباك إند)، فلو انتهى ولي الأمر بياخد
// كود OTP جديد بدل ما نعقّد الموضوع بمنطق تجديد.
export const useParentAuthStore = create<ParentAuthState>((set) => ({
  slug: null,
  accessToken: null,
  students: [],
  isAuthenticated: false,

  initAuth: () => {
    const slug = localStorage.getItem('parent_slug');
    const accessToken = localStorage.getItem('parent_accessToken');
    const studentsStr = localStorage.getItem('parent_students');
    if (slug && accessToken) {
      try {
        const students = studentsStr ? JSON.parse(studentsStr) : [];
        set({ slug, accessToken, students, isAuthenticated: true });
      } catch {
        localStorage.removeItem('parent_slug');
        localStorage.removeItem('parent_accessToken');
        localStorage.removeItem('parent_students');
      }
    }
  },

  setAuth: (slug, accessToken, students) => {
    localStorage.setItem('parent_slug', slug);
    localStorage.setItem('parent_accessToken', accessToken);
    localStorage.setItem('parent_students', JSON.stringify(students));
    set({ slug, accessToken, students, isAuthenticated: true });
  },

  setStudents: (students) => {
    localStorage.setItem('parent_students', JSON.stringify(students));
    set({ students });
  },

  clearAuth: () => {
    localStorage.removeItem('parent_slug');
    localStorage.removeItem('parent_accessToken');
    localStorage.removeItem('parent_students');
    set({ slug: null, accessToken: null, students: [], isAuthenticated: false });
  },
}));

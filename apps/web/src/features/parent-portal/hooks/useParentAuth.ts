import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { parentPortalApi } from '../api/parent-portal.api';
import { useParentAuthStore } from '../stores/parent-auth.store';

export function useRequestOtp(slug: string) {
  return useMutation({
    mutationFn: (phone: string) => parentPortalApi.requestOtp(slug, phone),
  });
}

export function useVerifyOtp(slug: string) {
  const navigate = useNavigate();
  const setAuth = useParentAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      parentPortalApi.verifyOtp(slug, phone, code),
    onSuccess: (data) => {
      setAuth(slug, data.accessToken, data.students);
      navigate(`/parent/${slug}/dashboard`);
    },
  });
}

export function useParentStudentDetail(slug: string, studentId: string) {
  return useQuery({
    queryKey: ['parent-student-detail', slug, studentId],
    queryFn: () => parentPortalApi.getStudentDetail(slug, studentId),
    enabled: !!slug && !!studentId,
    staleTime: 30_000,
  });
}

export function useParentMe(slug: string) {
  const isAuthenticated = useParentAuthStore((s) => s.isAuthenticated);
  const setStudents = useParentAuthStore((s) => s.setStudents);

  return useQuery({
    queryKey: ['parent-me', slug],
    queryFn: async () => {
      const data = await parentPortalApi.getMe(slug);
      setStudents(data.students);
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

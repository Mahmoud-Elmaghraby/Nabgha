import { useQuery } from '@tanstack/react-query';
import { teachersApi } from '../api/teachers.api';

export const TEACHERS_KEY = 'teachers';

export function useTeachers(search?: string) {
  return useQuery({
    queryKey: [TEACHERS_KEY, search],
    queryFn: () => teachersApi.list(search),
  });
}

export function useTeacher(id: string) {
  return useQuery({
    queryKey: [TEACHERS_KEY, id],
    queryFn: () => teachersApi.getOne(id),
    enabled: !!id,
  });
}

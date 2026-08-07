import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teachersApi } from '../api/teachers.api';
import type { CreateTeacherPayload, UpdateTeacherPayload } from '../types/teacher.types';
import { TEACHERS_KEY } from './useTeachers';

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeacherPayload) => teachersApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEACHERS_KEY] }),
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTeacherPayload }) =>
      teachersApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEACHERS_KEY] }),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teachersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEACHERS_KEY] }),
  });
}

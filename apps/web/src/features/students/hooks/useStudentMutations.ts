import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../api/students.api';
import type { CreateStudentPayload, UpdateStudentPayload } from '../types/student.types';
import { STUDENTS_KEY } from './useStudents';

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudentPayload) => studentsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDENTS_KEY] }),
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStudentPayload }) =>
      studentsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDENTS_KEY] }),
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDENTS_KEY] }),
  });
}

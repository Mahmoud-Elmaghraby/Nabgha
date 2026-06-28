import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../api/students.api';
import { apiClient } from '@/shared/lib/api/client';
import type {
  CreateStudentPayload,
  UpdateStudentPayload,
  ListStudentsParams,
} from '../types/student.types';

export const STUDENT_KEYS = {
  all: ['students'] as const,
  list: (params?: ListStudentsParams) => ['students', 'list', params] as const,
  detail: (id: string) => ['students', id] as const,
  groups: (id: string) => ['students', id, 'groups'] as const,
};

export function useStudents(params?: ListStudentsParams) {
  return useQuery({
    queryKey: STUDENT_KEYS.list(params),
    queryFn: () => studentsApi.list(params),
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: STUDENT_KEYS.detail(id),
    queryFn: () => studentsApi.getOne(id),
    enabled: !!id,
  });
}

export function useStudentGroups(id: string) {
  return useQuery({
    queryKey: STUDENT_KEYS.groups(id),
    queryFn: () => studentsApi.getGroups(id),
    enabled: !!id,
  });
}

export function useStudentMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => qc.invalidateQueries({ queryKey: STUDENT_KEYS.all });

  const createStudent = useMutation({
    mutationFn: (data: CreateStudentPayload) => studentsApi.create(data),
    onSuccess: invalidateAll,
  });

  const updateStudent = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStudentPayload }) =>
      studentsApi.update(id, data),
    onSuccess: invalidateAll,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/students/${id}/toggle`).then(r => r.data.data),
    onSuccess: invalidateAll,
  });

  const deleteStudent = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: invalidateAll,
  });

  return { createStudent, updateStudent, toggleActive, deleteStudent };
}

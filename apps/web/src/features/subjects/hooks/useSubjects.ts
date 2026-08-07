import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '../api/subjects.api';
import type {
  CreateSubjectPayload,
  UpdateSubjectPayload,
  CreateSubjectGradePayload,
  UpdateSubjectGradePayload,
} from '../types/subject.types';

export const SUBJECT_KEYS = {
  all: ['subjects'] as const,
  detail: (id: string) => ['subjects', id] as const,
};

export function useSubjects() {
  return useQuery({
    queryKey: SUBJECT_KEYS.all,
    queryFn: () => subjectsApi.getAll().then(r => r.data.data),
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: SUBJECT_KEYS.detail(id),
    queryFn: () => subjectsApi.getById(id).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useSubjectMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: SUBJECT_KEYS.all });

  const createSubject = useMutation({
    mutationFn: (data: CreateSubjectPayload) =>
      subjectsApi.create(data).then(r => r.data.data),
    onSuccess: invalidate,
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubjectPayload }) =>
      subjectsApi.update(id, data).then(r => r.data.data),
    onSuccess: invalidate,
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onSuccess: invalidate,
  });

  const addGrade = useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: CreateSubjectGradePayload }) =>
      subjectsApi.addGrade(subjectId, data).then(r => r.data.data),
    onSuccess: invalidate,
  });

  const updateGrade = useMutation({
    mutationFn: ({ subjectId, gradeId, data }: { subjectId: string; gradeId: string; data: UpdateSubjectGradePayload }) =>
      subjectsApi.updateGrade(subjectId, gradeId, data).then(r => r.data.data),
    onSuccess: invalidate,
  });

  const deleteGrade = useMutation({
    mutationFn: ({ subjectId, gradeId }: { subjectId: string; gradeId: string }) =>
      subjectsApi.deleteGrade(subjectId, gradeId),
    onSuccess: invalidate,
  });

  return { createSubject, updateSubject, deleteSubject, addGrade, updateGrade, deleteGrade };
}

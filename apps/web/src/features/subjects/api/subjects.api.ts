import { apiClient } from '@/shared/lib/api/client';
import type {
  SubjectWithGradesDto,
  CreateSubjectPayload,
  UpdateSubjectPayload,
  CreateSubjectGradePayload,
  UpdateSubjectGradePayload,
  SubjectGradeDto,
  SubjectDto,
} from '../types/subject.types';

export const subjectsApi = {
  getAll: () =>
    apiClient.get<SubjectWithGradesDto[]>('/subjects'),

  getById: (id: string) =>
    apiClient.get<SubjectWithGradesDto>(`/subjects/${id}`),

  create: (data: CreateSubjectPayload) =>
    apiClient.post<SubjectDto>('/subjects', data),

  update: (id: string, data: UpdateSubjectPayload) =>
    apiClient.put<SubjectDto>(`/subjects/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/subjects/${id}`),

  addGrade: (subjectId: string, data: CreateSubjectGradePayload) =>
    apiClient.post<SubjectGradeDto>(`/subjects/${subjectId}/grades`, data),

  updateGrade: (subjectId: string, gradeId: string, data: UpdateSubjectGradePayload) =>
    apiClient.put<SubjectGradeDto>(`/subjects/${subjectId}/grades/${gradeId}`, data),

  deleteGrade: (subjectId: string, gradeId: string) =>
    apiClient.delete(`/subjects/${subjectId}/grades/${gradeId}`),
};

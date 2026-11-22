import { apiClient } from '@/shared/lib/api/client';
import type {
  QuestionDto,
  ExamDto,
  ExamItemDto,
  ExamWithItems,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  ListQuestionsParams,
  PaginatedQuestions,
  CreateExamPayload,
  UpdateExamPayload,
  ListExamsParams,
  PaginatedExams,
  SaveExamItemPayload,
  GenerateExamPayload,
} from '../types/exam.types';

export const examsApi = {
  // ─── بنك الأسئلة ──────────────────────────────────────────
  listQuestions: async (params?: ListQuestionsParams): Promise<PaginatedQuestions> => {
    const res = await apiClient.get('/exams/questions', { params });
    return res.data.data;
  },

  getQuestion: async (id: string): Promise<QuestionDto> => {
    const res = await apiClient.get(`/exams/questions/${id}`);
    return res.data.data;
  },

  createQuestion: async (payload: CreateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.post('/exams/questions', payload);
    return res.data.data;
  },

  updateQuestion: async (id: string, payload: UpdateQuestionPayload): Promise<QuestionDto> => {
    const res = await apiClient.put(`/exams/questions/${id}`, payload);
    return res.data.data;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/questions/${id}`);
  },

  // ─── الامتحانات ────────────────────────────────────────────
  listExams: async (params?: ListExamsParams): Promise<PaginatedExams> => {
    const res = await apiClient.get('/exams', { params });
    return res.data.data;
  },

  getExam: async (id: string): Promise<ExamWithItems> => {
    const res = await apiClient.get(`/exams/${id}`);
    return res.data.data;
  },

  createExam: async (payload: CreateExamPayload): Promise<ExamDto> => {
    const res = await apiClient.post('/exams', payload);
    return res.data.data;
  },

  updateExam: async (id: string, payload: UpdateExamPayload): Promise<ExamDto> => {
    const res = await apiClient.put(`/exams/${id}`, payload);
    return res.data.data;
  },

  deleteExam: async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/${id}`);
  },

  // ─── بنود الامتحان ─────────────────────────────────────────
  saveExamItems: async (examId: string, items: SaveExamItemPayload[]): Promise<ExamWithItems> => {
    const res = await apiClient.put(`/exams/${examId}/items`, { items });
    return res.data.data;
  },

  // ─── توليد تلقائي ──────────────────────────────────────────
  generateExam: async (payload: GenerateExamPayload): Promise<ExamWithItems> => {
    const res = await apiClient.post('/exams/generate', payload);
    return res.data.data;
  },

  // ─── تصدير PDF ─────────────────────────────────────────────
  exportPdf: async (examId: string): Promise<Blob> => {
    const res = await apiClient.post(`/exams/${examId}/pdf`, {}, { responseType: 'blob' });
    return res.data;
  },
};

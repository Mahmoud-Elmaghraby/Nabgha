import { apiClient } from '@/shared/lib/api/client';
import type {
  QuestionDto,
  ExamDto,

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
  GeneratedExam,
  QuestionAvailability,
  ImportOptions,
  ImportReport,
  SessionExamLink,
  LinkedSession,
  VersionKey,
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
  generateExam: async (payload: GenerateExamPayload): Promise<GeneratedExam> => {
    const res = await apiClient.post('/exams/generate', payload);
    return res.data.data;
  },

  // ─── تصدير PDF ─────────────────────────────────────────────
  // answerKey = true → نموذج الإجابة (الإجابات الصحيحة متعلّمة)
  // version = A..D → نموذج مختلف (نفس الأسئلة بترتيب مختلف)
  exportPdf: async (examId: string, answerKey = false, version?: VersionKey): Promise<Blob> => {
    const qs = new URLSearchParams();
    if (answerKey) qs.set('answers', '1');
    if (version) qs.set('version', version);
    const q = qs.toString();
    const res = await apiClient.post(`/exams/${examId}/pdf${q ? `?${q}` : ''}`, {}, { responseType: 'blob' });
    return res.data;
  },

  getAvailability: async (params: { subjectId?: string; grade?: string; tags?: string[] }): Promise<QuestionAvailability> => {
    const res = await apiClient.get('/exams/questions/availability', {
      params: {
        subjectId: params.subjectId || undefined,
        grade:     params.grade || undefined,
        tags:      params.tags?.length ? params.tags.join(',') : undefined,
      },
    });
    return res.data.data;
  },

  // ─── الربط بالحصص ──────────────────────────────────────────
  linkSession: async (examId: string, sessionId: string): Promise<{ outOf: number }> => {
    const res = await apiClient.post(`/exams/${examId}/link-session`, { sessionId });
    return res.data.data;
  },
  unlinkSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/exams/by-session/${sessionId}`);
  },
  getSessionExam: async (sessionId: string): Promise<SessionExamLink | null> => {
    const res = await apiClient.get(`/exams/by-session/${sessionId}`);
    return res.data.data;
  },
  getLinkedSessions: async (examId: string): Promise<LinkedSession[]> => {
    const res = await apiClient.get(`/exams/${examId}/sessions`);
    return res.data.data;
  },

  // ─── استيراد ───────────────────────────────────────────────
  downloadImportTemplate: async (): Promise<Blob> => {
    const res = await apiClient.get('/exams/questions/import/template', { responseType: 'blob' });
    return res.data;
  },
  importText: async (text: string, opts: ImportOptions): Promise<ImportReport> => {
    const res = await apiClient.post('/exams/questions/import/text', { ...opts, text });
    return res.data.data;
  },
  importExcel: async (file: File, opts: ImportOptions): Promise<ImportReport> => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(opts).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      fd.append(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    const res = await apiClient.post('/exams/questions/import/excel', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // ─── رفع صورة سؤال ─────────────────────────────────────────
  uploadQuestionImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.url as string;
  },
};

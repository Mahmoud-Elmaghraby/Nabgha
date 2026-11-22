import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examsApi } from '../api/exams.api';
import type {
  CreateQuestionPayload,
  UpdateQuestionPayload,
  ListQuestionsParams,
  CreateExamPayload,
  UpdateExamPayload,
  ListExamsParams,
  SaveExamItemPayload,
  GenerateExamPayload,
} from '../types/exam.types';

// ─── Query Keys ───────────────────────────────────────────────
export const EXAM_KEYS = {
  all:          ['exams'] as const,
  questions:    () => ['exams', 'questions'] as const,
  questionList: (p?: ListQuestionsParams) => ['exams', 'questions', 'list', p] as const,
  question:     (id: string) => ['exams', 'questions', id] as const,
  exams:        () => ['exams', 'list'] as const,
  examList:     (p?: ListExamsParams) => ['exams', 'list', p] as const,
  exam:         (id: string) => ['exams', id] as const,
};

// ─── بنك الأسئلة ──────────────────────────────────────────────
export function useQuestions(params?: ListQuestionsParams) {
  return useQuery({
    queryKey: EXAM_KEYS.questionList(params),
    queryFn:  () => examsApi.listQuestions(params),
  });
}

export function useQuestion(id: string) {
  return useQuery({
    queryKey: EXAM_KEYS.question(id),
    queryFn:  () => examsApi.getQuestion(id),
    enabled:  !!id,
  });
}

export function useQuestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: EXAM_KEYS.questions() });

  const createQuestion = useMutation({
    mutationFn: (data: CreateQuestionPayload) => examsApi.createQuestion(data),
    onSuccess: invalidate,
  });

  const updateQuestion = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuestionPayload }) =>
      examsApi.updateQuestion(id, data),
    onSuccess: invalidate,
  });

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => examsApi.deleteQuestion(id),
    onSuccess: invalidate,
  });

  return { createQuestion, updateQuestion, deleteQuestion };
}

// ─── الامتحانات ───────────────────────────────────────────────
export function useExams(params?: ListExamsParams, enabled = true) {
  return useQuery({
    queryKey: EXAM_KEYS.examList(params),
    queryFn:  () => examsApi.listExams(params),
    enabled,
  });
}

export function useExam(id: string) {
  return useQuery({
    queryKey: EXAM_KEYS.exam(id),
    queryFn:  () => examsApi.getExam(id),
    enabled:  !!id,
  });
}

export function useExamMutations() {
  const qc = useQueryClient();
  const invalidateExams     = () => qc.invalidateQueries({ queryKey: EXAM_KEYS.exams() });
  const invalidateQuestions = () => qc.invalidateQueries({ queryKey: EXAM_KEYS.questions() });

  const createExam = useMutation({
    mutationFn: (data: CreateExamPayload) => examsApi.createExam(data),
    onSuccess: invalidateExams,
  });

  const updateExam = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExamPayload }) =>
      examsApi.updateExam(id, data),
    onSuccess: invalidateExams,
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => examsApi.deleteExam(id),
    onSuccess: invalidateExams,
  });

  const saveItems = useMutation({
    mutationFn: ({ examId, items }: { examId: string; items: SaveExamItemPayload[] }) =>
      examsApi.saveExamItems(examId, items),
    onSuccess: (_, { examId }) => {
      qc.invalidateQueries({ queryKey: EXAM_KEYS.exam(examId) });
      invalidateExams();
      invalidateQuestions(); // يحدّث times_used
    },
  });

  const generateExam = useMutation({
    mutationFn: (data: GenerateExamPayload) => examsApi.generateExam(data),
    onSuccess: () => {
      invalidateExams();
      invalidateQuestions();
    },
  });

  return { createExam, updateExam, deleteExam, saveItems, generateExam };
}

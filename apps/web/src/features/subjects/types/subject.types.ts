export type PaymentType = 'monthly' | 'per_session' | 'termly';

export interface SubjectGradeDto {
  id: string;
  subjectId: string;
  grade: string;
  fee: number;
  paymentType: PaymentType;
  sessionDuration: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectWithGradesDto {
  subject: SubjectDto;
  grades: SubjectGradeDto[];
}

export interface CreateSubjectPayload {
  name: string;
  color?: string;
}

export interface UpdateSubjectPayload {
  name?: string;
  color?: string;
  isActive?: boolean;
}

export interface CreateSubjectGradePayload {
  grade: string;
  fee: number;
  paymentType: PaymentType;
  sessionDuration: number;
}

export interface UpdateSubjectGradePayload {
  fee?: number;
  paymentType?: PaymentType;
  sessionDuration?: number;
  isActive?: boolean;
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  monthly: 'شهري',
  per_session: 'بالحصة',
  termly: 'بالترم',
};

export const SUBJECT_COLORS = [
  '#0E3B2E', '#1F6B4E', '#4FBF9F', '#D4AB53',
  '#E74C3C', '#3498DB', '#9B59B6', '#E67E22',
  '#1ABC9C', '#2ECC71', '#F39C12', '#8E44AD',
];

export { GRADE_OPTIONS } from '@nabgha/types';

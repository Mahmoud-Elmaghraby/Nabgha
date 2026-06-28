export interface TeacherDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  subjectIds: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherPayload {
  name: string;
  phone?: string | null;
  email?: string | null;
  subjectIds?: string[];
  notes?: string | null;
}

export interface UpdateTeacherPayload {
  name?: string;
  phone?: string | null;
  email?: string | null;
  subjectIds?: string[];
  notes?: string | null;
  isActive?: boolean;
}

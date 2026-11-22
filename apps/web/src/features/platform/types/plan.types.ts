export interface PlanDto {
  id: string;
  name: string;
  slug: string;
  maxStudents: number;
  price: number;
  features: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanPayload {
  name: string;
  slug: string;
  maxStudents: number;
  price?: number;
  features?: Record<string, any>;
}

export interface UpdatePlanPayload {
  name?: string;
  maxStudents?: number;
  price?: number;
  features?: Record<string, any>;
}

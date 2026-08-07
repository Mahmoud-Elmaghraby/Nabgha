export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  planId: string;
  isActive: boolean;
  schemaName: string;
  limits: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantPayload {
  name: string;
  slug: string;
  planId: string;
  adminUsername: string;
  adminPassword: string;
  adminName: string;
}

export interface UpdateTenantPayload {
  name?: string;
  planId?: string;
  isActive?: boolean;
  limits?: Record<string, any>;
}

export interface PlatformStatsDto {
  total: number;
  active: number;
  inactive: number;
  plans: number;
}

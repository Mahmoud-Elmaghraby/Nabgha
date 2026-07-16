import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { CenterSettingsUseCase } from '../use-cases/center-settings.usecase';
import { ModuleSettingsRepository } from '../../infrastructure/settings.repository';

export type BrandingMode = 'center' | 'teacher';

export interface BrandingInfo {
  name: string;
  phone: string | null;
  phone2: string | null;
  address: string | null;
  logoUrl: string | null;
  source: BrandingMode;
}

export interface BrandingContext {
  teacherId?: string | null;
  groupId?: string | null;
  subjectGradeId?: string | null;
  studentId?: string | null;
  monthlyDueId?: string | null;
}

const BRANDING_SETTING_KEY = 'branding_source';

@Injectable()
export class BrandingService {
  constructor(
    private readonly kysely: KyselyService,
    private readonly centerSettings: CenterSettingsUseCase,
    private readonly moduleSettings: ModuleSettingsRepository,
  ) { }

  async getMode(tenantId: string): Promise<BrandingMode> {
    const raw = await this.moduleSettings.get(tenantId, BRANDING_SETTING_KEY);
    return raw === 'teacher' ? 'teacher' : 'center';
  }

  async setMode(tenantId: string, mode: BrandingMode): Promise<void> {
    await this.moduleSettings.set(tenantId, BRANDING_SETTING_KEY, mode);
  }

  async getBrandingInfo(tenantId: string, context: BrandingContext = {}): Promise<BrandingInfo> {
    const center = await this.centerSettings.getOrCreate(tenantId);
    const centerInfo: BrandingInfo = {
      name: center.centerName,
      phone: center.centerPhone,
      phone2: (center as any).centerPhone2 ?? null,
      address: center.centerAddress,
      logoUrl: center.centerLogoUrl,
      source: 'center',
    };

    const mode = await this.getMode(tenantId);
    if (mode !== 'teacher') return centerInfo;

    const teacherId = await this.resolveTeacherId(tenantId, context);
    if (!teacherId) return centerInfo;

    const db = this.kysely.getTenantDb(tenantId);
    const teacher = await db
      .selectFrom('teachers')
      .select(['name', 'phone', 'phone_2'])
      .where('id', '=', sql<string>`${teacherId}::uuid`)
      .where('deleted_at', 'is', null)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!teacher) return centerInfo;

    return {
      name: teacher.name,
      phone: teacher.phone,
      phone2: (teacher as any).phone_2 ?? null,
      address: null,
      logoUrl: null,
      source: 'teacher',
    };
  }

  private async resolveTeacherId(tenantId: string, context: BrandingContext): Promise<string | null> {
    if (context.teacherId) return context.teacherId;

    const db = this.kysely.getTenantDb(tenantId);

    if (context.monthlyDueId) {
      const due = await db
        .selectFrom('monthly_dues')
        .select(['student_id', 'subject_grade_id'])
        .where('id', '=', sql<string>`${context.monthlyDueId}::uuid`)
        .executeTakeFirst();
      if (due) {
        return this.resolveTeacherId(tenantId, {
          studentId: due.student_id as string,
          subjectGradeId: due.subject_grade_id as string,
        });
      }
      return null;
    }

    if (context.groupId) {
      const group = await db
        .selectFrom('groups')
        .select('teacher_id')
        .where('id', '=', sql<string>`${context.groupId}::uuid`)
        .executeTakeFirst();
      return group?.teacher_id ?? null;
    }

    if (context.subjectGradeId && context.studentId) {
      const row = await db
        .selectFrom('group_students as gs')
        .innerJoin('groups as g', 'g.id', 'gs.group_id')
        .select('g.teacher_id')
        .where('gs.student_id', '=', sql<string>`${context.studentId}::uuid`)
        .where('g.subject_grade_id', '=', sql<string>`${context.subjectGradeId}::uuid`)
        .where('gs.left_at', 'is', null)
        .where('g.deleted_at', 'is', null)
        .executeTakeFirst();
      return row?.teacher_id ?? null;
    }

    return null;
  }
}
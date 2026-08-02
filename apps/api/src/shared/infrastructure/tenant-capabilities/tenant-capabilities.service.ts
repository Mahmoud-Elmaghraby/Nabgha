import { Injectable } from '@nestjs/common';
import { KyselyService } from '../database/kysely.service';

export interface TenantCapabilities {
  hasMultipleSubjects: boolean;
  hasMultipleTeachers: boolean;
}

/**
 * خدمة مشتركة لأي شاشة/تقرير محتاج يعرف: هل المركز ده أصلاً بيدرّس أكتر من
 * مادة واحدة، أو عنده أكتر من مدرس واحد — عشان نقدر نخفي أعمدة/حقول
 * "المادة"/"المدرس" لو أصلاً مفيش تنوع فعلي يستاهل عرضها.
 */
@Injectable()
export class TenantCapabilitiesService {
  constructor(private readonly kysely: KyselyService) {}

  async getCapabilities(tenantId: string): Promise<TenantCapabilities> {
    const db = this.kysely.getTenantDb(tenantId);

    const [subjectsCount, teachersCount] = await Promise.all([
      db.selectFrom('subjects')
        .select(db.fn.countAll<number>().as('cnt'))
        .where('deleted_at', 'is', null)
        .where('is_active', '=', true)
        .executeTakeFirst(),
      db.selectFrom('teachers')
        .select(db.fn.countAll<number>().as('cnt'))
        .where('deleted_at', 'is', null)
        .where('is_active', '=', true)
        .executeTakeFirst(),
    ]);

    return {
      hasMultipleSubjects: Number(subjectsCount?.cnt ?? 0) > 1,
      hasMultipleTeachers: Number(teachersCount?.cnt ?? 0) > 1,
    };
  }
}

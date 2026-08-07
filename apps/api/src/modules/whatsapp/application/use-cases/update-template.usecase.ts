import { Inject, Injectable } from '@nestjs/common';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaTemplateEntity, WaTemplateKey, WA_DEFAULT_TEMPLATES, WA_TEMPLATE_KEYS, WA_TEMPLATE_VARIABLES } from '../../domain/entities/wa-template.entity';
import { AppError } from '../../../../core/errors/app.error';

export interface UpdateTemplateInput {
  tenantId: string;
  key: WaTemplateKey;
  body: string;
}

@Injectable()
export class UpdateTemplateUseCase {
  constructor(
    @Inject(WA_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWaTemplateRepository,
  ) {}

  async execute(input: UpdateTemplateInput): Promise<WaTemplateEntity> {
    const { tenantId, key, body } = input;

    if (body.length > 1000) {
      throw new AppError('TEMPLATE_TOO_LONG', 'نص القالب لا يمكن أن يتجاوز 1000 حرف', 400);
    }

    const requiredVars = WA_TEMPLATE_VARIABLES[key];
    for (const v of requiredVars) {
      if (!body.includes(v)) {
        throw new AppError(
          'MISSING_REQUIRED_VARIABLE',
          `القالب يجب أن يحتوي على المتغير ${v}`,
          400,
        );
      }
    }

    const template = await this.templateRepo.findByKey(tenantId, key);
    if (!template) {
      return this.templateRepo.upsert(tenantId, key, body);
    }

    template.update(body);
    await this.templateRepo.save(template);
    return template;
  }

  async resetToDefault(tenantId: string, key: WaTemplateKey): Promise<WaTemplateEntity> {
    const template = await this.templateRepo.findByKey(tenantId, key);
    if (!template) {
      return this.templateRepo.upsert(tenantId, key, WA_DEFAULT_TEMPLATES[key]);
    }
    template.resetToDefault();
    await this.templateRepo.save(template);
    return template;
  }

  async getAllTemplates(tenantId: string): Promise<WaTemplateEntity[]> {
    const existing = await this.templateRepo.findAllByTenantId(tenantId);
    const existingKeys = existing.map((t) => t.key);

    for (const key of WA_TEMPLATE_KEYS) {
      if (!existingKeys.includes(key)) {
        await this.templateRepo.upsert(tenantId, key, WA_DEFAULT_TEMPLATES[key]);
      }
    }

    return this.templateRepo.findAllByTenantId(tenantId);
  }
}

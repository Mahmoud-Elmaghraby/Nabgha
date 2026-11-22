import { Injectable } from '@nestjs/common';
import { TelegramTemplatesRepository } from '../../infrastructure/telegram-templates.repository';
import {
  TelegramTemplateEntity, TelegramTemplateKey, TELEGRAM_DEFAULT_TEMPLATES,
  TELEGRAM_TEMPLATE_KEYS, TELEGRAM_TEMPLATE_VARIABLES,
} from '../../domain/entities/telegram-template.entity';
import { AppError } from '../../../../core/errors/app.error';

// مرآة لـ UpdateTemplateUseCase (whatsapp) — بجدول telegram_templates المستقل.
export interface UpdateTelegramTemplateInput {
  tenantId: string;
  key: TelegramTemplateKey;
  body: string;
}

@Injectable()
export class UpdateTelegramTemplateUseCase {
  constructor(private readonly templateRepo: TelegramTemplatesRepository) {}

  async execute(input: UpdateTelegramTemplateInput): Promise<TelegramTemplateEntity> {
    const { tenantId, key, body } = input;

    if (body.length > 1000) {
      throw new AppError('TEMPLATE_TOO_LONG', 'نص القالب لا يمكن أن يتجاوز 1000 حرف', 400);
    }

    const requiredVars = TELEGRAM_TEMPLATE_VARIABLES[key];
    for (const v of requiredVars) {
      if (!body.includes(v)) {
        throw new AppError('MISSING_REQUIRED_VARIABLE', `القالب يجب أن يحتوي على المتغير ${v}`, 400);
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

  async resetToDefault(tenantId: string, key: TelegramTemplateKey): Promise<TelegramTemplateEntity> {
    const template = await this.templateRepo.findByKey(tenantId, key);
    if (!template) {
      return this.templateRepo.upsert(tenantId, key, TELEGRAM_DEFAULT_TEMPLATES[key]);
    }
    template.resetToDefault();
    await this.templateRepo.save(template);
    return template;
  }

  async getAllTemplates(tenantId: string): Promise<TelegramTemplateEntity[]> {
    const existing = await this.templateRepo.findAllByTenantId(tenantId);
    const existingKeys = existing.map((t) => t.key);

    for (const key of TELEGRAM_TEMPLATE_KEYS) {
      if (!existingKeys.includes(key)) {
        await this.templateRepo.upsert(tenantId, key, TELEGRAM_DEFAULT_TEMPLATES[key]);
      }
    }

    return this.templateRepo.findAllByTenantId(tenantId);
  }
}

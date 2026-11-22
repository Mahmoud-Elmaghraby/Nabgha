import { Injectable } from '@nestjs/common';
import { TelegramLinksRepository } from '../../infrastructure/telegram-links.repository';

export interface TelegramLinkStatusItem {
  studentId: string;
  isLinked: boolean;
  chatId: string | null;
  linkedAt: Date | null;
}

/**
 * حالة ربط تليجرام لمجموعة طلاب محددة (بمعرفاتهم) — مستخدمة في شاشة "حالة
 * الربط" (settings/telegram → تاب جديد). الفرونت إند بيحدد قائمة الطلاب بنفسه
 * أولاً (عن طريق /whatsapp/audience الموجود أصلاً — نفس آلية اختيار الجمهور
 * المستخدمة في الإرسال الجماعي)، وهنا بنرجّع بس حالة الربط لكل واحد فيهم —
 * صفر تكرار لمنطق فلترة الطلاب حسب مجموعة/مدرّس/صف الموجود بالفعل في
 * ResolveAudienceUseCase.
 */
@Injectable()
export class GetTelegramLinkStatusUseCase {
  constructor(private readonly links: TelegramLinksRepository) {}

  async execute(tenantId: string, studentIds: string[]): Promise<TelegramLinkStatusItem[]> {
    if (studentIds.length === 0) return [];
    const linksMap = await this.links.findLinksForEntities(tenantId, 'student', studentIds);
    return studentIds.map((studentId) => {
      const link = linksMap.get(studentId);
      return {
        studentId,
        isLinked: !!link,
        chatId: link?.chatId ?? null,
        linkedAt: link?.linkedAt ?? null,
      };
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { ReportRegistryService } from './report-registry.service';
import { StudentUseCase } from '../students/application/use-cases/student.usecase';
import { AppError } from '../../core/errors/app.error';

export interface PrintMonthlyReportsInput {
  tenantId: string;
  studentIds: string[];
  month: string;
}

// طباعة/تحميل التقارير الشهرية لأكتر من طالب في ملف PDF واحد — كل طالب في صفحة/صفحات
// منفصلة ورا بعض، عشان المدرس يقدر يطبعهم كلهم مرة واحدة بدل ما يفتح كل طالب لوحده.
// بيعتمد بالكامل على نفس مولّد الـ PDF الموجود لكل طالب (student-monthly-report
// provider.generate) من غير ما يلمسه — بس بيدمج النتايج في ملف واحد بمكتبة pdf-lib.
@Injectable()
export class PrintMonthlyReportsUseCase {
  private readonly logger = new Logger(PrintMonthlyReportsUseCase.name);

  constructor(
    private readonly registry: ReportRegistryService,
    private readonly studentUseCase: StudentUseCase,
  ) {}

  async execute(input: PrintMonthlyReportsInput): Promise<Buffer> {
    const { tenantId, studentIds, month } = input;
    const reportDef = this.registry.get('student-monthly-report');
    if (!reportDef) throw new AppError('NOT_FOUND', 'تقرير الطالب الشهري غير مسجّل', 500);

    const merged = await PDFDocument.create();
    let addedAny = false;

    for (const studentId of studentIds) {
      try {
        // نتأكد إن الطالب موجود فعلاً قبل التوليد — نفس فحص send-monthly-reports.usecase.ts
        await this.studentUseCase.getById(tenantId, studentId);
        const pdfBuffer = await reportDef.generate(tenantId, { studentId, month }, 'pdf');
        const studentPdf = await PDFDocument.load(pdfBuffer);
        const pages = await merged.copyPages(studentPdf, studentPdf.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        addedAny = true;
      } catch (err: any) {
        // لو طالب واحد فشل (بيانات ناقصة مثلاً) منكملش نوقّف الملف كله — نسجّل ونكمل الباقي
        this.logger.warn(`Print monthly report skipped for student ${studentId}: ${err.message}`);
      }
    }

    if (!addedAny) {
      throw new AppError('GENERATION_FAILED', 'تعذّر توليد أي تقرير من الطلاب المختارين', 400);
    }

    const bytes = await merged.save();
    return Buffer.from(bytes);
  }
}

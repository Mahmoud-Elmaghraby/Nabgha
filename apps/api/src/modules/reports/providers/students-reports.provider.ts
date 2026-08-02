import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistryService } from '../report-registry.service';
import { StudentUseCase } from '../../students/application/use-cases/student.usecase';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { STUDENT_EXPORT_COLUMNS } from '../../students/presentation/student-export.columns';
import { ListStudentsSchema } from '../../students/application/dtos/student.dto';
import { ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { formatRowsForPreview, toPreviewColumns } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

@Injectable()
export class StudentsReportsProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly studentUseCase: StudentUseCase,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async fetchStudentsAndColumns(tenantId: string, rawParams: Record<string, any>) {
    const { columns, ...filters } = rawParams;
    const parsed = ListStudentsSchema.parse(filters);
    const { page, limit, ...exportFilters } = parsed;

    const students = await this.studentUseCase.listForExport(tenantId, exportFilters);

    let selectedColumns: ExportColumn<any>[] = STUDENT_EXPORT_COLUMNS;
    if (typeof columns === 'string' && columns.length > 0) {
      const requestedKeys = new Set([...columns.split(','), 'fullName']);
      selectedColumns = STUDENT_EXPORT_COLUMNS.filter((c) => requestedKeys.has(c.key));
    }

    return { students, selectedColumns };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'students-list',
      title: 'قائمة الطلاب',
      description: 'قائمة كاملة بالطلاب مع إمكانية الفلترة والتحكم في الأعمدة الظاهرة',
      category: 'students',

      getPreviewData: async (tenantId, rawParams): Promise<ReportPreviewData> => {
        const { students, selectedColumns } = await this.fetchStudentsAndColumns(tenantId, rawParams);
        return {
          title: 'قائمة الطلاب',
          sections: [{
            title: 'الطلاب',
            columns: toPreviewColumns(selectedColumns),
            rows: formatRowsForPreview(students, selectedColumns),
          }],
        };
      },

      generate: async (tenantId, rawParams, format) => {
        const { students, selectedColumns } = await this.fetchStudentsAndColumns(tenantId, rawParams);
        const options = { title: 'قائمة الطلاب' };
        return format === 'xlsx'
          ? this.excelExport.generate(students, selectedColumns, options)
          : this.pdfExport.generate(students, selectedColumns, options);
      },
    });
  }
}

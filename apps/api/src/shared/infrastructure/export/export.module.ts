import { Module } from '@nestjs/common';
import { ExcelExportService } from './excel-export.service';
import { PdfExportService } from './pdf-export.service';

@Module({
  providers: [ExcelExportService, PdfExportService],
  exports: [ExcelExportService, PdfExportService],
})
export class ExportModule {}

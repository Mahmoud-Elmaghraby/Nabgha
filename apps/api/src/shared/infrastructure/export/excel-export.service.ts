import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExportColumn, ExportOptions, CompositeReportOptions } from './export.types';

const DEFAULT_HEADER_COLOR = '333333';
const DEFAULT_COLUMN_WIDTH = 20;

@Injectable()
export class ExcelExportService {
  async generate<T extends Record<string, any>>(
    rows: T[],
    columns: ExportColumn<T>[],
    options: ExportOptions = {},
  ): Promise<Buffer> {
    const rtl = options.rtl ?? true;
    const headerColor = (options.headerColor ?? DEFAULT_HEADER_COLOR).replace('#', '');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نبغة';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(options.title ?? 'Sheet1', {
      views: [{ rightToLeft: rtl }],
    });

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? DEFAULT_COLUMN_WIDTH,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${headerColor.toUpperCase()}` },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const row of rows) {
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const rawValue = row[col.key];
        rowData[col.key] = col.format ? col.format(rawValue, row) : rawValue;
      }
      const addedRow = worksheet.addRow(rowData);
      columns.forEach((col, idx) => {
        if (col.align) {
          addedRow.getCell(idx + 1).alignment = { horizontal: col.align };
        }
      });
    }

    if (columns.length > 0 && rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * تقرير مركّب: كل section بيتحول لـ Sheet منفصل، مع Sheet أول اسمه "ملخص"
   * لو فيه summary items.
   */
  async generateReport(options: CompositeReportOptions): Promise<Buffer> {
    const rtl = options.rtl ?? true;
    const headerColor = (options.headerColor ?? DEFAULT_HEADER_COLOR).replace('#', '');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نبغة';
    workbook.created = new Date();

    if (options.summary && options.summary.length > 0) {
      const summarySheet = workbook.addWorksheet('ملخص', { views: [{ rightToLeft: rtl }] });
      summarySheet.columns = [
        { header: 'البند', key: 'label', width: 30 },
        { header: 'القيمة', key: 'value', width: 20 },
      ];
      const headerRow = summarySheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerColor.toUpperCase()}` } };
      });
      for (const item of options.summary) {
        summarySheet.addRow({ label: item.label, value: item.value });
      }
    }

    for (const section of options.sections) {
      const sheetName = section.title.slice(0, 31); // Excel بيحد اسم الـ Sheet بـ 31 حرف
      const worksheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: rtl }] });
      worksheet.columns = section.columns.map((col) => ({
        header: col.header, key: col.key, width: col.width ?? DEFAULT_COLUMN_WIDTH,
      }));
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerColor.toUpperCase()}` } };
      });
      for (const row of section.rows) {
        const rowData: Record<string, any> = {};
        for (const col of section.columns) {
          const rawValue = row[col.key];
          rowData[col.key] = col.format ? col.format(rawValue, row) : rawValue;
        }
        worksheet.addRow(rowData);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

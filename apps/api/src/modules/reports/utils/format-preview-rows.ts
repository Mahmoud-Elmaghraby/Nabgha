import { ExportColumn, CompositeReportOptions } from '../../../shared/infrastructure/export/export.types';
import { ReportPreviewData } from '../report.types';

export function formatRowsForPreview<T>(rows: T[], columns: ExportColumn<T>[]): Record<string, any>[] {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const col of columns) {
      const raw = (row as any)[col.key];
      out[col.key] = col.format ? col.format(raw, row) : raw;
    }
    return out;
  });
}

export function toPreviewColumns<T>(columns: ExportColumn<T>[]): { key: string; header: string }[] {
  return columns.map((c) => ({ key: c.key, header: c.header }));
}

/** يحوّل خيارات تقرير مركّب (زي كشف حساب طالب) لصيغة معاينة موحّدة دفعة واحدة */
export function compositeToPreviewData(options: CompositeReportOptions): ReportPreviewData {
  return {
    title: options.title,
    subtitle: options.subtitle,
    summary: options.summary,
    sections: options.sections.map((section) => ({
      title: section.title,
      columns: toPreviewColumns(section.columns),
      rows: formatRowsForPreview(section.rows, section.columns),
    })),
  };
}

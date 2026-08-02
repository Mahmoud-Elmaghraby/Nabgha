export interface ReportDefinition {
  key: string;
  title: string;
  description?: string;
  category: string;
}

export type ReportFormat = 'xlsx' | 'pdf';

export interface ReportPreviewColumn {
  key: string;
  header: string;
}

export interface ReportPreviewSummaryItem {
  label: string;
  value: string | number;
}

export interface ReportPreviewSection {
  title: string;
  columns: ReportPreviewColumn[];
  rows: Record<string, any>[];
}

export interface ReportPreviewData {
  title: string;
  subtitle?: string;
  summary?: ReportPreviewSummaryItem[];
  sections: ReportPreviewSection[];
}

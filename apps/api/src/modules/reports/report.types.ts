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

export interface ReportDefinition {
  /** مفتاح فريد يُستخدم في الـ URL: /reports/:key/preview و /reports/:key/generate */
  key: string;
  title: string;
  description?: string;
  category: string;
  /** بيانات خام (JSON) للمعاينة السريعة قبل التوليد الفعلي للملف */
  getPreviewData: (tenantId: string, params: Record<string, any>) => Promise<ReportPreviewData>;
  /** توليد الملف الفعلي (Excel/PDF) بس لما المستخدم يقرر التحميل */
  generate: (tenantId: string, params: Record<string, any>, format: ReportFormat) => Promise<Buffer>;
}

export type ExportFormat = 'pdf' | 'xlsx';

export interface ExportColumn<T = any> {
  /** المفتاح في الـ object (اسم الحقل) */
  key: string;
  /** العنوان الظاهر في رأس العمود */
  header: string;
  /** عرض العمود بالإكسل فقط (تقديري بوحدة الحروف) */
  width?: number;
  /** محاذاة النص */
  align?: 'left' | 'right' | 'center';
  /** دالة تنسيق اختيارية لتحويل القيمة الخام لنص معروض */
  format?: (value: any, row: T) => string;
}

export interface ExportOptions {
  /** عنوان التقرير الظاهر أعلى الملف */
  title?: string;
  /** عنوان فرعي (مثلاً اسم المركز أو الفترة الزمنية) */
  subtitle?: string;
  /** اتجاه الصفحة (بيؤثر على PDF فقط) */
  orientation?: 'portrait' | 'landscape';
  /** اتجاه الكتابة، افتراضيًا true (RTL) */
  rtl?: boolean;
  /** لون رأس الجدول (hex)، افتراضيًا رمادي محايد */
  headerColor?: string;
}

export interface ReportSection<T = any> {
  /** عنوان القسم، يظهر كـ Sheet name في Excel وكعنوان فرعي في PDF */
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

export interface ReportSummaryItem {
  label: string;
  value: string | number;
}

export interface CompositeReportOptions {
  /** عنوان التقرير الرئيسي */
  title: string;
  /** عنوان فرعي (مثلاً اسم الطالب) */
  subtitle?: string;
  /** ملخص أرقام يظهر أعلى التقرير (مثال: إجمالي المستحق، إجمالي المدفوع) */
  summary?: ReportSummaryItem[];
  sections: ReportSection[];
  rtl?: boolean;
  headerColor?: string;
}

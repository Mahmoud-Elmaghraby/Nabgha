import { DataTable } from '@/shared/components';
import type { Column } from '@/shared/components';
import type { ReportPreviewSection } from '../types/report.types';

interface Props {
  section: ReportPreviewSection;
  isLoading?: boolean;
  showTitle?: boolean;
}

export function SectionDataTable({ section, isLoading, showTitle = true }: Props) {
  const columns: Column<Record<string, any>>[] = section.columns.map((col) => ({
    key: col.key,
    header: col.header,
    render: (row) => <span>{row[col.key] ?? '-'}</span>,
  }));

  // نضيف مفتاح فريد لكل صف (بيانات المعاينة الخام مالهاش id ثابت دايماً)
  const dataWithKeys = section.rows.map((row, i) => ({ ...row, __rowKey: String(i) }));

  return (
    <div>
      {showTitle && section.title && (
        <h3 className="text-sm font-bold text-gray-700 mb-2">{section.title}</h3>
      )}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <DataTable
          columns={columns}
          data={dataWithKeys}
          keyExtractor={(r) => r.__rowKey}
          isLoading={isLoading}
          emptyTitle="لا توجد بيانات"
          emptySubtitle="جرّب تعديل الفلاتر"
        />
      </div>
    </div>
  );
}

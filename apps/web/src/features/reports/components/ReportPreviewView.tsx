import type { ReportPreviewData } from '../types/report.types';

interface Props {
  data: ReportPreviewData;
}

export function ReportPreviewView({ data }: Props) {
  return (
    <div className="space-y-4">
      {data.subtitle && (
        <p className="text-sm text-gray-500">{data.subtitle}</p>
      )}

      {data.summary && data.summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.summary.map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className="text-sm font-bold text-[#0E3B2E]">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {data.sections.map((section, i) => (
        <div key={i}>
          {data.sections.length > 1 && (
            <h3 className="text-xs font-bold text-gray-500 mb-2">{section.title}</h3>
          )}
          <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto max-h-72 overflow-y-auto">
            {section.rows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {section.columns.map((col) => (
                      <th key={col.key} className="text-right py-2 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {section.rows.map((row, ri) => (
                    <tr key={ri}>
                      {section.columns.map((col) => (
                        <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                          {String(row[col.key] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

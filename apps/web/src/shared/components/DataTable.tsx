import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  skeletonRows?: number;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

function MobileCard<T>({
  row,
  columns,
  onClick,
}: {
  row: T;
  columns: Column<T>[];
  onClick?: () => void;
}) {
  const primaryCol = columns[0];
  const actionsCol = columns.find((c) => c.key === 'actions');
  const middleCols = columns.filter((c) => c.key !== columns[0].key && c.key !== 'actions' && !c.hideOnMobile);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 p-4 ${onClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
    >
      {/* Primary + Actions row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {primaryCol.render(row)}
        </div>
        {actionsCol && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {actionsCol.render(row)}
          </div>
        )}
      </div>

      {/* Middle columns grid */}
      {middleCols.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-gray-50">
          {middleCols.map((col) => (
            <div key={col.key}>
              <div className="text-xs text-gray-400 mb-1">{col.header}</div>
              <div className="text-sm">{col.render(row)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3 mb-1.5" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2 mb-1" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyIcon,
  emptyTitle = 'لا توجد بيانات',
  emptySubtitle = 'لا توجد عناصر للعرض حالياً',
  onRowClick,
  isLoading = false,
  skeletonRows = 5,
}: DataTableProps<T>) {
  if (!isLoading && data.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        {emptyIcon ? (
          <img src={emptyIcon} alt="" className="w-20 h-20 object-contain mx-auto mb-4 opacity-20" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M11 12h2" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <p className="text-gray-900 font-semibold text-base mb-1">{emptyTitle}</p>
        <p className="text-gray-400 text-sm">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))
              : data.map((row) => (
                  <tr
                    key={keyExtractor(row)}
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50/70' : 'hover:bg-gray-50/40'}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="py-3.5 px-4">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 p-4">
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <MobileCardSkeleton key={i} />
            ))
          : data.map((row) => (
              <MobileCard
                key={keyExtractor(row)}
                row={row}
                columns={columns}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              />
            ))}
      </div>
    </>
  );
}

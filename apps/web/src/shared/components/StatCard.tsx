import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'green' | 'gold' | 'red' | 'blue' | 'gray';
  onClick?: () => void;
}

const COLOR_STYLES = {
  green: {
    icon: 'bg-[#0E3B2E]/10 text-[#0E3B2E]',
    value: 'text-[#0E3B2E]',
    trend_up: 'text-emerald-600 bg-emerald-50',
    trend_down: 'text-red-500 bg-red-50',
  },
  gold: {
    icon: 'bg-[#D4AB53]/10 text-[#D4AB53]',
    value: 'text-[#D4AB53]',
    trend_up: 'text-emerald-600 bg-emerald-50',
    trend_down: 'text-red-500 bg-red-50',
  },
  red: {
    icon: 'bg-red-50 text-red-500',
    value: 'text-red-600',
    trend_up: 'text-emerald-600 bg-emerald-50',
    trend_down: 'text-red-500 bg-red-50',
  },
  blue: {
    icon: 'bg-blue-50 text-blue-500',
    value: 'text-blue-600',
    trend_up: 'text-emerald-600 bg-emerald-50',
    trend_down: 'text-red-500 bg-red-50',
  },
  gray: {
    icon: 'bg-gray-100 text-gray-500',
    value: 'text-gray-700',
    trend_up: 'text-emerald-600 bg-emerald-50',
    trend_down: 'text-red-500 bg-red-50',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'green',
  onClick,
}: StatCardProps) {
  const styles = COLOR_STYLES[color];
  const isUp = (trend?.value ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl border border-gray-100 p-4 md:p-5
        flex flex-col gap-3
        transition-all duration-150
        ${onClick ? 'cursor-pointer hover:border-gray-200 hover:shadow-sm active:scale-[0.98]' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-400 font-medium truncate">{title}</p>
        </div>
        {icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${styles.icon}`}>
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className={`text-2xl md:text-3xl font-bold tracking-tight ${styles.value}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isUp ? styles.trend_up : styles.trend_down}`}>
            <svg
              className={`w-3 h-3 transition-transform ${isUp ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}

const GRID_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

export function StatGrid({ children, cols = 4 }: StatGridProps) {
  return (
    <div className={`grid ${GRID_COLS[cols]} gap-3 md:gap-4`}>
      {children}
    </div>
  );
}

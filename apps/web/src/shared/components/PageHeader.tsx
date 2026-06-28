import { ReactNode } from 'react';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: Action[];
  backButton?: {
    label: string;
    onClick: () => void;
  };
}

const ACTION_STYLES: Record<string, string> = {
  primary: 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E] active:scale-95',
  secondary: 'bg-white text-[#0E3B2E] border border-gray-200 hover:bg-gray-50 active:scale-95',
  danger: 'bg-white text-red-600 border border-red-100 hover:bg-red-50 active:scale-95',
};

export function PageHeader({ title, subtitle, actions = [], backButton }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 md:py-5">
      {backButton && (
        <button
          onClick={backButton.onClick}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0E3B2E] transition-colors mb-3"
        >
          <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backButton.label}
        </button>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-[#0E3B2E] truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`
                  flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                  ${ACTION_STYLES[action.variant ?? 'primary']}
                `}
              >
                {action.icon && (
                  <span className="w-4 h-4 flex items-center justify-center">
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

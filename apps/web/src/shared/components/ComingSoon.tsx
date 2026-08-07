interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-gray-400 text-sm mb-8">{description || 'إدارة ' + title}</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#0E3B2E]/5 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#0E3B2E]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">قريباً</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          هذه الصفحة قيد التطوير وستكون متاحة في التحديثات القادمة
        </p>
      </div>
    </div>
  );
}

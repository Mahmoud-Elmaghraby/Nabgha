import { useState } from 'react';
import { PageHeader } from '@/shared/components';
import { QuestionsBankPage } from './QuestionsBankPage';
import { ExamsListPage } from './ExamsListPage';

export default function ExamsPage() {
  const [activeTab, setActiveTab] = useState<'bank' | 'exams'>('exams');

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="بنك الأسئلة والامتحانات"
        subtitle="إنشاء وإدارة بنوك الأسئلة وتوليد وتصدير الامتحانات المطبوعة"
      />

      <div className="px-4 md:px-6 pt-4">
        {/* التبويبات الرئيسية */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4 pt-2">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'exams'
                ? 'border-[#0E3B2E] text-[#0E3B2E]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            الامتحانات والنماذج
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'bank'
                ? 'border-[#0E3B2E] text-[#0E3B2E]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            بنك الأسئلة
          </button>
        </div>

        {/* محتوى التبويب */}
        {activeTab === 'exams' ? <ExamsListPage /> : <QuestionsBankPage />}
      </div>
    </div>
  );
}

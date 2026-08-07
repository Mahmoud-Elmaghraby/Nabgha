import { useState } from 'react';
import { PageHeader } from '@/shared/components';
import { WaConnectionCard } from '../components/WaConnectionCard';
import { WaSettingsCard } from '../components/WaSettingsCard';
import { WaTemplatesCard } from '../components/WaTemplatesCard';
import { WaBulkSend } from '../components/WaBulkSend';
import { WaMessagesLog } from '../components/WaMessagesLog';

type Tab = 'connection' | 'settings' | 'templates' | 'bulk' | 'messages';

const TABS: { key: Tab; label: string }[] = [
  { key: 'connection', label: 'الاتصال' },
  { key: 'settings', label: 'الإعدادات' },
  { key: 'templates', label: 'القوالب' },
  { key: 'bulk', label: 'إرسال جماعي' },
  { key: 'messages', label: 'سجل الرسائل' },
];

export default function WhatsAppPage() {
  const [tab, setTab] = useState<Tab>('connection');

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="واتساب"
        subtitle="إدارة الاتصال والإشعارات والرسائل الجماعية"
      />

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#0E3B2E] text-[#0E3B2E]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {tab === 'connection' && <WaConnectionCard />}
        {tab === 'settings' && <WaSettingsCard />}
        {tab === 'templates' && <WaTemplatesCard />}
        {tab === 'bulk' && <WaBulkSend />}
        {tab === 'messages' && <WaMessagesLog />}
      </div>
    </div>
  );
}

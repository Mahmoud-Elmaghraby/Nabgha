import { useState } from 'react';
import { PageHeader } from '@/shared/components';
import { CenterSettingsForm } from '../components/CenterSettingsForm';
import { SubjectsManager } from '../../subjects/components/SubjectsManager';
import { CardDesignerForm } from '../components/CardDesignerForm';
import { TelegramSettingsForm } from '../components/TelegramSettingsForm';
import { BrandingSettingsForm } from '../components/BrandingSettingsForm';
import { BackupSettingsForm } from '../components/BackupSettingsForm';

type Tab = 'center' | 'subjects' | 'card' | 'telegram' | 'branding' | 'backup';

const TABS: { key: Tab; label: string }[] = [
  { key: 'center', label: 'بيانات المركز' },
  { key: 'subjects', label: 'المواد الدراسية' },
  { key: 'card', label: 'إعداد الكارت' },
  { key: 'telegram', label: 'تليجرام' },
  { key: 'branding', label: 'الهوية في الرسائل' },
  { key: 'backup', label: 'النسخ الاحتياطي' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('center');

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات المركز والمواد الدراسية"
      />

      <div className="bg-white border-b border-gray-100 px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto">
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

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {tab === 'center' && <CenterSettingsForm />}
          {tab === 'subjects' && <SubjectsManager />}
          {tab === 'card' && <CardDesignerForm />}
          {tab === 'telegram' && <TelegramSettingsForm />}
          {tab === 'branding' && <BrandingSettingsForm />}
          {tab === 'backup' && <BackupSettingsForm />}
        </div>
      </div>
    </div>
  );
}

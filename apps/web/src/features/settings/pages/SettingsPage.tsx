import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/shared/components';
import { CenterSettingsForm } from '../components/CenterSettingsForm';
import { SubjectsManager } from '../../subjects/components/SubjectsManager';
import { CardDesignerForm } from '../components/CardDesignerForm';
import { BrandingSettingsForm } from '../components/BrandingSettingsForm';
import { BackupSettingsForm } from '../components/BackupSettingsForm';
import { backupApi } from '../api/backup.api';

type Tab = 'center' | 'subjects' | 'card' | 'branding' | 'backup';

const TABS: { key: Tab; label: string }[] = [
  { key: 'center', label: 'بيانات المركز' },
  { key: 'subjects', label: 'المواد الدراسية' },
  { key: 'card', label: 'إعداد الكارت' },
  { key: 'branding', label: 'الهوية في الرسائل' },
  { key: 'backup', label: 'النسخ الاحتياطي' },
];

export default function SettingsPage() {
  // ?tab=backup بيفتح التبويب على طول (تنبيه النسخ الاحتياطي في الصفحة الرئيسية)
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.some(t => t.key === initialTab) ? (initialTab as Tab) : 'center');
  // BACKUP-006: تبويب النسخ الاحتياطي بيظهر في الديسكتوب بس
  const { data: backupAvailable = false } = useQuery({
    queryKey: ['backup-availability'],
    queryFn: () => backupApi.isAvailable(),
    staleTime: Infinity,
  });
  const visibleTabs = TABS.filter(t => t.key !== 'backup' || backupAvailable);

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات المركز والمواد الدراسية"
      />

      <div className="bg-white border-b border-gray-100 px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map(t => (
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
          {tab === 'branding' && <BrandingSettingsForm />}
          {tab === 'backup' && backupAvailable && <BackupSettingsForm />}
        </div>
      </div>
    </div>
  );
}

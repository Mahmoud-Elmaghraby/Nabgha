import { PageHeader } from '@/shared/components';
import { TelegramSettingsForm } from '../components/TelegramSettingsForm';

export default function TelegramPage() {
  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="تليجرام"
        subtitle="إدارة الاتصال والإشعارات والرسائل الجماعية عبر تليجرام"
      />

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <TelegramSettingsForm />
        </div>
      </div>
    </div>
  );
}

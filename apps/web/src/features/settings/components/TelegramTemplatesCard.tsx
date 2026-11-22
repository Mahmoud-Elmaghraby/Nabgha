import { useState, useEffect } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { useConfirm } from '@/shared/components/Confirm';
import { usePermissions } from '@/shared/hooks/usePermissions';

// مرآة لـ WaTemplatesCard (apps/web/src/features/whatsapp/components/WaTemplatesCard.tsx)
// بس على قوالب تليجرام المستقلة تمامًا عن قوالب الواتساب.

type TelegramTemplateKey =
  | 'ABSENT' | 'PRESENT' | 'LATE' | 'THREE_ABSENCES'
  | 'PAYMENT_CONFIRM' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE'
  | 'NEW_STUDENT' | 'GROUP_ADDED' | 'GROUP_REMOVED' | 'ABSENCE_EXCUSED' | 'GRADE_RECORDED';

interface TelegramTemplateDto {
  id: string;
  key: string;
  body: string;
  isDefault: boolean;
}

const TELEGRAM_TEMPLATE_LABELS: Record<TelegramTemplateKey, string> = {
  ABSENT: 'إشعار الغياب',
  PRESENT: 'إشعار الحضور',
  LATE: 'إشعار التأخير',
  THREE_ABSENCES: 'تنبيه 3 غيابات متتالية',
  PAYMENT_CONFIRM: 'تأكيد الدفع',
  PAYMENT_DUE: 'تذكير موعد الدفع',
  PAYMENT_OVERDUE: 'تنبيه تأخر السداد',
  NEW_STUDENT: 'ترحيب بالطالب الجديد',
  GROUP_ADDED: 'إضافة لمجموعة',
  GROUP_REMOVED: 'إزالة من مجموعة',
  ABSENCE_EXCUSED: 'إعفاء غياب (حضور بديل)',
  GRADE_RECORDED: 'تسجيل درجة',
};

const TELEGRAM_TEMPLATE_VARIABLES: Record<TelegramTemplateKey, string[]> = {
  ABSENT: ['{student_name}', '{subject}', '{date}'],
  PRESENT: ['{student_name}', '{subject}', '{time}'],
  LATE: ['{student_name}', '{subject}', '{date}'],
  THREE_ABSENCES: ['{student_name}', '{subject}', '{count}'],
  PAYMENT_CONFIRM: ['{student_name}', '{amount}', '{date}', '{center_name}'],
  PAYMENT_DUE: ['{student_name}', '{amount}', '{days}', '{center_name}'],
  PAYMENT_OVERDUE: ['{student_name}', '{amount}', '{days}'],
  NEW_STUDENT: ['{student_name}', '{center_name}'],
  GROUP_ADDED: ['{student_name}', '{group_name}', '{days}', '{time}', '{center_name}'],
  GROUP_REMOVED: ['{student_name}', '{group_name}', '{center_name}'],
  ABSENCE_EXCUSED: ['{student_name}', '{subject}', '{date}'],
  GRADE_RECORDED: ['{student_name}', '{subject}', '{date}', '{degree}', '{out_of}'],
};

const PREVIEW_VARS: Record<string, string> = {
  student_name: 'أحمد محمد',
  subject: 'الرياضيات',
  date: 'الأحد 15 يونيو',
  time: '4:00 م',
  amount: '500',
  days: '7',
  count: '3',
  center_name: 'نبغة',
  group_name: 'الأول الثانوي',
  degree: '18',
  out_of: '20',
};

function renderPreview(body: string): string {
  let result = body;
  for (const [key, value] of Object.entries(PREVIEW_VARS)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

interface TemplateEditorProps {
  template: TelegramTemplateDto;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const confirm = useConfirm();
  const vars = TELEGRAM_TEMPLATE_VARIABLES[template.key as TelegramTemplateKey] ?? [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/telegram/templates/${template.key}`, { body });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!(await confirm('هل تريد الرجوع للنص الافتراضي؟'))) return;
    setResetting(true);
    try {
      await apiClient.post(`/telegram/templates/${template.key}/reset`);
      onSaved();
      onClose();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl z-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#0E3B2E]">{TELEGRAM_TEMPLATE_LABELS[template.key as TelegramTemplateKey]}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">نص الرسالة</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">المتغيرات المتاحة:</span>
              <span className="text-xs text-gray-400">{body.length}/1000</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {vars.map(v => (
                <button
                  key={v}
                  onClick={() => setBody(prev => prev + v)}
                  className="text-xs px-2 py-0.5 bg-[#0E3B2E]/10 text-[#0E3B2E] rounded hover:bg-[#0E3B2E]/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">معاينة</label>
            <div className="bg-[#E7F3FF] rounded-xl rounded-tl-sm p-3 text-sm text-gray-800 leading-relaxed">
              {renderPreview(body)}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-left">تليجرام · الآن</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleReset}
            disabled={template.isDefault || resetting}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            رجوع للافتراضي
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TelegramTemplatesCard() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('settings.edit');
  const [templates, setTemplates] = useState<TelegramTemplateDto[] | null>(null);
  const [editing, setEditing] = useState<TelegramTemplateDto | null>(null);

  const load = async () => {
    const res = await apiClient.get('/telegram/templates');
    setTemplates(res.data.data);
  };

  useEffect(() => { load(); }, []);

  if (!templates) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mb-4" />
      {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded animate-pulse mb-2" />)}
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-5" dir="rtl">
        <h3 className="font-bold text-[#0E3B2E] text-base mb-4">قوالب رسائل تليجرام</h3>
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {TELEGRAM_TEMPLATE_LABELS[t.key as TelegramTemplateKey] ?? t.key}
                  </span>
                  {t.isDefault && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">افتراضي</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{t.body}</p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setEditing(t)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-white transition-colors shrink-0 mr-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/lib/api/client';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useWaTemplates, useWaMutations } from '../hooks/useWhatsapp';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { WA_TEMPLATE_LABELS, WA_TEMPLATE_VARIABLES } from '../types/whatsapp.types';
import type { WaTemplateDto, WaTemplateKey } from '../types/whatsapp.types';

const PREVIEW_VARS: Record<string, string> = {
  student_name: 'أحمد محمد',
  subject: 'الرياضيات',
  date: 'الأحد 15 يونيو',
  time: '4:00 م',
  amount: '500',
  days: '7',
  count: '3',
  degree: '22',
  out_of: '25',
  link: 'https://t.me/example',
  group_name: 'الأول الثانوي',
};

// اسم المركز/المدرس الفعلي من إعدادات الهوية (نفس مصدر الرسائل الحقيقية)
function useCenterName(): string {
  const { data } = useQuery({
    queryKey: ['branding-info', null],
    queryFn: async () => {
      const res = await apiClient.get('/settings/branding-info');
      return res.data.data as { name: string };
    },
    staleTime: 1000 * 30,
  });
  return data?.name || 'اسم المركز';
}

function renderPreview(body: string, centerName: string): string {
  let result = body;
  for (const [key, value] of Object.entries({ ...PREVIEW_VARS, center_name: centerName })) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

interface TemplateEditorProps {
  template: WaTemplateDto;
  onClose: () => void;
}

function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const [body, setBody] = useState(template.body);
  const confirm = useConfirm();
  const { updateTemplate, resetTemplate } = useWaMutations();
  const toast = useToast();
  const centerName = useCenterName();
  const vars = WA_TEMPLATE_VARIABLES[template.key as WaTemplateKey] ?? [];
  const missing = vars.filter(v => !body.includes(v));

  const handleSave = async () => {
    if (missing.length > 0) {
      toast.error(`القالب لازم يحتوي على: ${missing.join('  ')}`);
      return;
    }
    try {
      await updateTemplate.mutateAsync({ key: template.key as WaTemplateKey, body });
      toast.success('تم حفظ القالب');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'تعذر حفظ القالب');
    }
  };

  const handleReset = async () => {
    if (!(await confirm('هل تريد الرجوع للنص الافتراضي؟'))) return;
    try {
      await resetTemplate.mutateAsync(template.key as WaTemplateKey);
      toast.success('تم الرجوع للنص الافتراضي');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'تعذر الرجوع للافتراضي');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl z-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#0E3B2E]">{WA_TEMPLATE_LABELS[template.key as WaTemplateKey]}</h3>
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
                  type="button"
                  key={v}
                  onClick={() => setBody(prev => prev + v)}
                  className="text-xs px-2 py-0.5 bg-[#0E3B2E]/10 text-[#0E3B2E] rounded hover:bg-[#0E3B2E]/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-red-500 mt-2">
                متغيرات ناقصة (مطلوبة للحفظ): {missing.join('  ')}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">معاينة</label>
            <div className="bg-[#DCF8C6] rounded-xl rounded-tl-sm p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {renderPreview(body, centerName)}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-left">✓✓ الآن</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleReset}
            disabled={template.isDefault || resetTemplate.isPending}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            رجوع للافتراضي
          </button>
          <button
            onClick={handleSave}
            disabled={updateTemplate.isPending}
            className="flex-1 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50"
          >
            {updateTemplate.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WaTemplatesCard() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('settings.edit');
  const { data: templates, isLoading } = useWaTemplates();
  const [editing, setEditing] = useState<WaTemplateDto | null>(null);

  if (isLoading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mb-4" />
      {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded animate-pulse mb-2" />)}
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-bold text-[#0E3B2E] text-base mb-4">قوالب الرسائل</h3>
        <div className="space-y-2">
          {templates?.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {WA_TEMPLATE_LABELS[t.key as WaTemplateKey] ?? t.key}
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

      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

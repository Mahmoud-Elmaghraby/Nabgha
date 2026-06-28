import { useState } from 'react';
import { useWaMutations, useWaBulkProgress } from '../hooks/useWhatsapp';

export function WaBulkSend() {
  const { sendBulk } = useWaMutations();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [phones, setPhones] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: progress } = useWaBulkProgress(jobId);

  const parsePhones = (text: string): string[] => {
    return text
      .split(/[\n,،]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);
  };

  const handleSend = async () => {
    setError('');
    const phoneList = parsePhones(phones);
    if (!title.trim()) return setError('العنوان مطلوب');
    if (!body.trim()) return setError('نص الرسالة مطلوب');
    if (phoneList.length === 0) return setError('أدخل أرقام تليفون صحيحة');

    const result = await sendBulk.mutateAsync({ title, body, phones: phoneList });
    setJobId(result.jobId);
  };

  const isRunning = progress?.status === 'running' || progress?.status === 'pending';

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <h3 className="font-bold text-[#0E3B2E] text-base">إرسال جماعي</h3>

      {!jobId ? (
        <>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">عنوان الحملة</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تذكير امتحان الأسبوع القادم"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">نص الرسالة</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="اكتب الرسالة هنا..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <div className="text-left text-xs text-gray-400 mt-1">{body.length}/1000</div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              أرقام التليفون <span className="text-gray-400">(كل رقم في سطر أو مفصول بفاصلة)</span>
            </label>
            <textarea
              value={phones}
              onChange={e => setPhones(e.target.value)}
              rows={4}
              placeholder="01012345678&#10;01098765432&#10;..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 font-mono"
              dir="ltr"
            />
            <p className="text-xs text-gray-400 mt-1">
              {parsePhones(phones).length} رقم صحيح
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleSend}
            disabled={sendBulk.isPending}
            className="w-full py-2.5 bg-[#0E3B2E] text-white text-sm font-medium rounded-lg hover:bg-[#1F6B4E] transition-colors disabled:opacity-50"
          >
            {sendBulk.isPending ? 'جاري الإرسال...' : `إرسال لـ ${parsePhones(phones).length} رقم`}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${
              progress?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
              progress?.status === 'cancelled' ? 'bg-red-50 text-red-600' :
              'bg-amber-50 text-amber-700'
            }`}>
              {progress?.status === 'completed' ? 'اكتمل' :
               progress?.status === 'cancelled' ? 'ملغي' :
               progress?.status === 'running' ? 'جاري الإرسال' : 'في الانتظار'}
            </span>
            <span className="text-sm font-bold text-[#0E3B2E]">{progress?.progress ?? 0}%</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#4FBF9F] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress?.progress ?? 0}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{progress?.total ?? 0}</div>
              <div className="text-xs text-gray-400">الإجمالي</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-700">{progress?.sent ?? 0}</div>
              <div className="text-xs text-emerald-600">وصلت</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-600">{progress?.failed ?? 0}</div>
              <div className="text-xs text-red-500">فشلت</div>
            </div>
          </div>

          {!isRunning && (
            <button
              onClick={() => { setJobId(null); setTitle(''); setBody(''); setPhones(''); }}
              className="w-full py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              إرسال جديد
            </button>
          )}
        </div>
      )}
    </div>
  );
}

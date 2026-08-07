import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';

function useTelegramSettings() {
  return useQuery({
    queryKey: ['settings', 'telegram'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/card-designer');
      const tokenRes = await apiClient.get('/telegram/bot-info').catch(() => ({ data: { data: null } }));
      return { botInfo: tokenRes.data.data };
    },
  });
}

export function TelegramSettingsForm() {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username: string; name: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async () => {
    if (!token.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      // احفظ الـ token أول
      await apiClient.put('/settings/telegram', { token });
      // بعدين تحقق
      const res = await apiClient.get('/telegram/bot-info');
      if (res.data.data) {
        setBotInfo(res.data.data);
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg('البوت مش شغال — تأكد من الـ Token');
      }
    } catch {
      setStatus('error');
      setErrorMsg('فشل الاتصال — تأكد من الـ Token');
    }
  };

  const handleSetWebhook = async () => {
    setWebhookStatus('loading');
    try {
      const res = await apiClient.post('/telegram/setup-webhook');
      if (res.data.success) {
        setWebhookStatus('success');
      } else {
        setWebhookStatus('error');
      }
    } catch {
      setWebhookStatus('error');
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* شرح */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-bold text-blue-800">📱 إعداد بوت التليجرام</p>
        <div className="text-xs text-blue-700 space-y-1">
          <p>1. افتح التليجرام وابحث عن <span className="font-mono bg-blue-100 px-1 rounded">@BotFather</span></p>
          <p>2. ابعت <span className="font-mono bg-blue-100 px-1 rounded">/newbot</span> واتبع التعليمات</p>
          <p>3. انسخ الـ Token وحطه هنا</p>
          <p>4. اضغط "تحقق من البوت" ثم "ضبط Webhook"</p>
        </div>
      </div>

      {/* Token Input */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Bot Token</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => { setToken(e.target.value); setStatus('idle'); }}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              dir="ltr"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={handleVerify}
            disabled={!token.trim() || status === 'loading'}
            className="px-4 py-2.5 bg-[#0E3B2E] text-white rounded-xl text-sm font-medium hover:bg-[#1F6B4E] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {status === 'loading' ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري...
              </span>
            ) : 'تحقق من البوت'}
          </button>
        </div>
      </div>

      {/* Status */}
      {status === 'success' && botInfo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">🤖</div>
            <div>
              <p className="text-sm font-bold text-emerald-800">{botInfo.name}</p>
              <p className="text-xs text-emerald-600 font-mono">@{botInfo.username}</p>
            </div>
            <span className="mr-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">✅ متصل</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          ❌ {errorMsg}
        </div>
      )}

      {/* Webhook */}
      {status === 'success' && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">ضبط Webhook</p>
            <p className="text-xs text-gray-500">الـ Webhook يربط البوت بالنظام عشان يستقبل رسايل أولياء الأمور</p>
          </div>
          <button
            onClick={handleSetWebhook}
            disabled={webhookStatus === 'loading'}
            className={`w-full py-2.5 text-sm font-medium rounded-xl transition-all ${
              webhookStatus === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E]'
            } disabled:opacity-50`}
          >
            {webhookStatus === 'loading' ? 'جاري الضبط...' :
             webhookStatus === 'success' ? '✅ تم ضبط Webhook' :
             webhookStatus === 'error' ? '❌ فشل الضبط — حاول تاني' :
             '⚙️ ضبط Webhook'}
          </button>
        </div>
      )}

      {/* كيف يشتغل */}
      {status === 'success' && webhookStatus === 'success' && (
        <div className="bg-[#0E3B2E]/5 border border-[#0E3B2E]/20 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold text-[#0E3B2E]">🎉 البوت جاهز!</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• روح على بروفايل أي طالب</p>
            <p>• اضغط "إرسال رابط تليجرام" وابعته لولي الأمر</p>
            <p>• ولي الأمر يضغط الرابط ويضغط Start</p>
            <p>• من دلوقتي هتيجيله الإشعارات على التليجرام ✅</p>
          </div>
        </div>
      )}
    </div>
  );
}

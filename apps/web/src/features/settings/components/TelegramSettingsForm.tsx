import { useState, useEffect } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { useConfirm } from '@/shared/components/Confirm';
import { TelegramBulkSend } from './TelegramBulkSend';
import { TelegramNotifySettingsCard } from './TelegramNotifySettingsCard';
import { TelegramTemplatesCard } from './TelegramTemplatesCard';
import { TelegramMessagesLog } from './TelegramMessagesLog';
import { TelegramInbox } from './TelegramInbox';
import { TelegramLinkStatus } from './TelegramLinkStatus';

type SubTab = 'connection' | 'settings' | 'templates' | 'bulk' | 'linkStatus' | 'messages' | 'inbox';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'connection', label: 'الاتصال' },
  { key: 'settings', label: 'الإعدادات' },
  { key: 'templates', label: 'القوالب' },
  { key: 'bulk', label: 'إرسال جماعي' },
  { key: 'linkStatus', label: 'حالة الربط' },
  { key: 'messages', label: 'سجل الرسائل' },
  { key: 'inbox', label: 'صندوق الوارد' },
];

export function TelegramSettingsForm() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username: string; name: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const confirm = useConfirm();

  // تبويبات داخلية زي صفحة الواتساب بالظبط (اتصال / إعدادات / قوالب / إرسال
  // جماعي / صندوق الوارد) — بدل ما كل حاجة تتحط تحت بعض في صفحة طويلة واحدة.
  const [subTab, setSubTab] = useState<SubTab>('connection');

  // عند فتح الصفحة، لو التوكن محفوظ بالفعل من زيارة سابقة، نجيب بيانات البوت
  // فورًا عشان قسم "الإرسال الجماعي" يظهر من غير ما نطلب من المستخدم يعيد
  // إدخال التوكن ويضغط "تحقق" تاني في كل مرة يفتح فيها الإعدادات.
  useEffect(() => {
    (async () => {
      try {
        const settingsRes = await apiClient.get('/telegram/settings');
        if (!settingsRes.data?.data?.hasToken) return;
        const infoRes = await apiClient.get('/telegram/bot-info');
        if (infoRes.data?.data) {
          setBotInfo(infoRes.data.data);
          setStatus('success');
        }
      } catch {
        // لو فشل الجلب التلقائي، الفورم بيفضل idle وينتظر إدخال يدوي — مفيش داعي لإظهار خطأ
      }
    })();
  }, []);

  // خطوة واحدة بس دلوقتي: حفظ التوكن + تحقق منه. الاستقبال بقى عن طريق Long
  // Polling من السيرفر نفسه (مش Webhook)، فما فيش أي "ضبط" إضافي محتاج المستخدم
  // يعمله — أول ما التوكن يتأكد إنه شغال، البوت بيبدأ يستقبل رسايل فورًا.
  const handleVerify = async () => {
    if (!token.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await apiClient.put('/telegram/settings', { token });
      const res = await apiClient.get('/telegram/bot-info');
      if (res.data.data) {
        setBotInfo(res.data.data);
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg('البوت مش شغال — تأكد من الـ Token');
      }
    } catch (err: any) {
      setStatus('error');
      const backendMsg = err?.response?.data?.error?.message ?? err?.response?.data?.message;
      setErrorMsg(backendMsg || 'فشل الاتصال — تأكد من الـ Token');
    }
  };

  // قطع الاتصال: بيوقف استقبال الرسايل فورًا ويمسح التوكن من السيرفر. ما بيمسحش
  // ربط الطلاب (telegram_links) — لو اتوصل بوت جديد بعدين، تاريخ الطلاب المربوطين
  // يفضل موجود.
  const handleDisconnect = async () => {
    if (!(await confirm('هل تريد قطع اتصال بوت التليجرام؟ لن تصل أي إشعارات على تليجرام حتى تربطه من جديد.'))) return;
    setDisconnecting(true);
    try {
      await apiClient.post('/telegram/disconnect');
      setBotInfo(null);
      setToken('');
      setStatus('idle');
      setErrorMsg('');
    } catch (err: any) {
      const backendMsg = err?.response?.data?.error?.message ?? err?.response?.data?.message;
      setErrorMsg(backendMsg || 'فشل قطع الاتصال');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div dir="rtl">
      {/* تبويبات — نفس شكل صفحة الواتساب بالظبط */}
      <div className="border-b border-gray-100 -mx-5 px-5 mb-5">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {SUB_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                subTab === t.key
                  ? 'border-[#0E3B2E] text-[#0E3B2E]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {subTab === 'connection' && (
          <>
            {/* شرح */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-blue-800">📱 إعداد بوت التليجرام</p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>1. افتح التليجرام وابحث عن <span className="font-mono bg-blue-100 px-1 rounded">@BotFather</span></p>
                <p>2. ابعت <span className="font-mono bg-blue-100 px-1 rounded">/newbot</span> واتبع التعليمات</p>
                <p>3. انسخ الـ Token وحطه هنا</p>
                <p>4. اضغط "تحقق من البوت" — هيشتغل فورًا</p>
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">🤖</div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800">{botInfo.name}</p>
                    <p className="text-xs text-emerald-600 font-mono">@{botInfo.username}</p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">✅ متصل</span>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="mr-auto text-xs text-red-600 hover:text-red-700 disabled:opacity-50 font-medium"
                  >
                    {disconnecting ? 'جاري القطع...' : 'قطع الاتصال'}
                  </button>
                </div>
                <div className="text-xs text-gray-600 space-y-1 border-t border-emerald-100 pt-3">
                  <p>• روح على بروفايل أي طالب</p>
                  <p>• اضغط "إرسال رابط تليجرام" وابعته لولي الأمر</p>
                  <p>• ولي الأمر يضغط الرابط ويضغط Start</p>
                  <p>• من دلوقتي هتيجيله الإشعارات على التليجرام ✅</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                ❌ {errorMsg}
              </div>
            )}
          </>
        )}

        {subTab === 'settings' && <TelegramNotifySettingsCard />}
        {subTab === 'templates' && <TelegramTemplatesCard />}
        {subTab === 'bulk' && <TelegramBulkSend />}
        {subTab === 'linkStatus' && <TelegramLinkStatus />}
        {subTab === 'messages' && <TelegramMessagesLog />}
        {subTab === 'inbox' && <TelegramInbox />}
      </div>
    </div>
  );
}

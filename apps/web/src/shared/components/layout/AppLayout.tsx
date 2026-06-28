import { ReactNode, useState } from 'react';
import { FloatingFab } from '../FloatingFab';
import { AttendancePanel } from '../AttendancePanel';
import { QRCodeSVG } from 'qrcode.react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: ReactNode;
}

// ===== رابط التطبيق ورابط تنزيل الشهادة =====
const getUrls = () => {
  const appUrl = import.meta.env.VITE_APP_URL || `https://${window.location.hostname}`;

  // استخرج الـ IP الحقيقي من VITE_APP_URL عشان يشتغل على الموبايل
  // لو استخدمنا window.location.hostname ممكن يرجع "localhost" اللي مش موجود على الموبايل
  let lanHost = window.location.hostname;
  try {
    lanHost = new URL(appUrl).hostname; // هيرجع 192.168.8.181 من https://192.168.8.181
  } catch { /* fallback */ }

  // الـ cert server شغال على port 8088 على نفس الـ IP
  const certUrl = `http://${lanHost}:8088/nabgha-ca.crt`;
  return { appUrl, certUrl };
};

// ===== أيقونة Smartphone =====
const PhoneIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" strokeWidth="3"/>
  </svg>
);

// ===== أيقونة Shield/Certificate =====
const ShieldIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

// ===== أيقونة Copy =====
const CopyIcon = ({ copied }: { copied: boolean }) => copied ? (
  <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
) : (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

export function AppLayout({ children }: AppLayoutProps) {
  const [showQr, setShowQr]     = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'cert'>('app');
  const [copied, setCopied]     = useState(false);
  const { appUrl, certUrl }     = getUrls();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className={`md:mr-64 min-h-screen transition-all duration-300 ${splitMode ? "md:ml-80" : ""}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0E3B2E] rounded-lg flex items-center justify-center">
              <span className="text-[#D4AB53] text-sm font-black">ن</span>
            </div>
            <h1 className="text-[#0E3B2E] font-bold text-lg">نبغة</h1>
          </div>

          {/* Split Mode Button */}
          <button
            onClick={() => setSplitMode(p => !p)}
            title="وضع الشاشة المنقسمة"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              splitMode ? 'bg-[#0E3B2E] text-white' : 'bg-[#0E3B2E]/10 text-[#0E3B2E] hover:bg-[#0E3B2E]/20'
            }`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
          </button>

          {/* QR Button */}
          <button
            onClick={() => { setShowQr(true); setActiveTab('app'); }}
            title="افتح على الموبايل"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0E3B2E]/10 text-[#0E3B2E] hover:bg-[#0E3B2E]/20 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="17" width="3" height="3" rx="0.5"/>
              <rect x="19" y="14" width="2" height="2" rx="0.5"/>
              <rect x="14" y="14" width="2" height="2" rx="0.5"/>
            </svg>
          </button>
        </div>

        {/* Page Content */}
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* ===== QR Modal ===== */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowQr(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#0E3B2E] px-6 pt-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">الوصول من الموبايل</h3>
                <button
                  onClick={() => setShowQr(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('app')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'app'
                      ? 'bg-white text-[#0E3B2E]'
                      : 'bg-white/15 text-white/80 hover:bg-white/25'
                  }`}
                >
                  <PhoneIcon />
                  التطبيق
                </button>
                <button
                  onClick={() => setActiveTab('cert')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'cert'
                      ? 'bg-white text-[#0E3B2E]'
                      : 'bg-white/15 text-white/80 hover:bg-white/25'
                  }`}
                >
                  <ShieldIcon />
                  الشهادة الأمنية
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'app' ? (
                /* ===== Tab 1: App URL ===== */
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-500">
                    سكان الـ QR بالموبايل للدخول مباشرة على التطبيق
                    <br/>
                    <span className="text-xs text-gray-400">الموبايل لازم يكون على نفس الـ WiFi</span>
                  </p>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-[#0E3B2E]/10">
                      <QRCodeSVG
                        value={appUrl}
                        size={200}
                        fgColor="#0E3B2E"
                        bgColor="#ffffff"
                        level="M"
                      />
                    </div>
                  </div>

                  {/* URL Display */}
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-left" dir="ltr">
                    <span className="flex-1 text-xs font-mono text-gray-700 truncate">{appUrl}</span>
                    <button
                      onClick={() => copyToClipboard(appUrl)}
                      className="shrink-0 text-gray-400 hover:text-[#0E3B2E] transition-colors p-1"
                      title="نسخ الرابط"
                    >
                      <CopyIcon copied={copied} />
                    </button>
                  </div>

                  <p className="text-xs text-[#0E3B2E] bg-[#0E3B2E]/5 rounded-xl px-3 py-2">
                    💡 لو ظهرت رسالة "Not Secure" — ثبّت الشهادة الأمنية أولاً من التبويب الجانبي
                  </p>
                </div>
              ) : (
                /* ===== Tab 2: Certificate ===== */
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-500">
                    حمّل الشهادة الأمنية على الموبايل
                    <br/>
                    <span className="text-xs text-gray-400">عشان يظهر القفل 🔒 في المتصفح بدل "Not Secure"</span>
                  </p>

                  {/* QR Code for Cert */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-amber-400/30">
                      <QRCodeSVG
                        value={certUrl}
                        size={200}
                        fgColor="#92400e"
                        bgColor="#ffffff"
                        level="M"
                      />
                    </div>
                  </div>

                  {/* Cert URL Display */}
                  <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5 text-left border border-amber-100" dir="ltr">
                    <span className="flex-1 text-xs font-mono text-amber-800 truncate">{certUrl}</span>
                    <button
                      onClick={() => copyToClipboard(certUrl)}
                      className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors p-1"
                      title="نسخ الرابط"
                    >
                      <CopyIcon copied={copied} />
                    </button>
                  </div>

                  {/* Steps */}
                  <div className="text-right space-y-2" dir="rtl">
                    <p className="text-xs font-semibold text-gray-700">خطوات التثبيت:</p>
                    <div className="space-y-1.5 text-xs text-gray-500">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-xs">١</span>
                        <span>سكان الـ QR أو افتح الرابط في متصفح الموبايل</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-xs">٢</span>
                        <span><b>Android:</b> الإعدادات ← الأمان ← بيانات الاعتماد ← تثبيت شهادة CA</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-xs">٣</span>
                        <span><b>iPhone:</b> الإعدادات ← عام ← VPN والأجهزة ← ثبّت الـ Profile ← فعّل الثقة</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-xs">٤</span>
                        <span>ارجع وافتح التطبيق من تبويب "التطبيق"</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <FloatingFab />

      {/* Attendance Panel — Fixed Side Panel */}
      {splitMode && (
        <div className="hidden md:fixed md:flex md:top-0 md:left-0 md:h-full md:z-30">
          <AttendancePanel onClose={() => setSplitMode(false)} />
        </div>
      )}
    </div>
  );
}

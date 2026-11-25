import { ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { FloatingFab } from '../FloatingFab';
import { AttendancePanel } from '../AttendancePanel';
import { QRCodeSVG } from 'qrcode.react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MobileNav } from './MobileNav';
import { useLayoutPreference } from '@/shared/hooks/useLayoutPreference';
import { usePwaInstall } from '@/shared/hooks/usePwaInstall';
import { DisplayModeControls } from './DisplayModeControls';
import { useLocation } from 'react-router-dom';
import { InstallBanner } from './InstallBanner';

interface AppLayoutProps {
  children: ReactNode;
}

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
  const [showQr, setShowQr]       = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'cert'>('app');
  const [copied, setCopied]       = useState(false);
  const { mode, toggle }          = useLayoutPreference();
  // صفحة المحادثات محتاجة الجزء اللي تحت للرد — الأزرار العايمة وبانر التثبيت كانوا بيغطّوا زرار الإرسال
  const isChatPage = useLocation().pathname.startsWith('/inbox');
  const pwa                       = usePwaInstall();

  // ===== رابط التطبيق ورابط الشهادة — يعتمد على IP الشبكة الحقيقي =====
  // لو التطبيق بيتفتح عبر "localhost" (وضع Desktop)، window.location.hostname
  // بيرجع "localhost" حرفياً وده مالوش معنى لجهاز موبايل تاني. في الحالة دي
  // نجيب الـ IP الحقيقي بتاع الشبكة من الباك إند (GET /health/network-info)
  // بدل ما نستخدم "localhost" في الـ QR.
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const { data: networkInfo } = useQuery({
    queryKey: ['network-info'],
    queryFn: async () => {
      const res = await apiClient.get('/health/network-info');
      return res.data as { lanIp: string };
    },
    enabled: isLocalHost && showQr,
    staleTime: Infinity,
  });

  const lanHost = isLocalHost ? (networkInfo?.lanIp ?? window.location.hostname) : window.location.hostname;
  const protocol = isLocalHost ? 'http' : 'https';
  const port = isLocalHost ? `:${window.location.port || '3001'}` : '';
  const appUrl = import.meta.env.VITE_APP_URL || `${protocol}://${lanHost}${port}`;
  const certUrl = `http://${lanHost}:8088/nabgha-ca.crt`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isNavbar  = mode === 'navbar';
  const isSidebar = mode === 'sidebar';

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">

      {/* ══ Navbar Mode (top horizontal) ══ */}
      {isNavbar && (
        <div className="hidden md:block">
          <Navbar
            onToggleLayout={toggle}
            currentMode={mode}
            splitMode={splitMode}
            onSplitMode={() => setSplitMode(p => !p)}
            onShowQr={() => { setShowQr(true); setActiveTab('app'); }}
          />
        </div>
      )}

      {/* ══ Sidebar Mode (vertical) ══ */}
      {isSidebar && (
        <div className="hidden md:block">
          <Sidebar onToggleLayout={toggle} currentMode={mode} />
        </div>
      )}

      {/* ══ Main Content ══ */}
      <main
        className={[
          'min-h-screen transition-all duration-300',
          isNavbar  ? 'md:pt-[72px]' : '',
          isSidebar ? 'md:mr-64'     : '',
          // بانل الحضور (Split Screen) ثابت على يسار الشاشة بعرض 320px في الوضعين
          // (Navbar و Sidebar) على حد سواء — فمساحة المحتوى لازم تتزاح بنفس القيمة
          // في الحالتين، مش بس في وضع Sidebar زي ما كان قبل كده (وده اللي كان بيبوظ
          // الشكل في وضع Navbar لما تفتح Split Screen: البانل كان بيتراكب فوق المحتوى).
          splitMode ? 'md:ml-80' : '',
        ].join(' ')}
      >
        {isSidebar && (
          <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 hidden md:flex items-center justify-end">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSplitMode(p => !p)}
                title="وضع الشاشة المنقسمة"
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                  splitMode ? 'bg-[#0E3B2E] text-white' : 'bg-[#0E3B2E]/10 text-[#0E3B2E] hover:bg-[#0E3B2E]/20'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="12" y1="3" x2="12" y2="21"/>
                </svg>
              </button>
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
          </div>
        )}

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
                    activeTab === 'app' ? 'bg-white text-[#0E3B2E]' : 'bg-white/15 text-white/80 hover:bg-white/25'
                  }`}
                >
                  <PhoneIcon />
                  التطبيق
                </button>
                <button
                  onClick={() => setActiveTab('cert')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'cert' ? 'bg-white text-[#0E3B2E]' : 'bg-white/15 text-white/80 hover:bg-white/25'
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
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-500">
                    سكان الـ QR بالموبايل للدخول مباشرة على التطبيق
                    <br/>
                    <span className="text-xs text-gray-400">الموبايل لازم يكون على نفس الـ WiFi</span>
                  </p>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-[#0E3B2E]/10">
                      <QRCodeSVG value={appUrl} size={200} fgColor="#0E3B2E" bgColor="#ffffff" level="M" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-left" dir="ltr">
                    <span className="flex-1 text-xs font-mono text-gray-700 truncate">{appUrl}</span>
                    <button onClick={() => copyToClipboard(appUrl)} className="shrink-0 text-gray-400 hover:text-[#0E3B2E] transition-colors p-1" title="نسخ الرابط">
                      <CopyIcon copied={copied} />
                    </button>
                  </div>
                  {/* ── تثبيت كتطبيق على الموبايل/التابلت (PWA) ── */}
                  <div className="text-right bg-[#0E3B2E]/5 rounded-xl px-3 py-3 space-y-2" dir="rtl">
                    <p className="text-xs font-bold text-[#0E3B2E]">تثبيت البرنامج كتطبيق</p>
                    {pwa.isInstalled ? (
                      <p className="text-xs text-green-700">✓ البرنامج مثبّت كتطبيق على هذا الجهاز</p>
                    ) : pwa.canPrompt ? (
                      <button type="button" onClick={() => pwa.install()}
                        className="w-full py-2 text-sm font-bold bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E]">
                        تثبيت التطبيق على هذا الجهاز
                      </button>
                    ) : (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {pwa.platform === 'ios'
                          ? 'على iPhone/iPad: افتح الرابط في Safari ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية".'
                          : 'على أندرويد: افتح الرابط في Chrome ← القائمة (⋮) ← "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'}
                      </p>
                    )}
                    {!pwa.isSecure && !pwa.isInstalled && (
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        ⚠️ الاتصال هنا عبر http بدون تشفير، فالمتصفح غالبًا هيعمل اختصار بس (بدون وضع التطبيق الكامل). للتثبيت الكامل لازم الرابط يكون https (ثبّت الشهادة من التبويب الجانبي).
                      </p>
                    )}
                  </div>
                  {!isLocalHost && (
                    <p className="text-xs text-[#0E3B2E] bg-[#0E3B2E]/5 rounded-xl px-3 py-2">
                      💡 لو ظهرت رسالة "Not Secure" — ثبّت الشهادة الأمنية أولاً من التبويب الجانبي
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-500">
                    حمّل الشهادة الأمنية على الموبايل
                    <br/>
                    <span className="text-xs text-gray-400">عشان يظهر القفل 🔒 في المتصفح بدل "Not Secure"</span>
                  </p>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-amber-400/30">
                      <QRCodeSVG value={certUrl} size={200} fgColor="#92400e" bgColor="#ffffff" level="M" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5 text-left border border-amber-100" dir="ltr">
                    <span className="flex-1 text-xs font-mono text-amber-800 truncate">{certUrl}</span>
                    <button onClick={() => copyToClipboard(certUrl)} className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors p-1" title="نسخ الرابط">
                      <CopyIcon copied={copied} />
                    </button>
                  </div>
                  <div className="text-right space-y-2" dir="rtl">
                    <p className="text-xs font-semibold text-gray-700">خطوات التثبيت:</p>
                    <div className="space-y-1.5 text-xs text-gray-500">
                      {[
                        'سكان الـ QR أو افتح الرابط في متصفح الموبايل',
                        'Android: الإعدادات ← الأمان ← بيانات الاعتماد ← تثبيت شهادة CA',
                        'iPhone: الإعدادات ← عام ← VPN والأجهزة ← ثبّت الـ Profile ← فعّل الثقة',
                        'ارجع وافتح التطبيق من تبويب "التطبيق"',
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-xs">
                            {['١','٢','٣','٤'][i]}
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: step.replace(/Android:|iPhone:/g, '<b>$&</b>') }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* بانل الحضور عرضه 320px على الشمال (md وأكبر) — الأزرار العايمة بتتزاح جنبه */}
      {!isChatPage && <DisplayModeControls leftOffset={splitMode ? 320 : 0} />}
      {!isChatPage && <InstallBanner />}
      {!isChatPage && <FloatingFab leftOffset={splitMode && window.innerWidth >= 768 ? 320 : 0} />}

      {/* Attendance Panel — Fixed Side Panel */}
      {splitMode && (
        // في وضع الناف بار البانل بيبدأ تحت الشريط العلوي (72px) — قبل كده كان بيبدأ من فوق
        // فراسه (العنوان وزرار القفل) كانت مستخبية ورا الناف بار
        <div className={`hidden md:fixed md:flex md:left-0 md:z-30 ${isNavbar ? 'md:top-[72px] md:h-[calc(100vh-72px)]' : 'md:top-0 md:h-full'}`}>
          <AttendancePanel onClose={() => setSplitMode(false)} />
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, User, Lock, Eye, EyeOff, ScanLine, MessageCircle, Wallet, WifiOff, ArrowLeft, Loader2 } from 'lucide-react';
import { useLogin } from '../hooks/useLogin';
import { BrandLogo, BRAND_MARK_SRC } from '@/shared/components/brand/BrandLogo';
import { CONTACT_WHATSAPP } from '@/features/landing/landing.config';

// بيحدد رسالة الخطأ المناسبة: لو السيرفر رد فعلاً برفض (بيانات غلط، أو تروتلينج)
// نعرض رسالة واضحة، ولو الطلب أصلاً معرفش يوصل للسيرفر (مشكلة شبكة/فايروول —
// بيحصل كتير لما حد بيدخل من الموبايل عبر QR وجهازه على نفس الشبكة بس السيرفر
// حاجب البورت) نعرض رسالة مختلفة تمامًا بدل ما نوهم المستخدم إن كلمة السر غلط.
function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // بنضيف كود وتفاصيل الخطأ التقنية (زي ERR_NETWORK أو ERR_CONNECTION_REFUSED)
      // في نص الرسالة نفسها عشان لو المشكلة حصلت من موبايل بعيد، يقدر المستخدم
      // ياخد screenshot ويبعته من غير ما يحتاج أدوات المطورين.
      const detail = [error.code, error.message].filter(Boolean).join(' — ');
      return `تعذر الاتصال بالسيرفر — تأكد إن الجهاز على نفس شبكة الواي فاي، وإن الجدار الناري (Firewall) مش حاجب البرنامج${detail ? `

(${detail})` : ''}`;
    }
    if (error.response.status === 429) {
      return 'محاولات دخول كتير في وقت قصير — استنى دقيقة وحاول تاني';
    }
    const serverMessage = (error.response.data as any)?.error?.message;
    if (serverMessage) return serverMessage;
  }
  return 'بيانات الدخول غير صحيحة';
}

// نسخة الديسكتوب/الشبكة الداخلية مالهاش صفحة هبوط ولا تواصل تسويقي
function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

const HIGHLIGHTS = [
  { icon: ScanLine, label: 'حضور بالباركود' },
  { icon: MessageCircle, label: 'رسائل لأولياء الأمور' },
  { icon: Wallet, label: 'حسابات دقيقة' },
  { icon: WifiOff, label: 'يشتغل من غير إنترنت' },
];

export default function LoginPage() {
  // تحقق من الـ setup في Desktop mode
  useEffect(() => {
    fetch('/api/v1/auth/setup/check')
      .then(r => r.json())
      .then(data => {
        if (data?.data?.needsSetup) {
          window.location.href = '/setup';
        }
      })
      .catch(() => {});
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [slug, setSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { mutate: login, isPending, error } = useLogin();

  const isPublic = !isPrivateHost(window.location.hostname);
  const waLink = isPublic && CONTACT_WHATSAPP
    ? `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('أهلاً، عايز أشترك في نبغة')}`
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!slug.trim()) errors.slug = 'اسم المركز مطلوب';
    if (!username.trim()) errors.username = 'اسم المستخدم مطلوب';
    if (!password.trim()) errors.password = 'كلمة المرور مطلوبة';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    // كيبورد الموبايل (خصوصًا مع اقتراحات الكلمات) بيضيف مسافة زيادة في الآخر
    // أحيانًا من غير ما المستخدم يحس — من غير trim() البيانات بتبقى مختلفة عن
    // المخزّن ويترفض الدخول بـ"بيانات غير صحيحة" حتى لو المستخدم كاتب صح.
    login({ slug: slug.trim().toLowerCase(), username: username.trim(), password: password.trim() });
  };

  const fieldWrap = (hasError: boolean) =>
    `group flex items-center gap-3 rounded-2xl border bg-white px-4 h-14 transition-all
     focus-within:border-[#1F6B4E] focus-within:ring-4 focus-within:ring-[#1F6B4E]/10
     ${hasError ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'}`;
  const iconCls = 'w-5 h-5 text-gray-400 group-focus-within:text-[#1F6B4E] transition-colors shrink-0';
  // autofill: كروم بيلوّن الخانة أزرق لما يملاها لوحده — نخليها بيضا زي باقي الخانة
  const inputCls = 'flex-1 min-w-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-300 focus:outline-none autofill:shadow-[inset_0_0_0_1000px_#fff] [-webkit-text-fill-color:#111827]';

  return (
    <div className="min-h-screen flex bg-[#F6F7F5] font-cairo" dir="rtl">
      {/* ═══ الفورم ═══ */}
      <main className="relative flex-1 flex flex-col">
        {/* هيدر الموبايل */}
        <div className="lg:hidden relative bg-[#0E3B2E] overflow-hidden pt-10 pb-16 px-6 text-center">
          <div className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D4AB53 1px, transparent 0)', backgroundSize: '18px 18px' }} />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#D4AB53]/15 blur-3xl" />
          <BrandLogo size="xl" layout="stack" tagline glow className="relative" />
          <svg className="absolute -bottom-px left-0 w-full h-10 text-[#F6F7F5]" viewBox="0 0 400 40" preserveAspectRatio="none">
            <path d="M0 40 C120 0 280 0 400 40 Z" fill="currentColor" />
            <path d="M0 40 C120 0 280 0 400 40" fill="none" stroke="#D4AB53" strokeWidth="1.5" opacity="0.7" />
          </svg>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 text-center lg:text-right">
              <h1 className="text-[28px] sm:text-3xl font-black text-[#0E3B2E]">أهلاً بيك في نبغة</h1>
              <p className="text-gray-500 mt-2">سجّل دخولك عشان تكمّل شغلك</p>
            </div>

            {error && (
              <div className="flex gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3 mb-6 text-sm whitespace-pre-wrap break-words">
                <span className="mt-0.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span>{getLoginErrorMessage(error)}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on" noValidate>
              <div>
                <label htmlFor="slug" className="block text-sm font-bold text-gray-700 mb-2">كود المركز</label>
                <div className={fieldWrap(!!formErrors.slug)}>
                  <Building2 className={iconCls} />
                  <input id="slug" type="text" name="slug" placeholder="my-center" dir="ltr"
                    value={slug} onChange={e => setSlug(e.target.value)}
                    autoComplete="organization" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    className={`${inputCls} text-right`} />
                </div>
                {formErrors.slug && <p className="text-red-500 text-xs mt-1.5 mr-1">{formErrors.slug}</p>}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم</label>
                <div className={fieldWrap(!!formErrors.username)}>
                  <User className={iconCls} />
                  <input id="username" type="text" name="username" placeholder="اسم المستخدم" dir="ltr"
                    value={username} onChange={e => setUsername(e.target.value)}
                    autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    className={`${inputCls} text-right`} />
                </div>
                {formErrors.username && <p className="text-red-500 text-xs mt-1.5 mr-1">{formErrors.username}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
                <div className={fieldWrap(!!formErrors.password)}>
                  <Lock className={iconCls} />
                  <input id="password" type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" dir="ltr"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`${inputCls} text-right`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="text-gray-400 hover:text-[#0E3B2E] transition-colors p-1 -m-1">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.password && <p className="text-red-500 text-xs mt-1.5 mr-1">{formErrors.password}</p>}
              </div>

              <button type="submit" disabled={isPending}
                className="relative w-full h-14 rounded-2xl bg-gradient-to-l from-[#0E3B2E] to-[#1F6B4E] text-white text-base font-bold shadow-lg shadow-[#0E3B2E]/20 hover:shadow-xl hover:shadow-[#0E3B2E]/25 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2">
                {isPending ? (<><Loader2 className="w-5 h-5 animate-spin" /> جاري الدخول…</>) : (<>تسجيل الدخول <ArrowLeft className="w-5 h-5" /></>)}
              </button>
            </form>

            {waLink && (
              <div className="mt-8 pt-6 border-t border-gray-200/80 text-center text-sm text-gray-500">
                لسه مش مشترك؟{' '}
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1F6B4E] hover:text-[#0E3B2E] underline-offset-4 hover:underline">
                  اطلب عرض تجريبي مجاني
                </a>
              </div>
            )}
          </div>
        </div>

        <footer className="pb-6 px-6 lg:pl-16 flex items-center justify-center lg:justify-between gap-4 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} نبغة</span>
          {isPublic && <a href="/" className="hidden lg:inline hover:text-[#0E3B2E]">الصفحة الرئيسية</a>}
        </footer>
      </main>

      {/* ═══ البراند (ديسكتوب) ═══ */}
      <aside className="hidden lg:flex relative w-[46%] max-w-[760px] overflow-hidden bg-[#0B3326] text-white">
        {/* خلفية: تدرّج + نقط + توهّج ذهبي */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#1F6B4E_0%,#0E3B2E_45%,#082519_100%)]" />
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D4AB53 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[#D4AB53]/10 blur-3xl" />
        <img src={BRAND_MARK_SRC} alt="" aria-hidden className="absolute -bottom-10 -left-10 h-[420px] w-auto opacity-[0.05] rotate-12 select-none pointer-events-none" />

        {/* الحافة المنحنية ناحية الفورم */}
        <svg className="absolute inset-y-0 -right-px h-full w-24 text-[#F6F7F5]" viewBox="0 0 100 1000" preserveAspectRatio="none">
          <path d="M100 0 L40 0 C95 220 -10 420 45 620 C80 760 20 880 55 1000 L100 1000 Z" fill="currentColor" />
          <path d="M40 0 C95 220 -10 420 45 620 C80 760 20 880 55 1000" fill="none" stroke="#D4AB53" strokeWidth="2.5" vectorEffect="non-scaling-stroke" opacity="0.85" />
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-14 pl-20 text-center">
          <BrandLogo size="2xl" layout="stack" tagline glow />

          <h2 className="mt-12 text-[34px] font-black leading-snug">
            حيث تنمو المعرفة
            <br />
            <span className="text-[#D4AB53]">وتثمر النجاحات</span>
          </h2>
          <p className="mt-4 text-white/65 max-w-sm leading-relaxed">
            منصة متكاملة لإدارة مجموعاتك وطلابك وحساباتك، وتواصل تلقائي مع أولياء الأمور.
          </p>

          <div className="mt-10 grid grid-cols-4 gap-3 w-full max-w-md">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl border border-[#D4AB53]/40 bg-white/[0.04] flex items-center justify-center text-[#D4AB53]">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-white/70 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* موجة ذهبية تحت */}
        <svg className="absolute bottom-0 inset-x-0 w-full h-28 opacity-60" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path d="M0 95 C150 40 300 120 600 55" fill="none" stroke="url(#gold)" strokeWidth="1.5" />
          <defs>
            <linearGradient id="gold" x1="0" x2="1">
              <stop offset="0" stopColor="#D4AB53" stopOpacity="0" />
              <stop offset="0.5" stopColor="#E9CF8E" />
              <stop offset="1" stopColor="#D4AB53" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </aside>
    </div>
  );
}

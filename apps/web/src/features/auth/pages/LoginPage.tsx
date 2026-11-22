import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLogin } from '../hooks/useLogin';

// بيحدد رسالة الخطأ المناسبة: لو السيرفر رد فعلاً برفض (بيانات غلط، أو تروتلينج)
// نعرض رسالة واضحة، ولو الطلب أصلاً معرفش يوصل للسيرفر (مشكلة شبكة/فايروول —
// بيحصل كتير لما حد بيدخل من الموبايل عبر QR وجهازه على نفس الشبكة بس السيرفر
// حاجب البورت) نعرض رسالة مختلفة تمامًا بدل ما نوهم المستخدم إن كلمة السر غلط.
function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // بنضيف كود وتفاصيل الخطأ التقنية (زي ERR_NETWORK أو ERR_CONNECTION_REFUSED)
      // في نص الرسالة نفسها عشان لو المشكلة حصلت من موبايل بعيد، يقدر المستخدم
      // ياخد screenshot ويبعته من غير ما يحتاج يوصل الجهاز بالكمبيوتر أو يفتح
      // أدوات المطورين (DevTools) عشان يشوف الخطأ الحقيقي.
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!slug.trim()) errors.slug = 'اسم المركز مطلوب';
    if (!username.trim()) errors.username = 'اسم المستخدم مطلوب';
    if (!password.trim()) errors.password = 'كلمة المرور مطلوبة';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    // كيبورد الموبايل (خصوصًا مع اقتراحات الكلمات) بيضيف مسافة زيادة في الآخر
    // أحيانًا من غير ما المستخدم يحس — لو بعتنا القيمة زي ما هي من غير trim()،
    // البيانات بتبقى مختلفة عن المخزّن فعليًا ويترفض تسجيل الدخول بـ"بيانات غير
    // صحيحة" حتى لو المستخدم كاتب البيانات صح بالظبط. كان بيحصل هنا بس على
    // الموبايل مش على الكمبيوتر، لأن كيبورد الكمبيوتر مبيضيفش المسافة دي.
    login({ slug: slug.trim(), username: username.trim(), password: password.trim() });
  };

  const inputClass = 'w-full border border-gray-200 rounded-xl pr-11 pl-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/30 focus:border-[#0E3B2E] focus:bg-white transition-all';

  const formContent = (
    <div className="w-full max-w-sm">
      <div className="lg:hidden text-center mb-8">
        <img src="/Logo.png" alt="نبغة" className="w-24 h-24 object-contain mx-auto" />
        <h1 className="text-3xl font-black text-[#0E3B2E] -mt-1">نبغة</h1>
      </div>
      <div className="mb-7 text-center lg:text-right">
        <h2 className="text-3xl font-bold text-[#0E3B2E]">مرحباً بك في نبغة</h2>
        <p className="text-gray-500 text-sm mt-2">أدخل بياناتك للوصول إلى لوحة التحكم</p>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-5 text-sm text-center whitespace-pre-wrap break-words">
          {getLoginErrorMessage(error)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
        {/* اسم المركز */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المركز</label>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <input
              type="text"
              name="slug"
              placeholder="test-center"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              autoComplete="organization"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>
          {formErrors.slug && <p className="text-red-500 text-xs mt-1">{formErrors.slug}</p>}
        </div>

        {/* اسم المستخدم */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المستخدم</label>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <input
              type="text"
              name="username"
              placeholder="admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>
          {formErrors.username && <p className="text-red-500 text-xs mt-1">{formErrors.username}</p>}
        </div>

        {/* كلمة المرور */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور</label>
          <div className="relative">
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword
                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
        </div>

        <button type="submit" disabled={isPending}
          className="w-full bg-[#0E3B2E] text-white rounded-xl py-3.5 text-sm font-bold hover:bg-[#1F6B4E] transition-colors disabled:opacity-60 mt-2">
          {isPending ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* يسار — فورم */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        {formContent}
      </div>
      {/* يمين — براندينج (desktop فقط) */}
      <div className="hidden lg:flex flex-1 bg-[#0E3B2E] items-center justify-center p-12 relative overflow-hidden">
        <div className="text-center text-white z-10">
          <img src="/Logo.png" alt="نبغة" className="w-32 h-32 object-contain mx-auto mb-6" />
          <h1 className="text-5xl font-black mb-3">نبغة</h1>
          <p className="text-white/70 text-lg">إدارة الدروس الخصوصية</p>
        </div>
      </div>
    </div>
  );
}

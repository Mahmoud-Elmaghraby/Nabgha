import { Link } from 'react-router-dom';
import { CONTACT_WHATSAPP, CONTACT_MESSAGE, CONTACT_EMAIL } from './landing.config';

const FEATURES = [
  { icon: '📋', title: 'حضور وغياب بالباركود', text: 'سجّل حضور الطلاب بمسح كارت الطالب (QR/باركود) أو باللمس، وتابع الغياب لحظة بلحظة.' },
  { icon: '💬', title: 'رسائل واتساب وتليجرام تلقائية', text: 'إشعار فوري لولي الأمر بالحضور والغياب والدرجات والمدفوعات، بقوالب تعدّلها بنفسك.' },
  { icon: '💰', title: 'مالية كاملة', text: 'مستحقات شهرية، مدفوعات، مصروفات، خزائن، وإيصالات تتطبع على الطابعة الحرارية.' },
  { icon: '📝', title: 'درجات وتقارير', text: 'سجّل درجات الحصص، وصدّر تقارير PDF وExcel، ولوحة شرف للمتفوقين.' },
  { icon: '👨‍👩‍👧', title: 'بوابة أولياء الأمور', text: 'ولي الأمر يدخل برمز يوصله على واتساب ويتابع حضور وأداء ومستحقات ابنه.' },
  { icon: '📱', title: 'على الكمبيوتر والموبايل والشاشة التفاعلية', text: 'نسخة ويندوز تشتغل حتى من غير إنترنت، وتطبيق للموبايل والتابلت، ووضع لمس للشاشات التفاعلية.' },
];

const STEPS = [
  { n: '١', title: 'تتواصل معانا', text: 'نعرّفك بالبرنامج ونحدد المناسب لمركزك.' },
  { n: '٢', title: 'نجهّز مركزك', text: 'بياناتك ومواد وصفوف مركزك وهويتك على الرسائل.' },
  { n: '٣', title: 'تبدأ الشغل', text: 'تسجّل الطلاب وتطبع الكروت وتبدأ حضور من أول حصة.' },
];

export default function LandingPage() {
  const waLink = CONTACT_WHATSAPP
    ? `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(CONTACT_MESSAGE)}`
    : null;

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-gray-800" dir="rtl">
      {/* ── Header ── */}
      <header className="bg-[#0E3B2E] sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/Logo-icon-192.png" alt="نبغة" className="w-10 h-10 object-contain" />
            <span className="text-white font-black text-xl">نبغة</span>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#features" className="hidden sm:inline text-white/80 hover:text-white text-sm px-3 py-2">المميزات</a>
            <a href="#how" className="hidden sm:inline text-white/80 hover:text-white text-sm px-3 py-2">إزاي نبدأ</a>
            <Link to="/auth/login" className="bg-[#D4AB53] text-[#0E3B2E] font-bold text-sm px-4 py-2 rounded-lg hover:brightness-95">
              تسجيل الدخول
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-[#0E3B2E] to-[#1F6B4E] text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
          <img src="/Logo-icon-512.png" alt="" className="w-24 h-24 mx-auto mb-6 object-contain drop-shadow-lg" />
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-4">
            إدارة مركزك التعليمي <span className="text-[#D4AB53]">في مكان واحد</span>
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            نبغة نظام متكامل للمراكز والمدرسين الخصوصيين: طلاب، حضور، درجات، مالية، ورسائل تلقائية لأولياء الأمور — بالعربي وبسهولة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="bg-[#D4AB53] text-[#0E3B2E] font-bold px-7 py-3 rounded-xl text-base hover:brightness-95">
                اطلب عرض تجريبي
              </a>
            )}
            <Link to="/auth/login" className="bg-white/10 border border-white/30 text-white font-bold px-7 py-3 rounded-xl text-base hover:bg-white/20">
              دخول للنظام
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-2">كل اللي مركزك محتاجه</h2>
        <p className="text-gray-500 text-center mb-10">من أول تسجيل الطالب لحد تقرير آخر الشهر</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-[#0E3B2E] mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How ── */}
      <section id="how" className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-10">إزاي نبدأ؟</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map(s => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0E3B2E] text-[#D4AB53] font-black text-xl flex items-center justify-center">{s.n}</div>
                <h3 className="font-bold text-[#0E3B2E] mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] mb-3">جاهز تنظّم مركزك؟</h2>
        <p className="text-gray-500 mb-6">كلمنا وهنوريك البرنامج على بيانات مركزك.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="bg-[#0E3B2E] text-white font-bold px-7 py-3 rounded-xl hover:bg-[#1F6B4E]">
              تواصل عبر واتساب
            </a>
          )}
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="border border-[#0E3B2E] text-[#0E3B2E] font-bold px-7 py-3 rounded-xl hover:bg-[#0E3B2E]/5">
              {CONTACT_EMAIL}
            </a>
          )}
          <Link to="/auth/login" className="text-[#0E3B2E] font-bold px-4 py-3 underline">عندي حساب بالفعل</Link>
        </div>
      </section>

      <footer className="bg-[#0E3B2E] text-white/60 text-center text-xs py-6">
        © {new Date().getFullYear()} نبغة — نظام إدارة المراكز التعليمية
      </footer>
    </div>
  );
}

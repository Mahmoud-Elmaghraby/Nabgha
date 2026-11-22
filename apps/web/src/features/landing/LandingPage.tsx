import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, MessageCircle, Wallet, ClipboardCheck, FileSpreadsheet, Users,
  MonitorSmartphone, Repeat, ShieldCheck, ChevronDown, CheckCircle2, XCircle,
  Sparkles, Clock, Send, BookOpenCheck,
} from 'lucide-react';
import { CONTACT_WHATSAPP, CONTACT_MESSAGE, CONTACT_EMAIL } from './landing.config';

// ─── المحتوى ───────────────────────────────────────────────
// كل النصوص هنا — أي تعديل في الكلام بيبقى في المكان ده بس.

const PAINS = [
  'كشكول الغياب بيضيع، والحساب آخر الشهر بياخد يوم كامل',
  'ولي الأمر بيتصل يسأل: ابني حضر؟ دفع؟ جاب كام في الامتحان؟',
  'طالب حضر مع مجموعة تانية — مش عارف تحسبه ولا لأ',
  'فلوس الشهر متلخبطة بين الكاش وفودافون كاش ومين دفع نص الشهر',
];

const GAINS = [
  'الحضور بيتسجل بمسح كارت الطالب في ثانية، والغياب بيتحسب لوحده',
  'ولي الأمر بتوصله رسالة واتساب تلقائي: حضر، غاب، درجته، دفع',
  'الحضور في مجموعة تانية بيتحسب تعويض تلقائي في نفس الأسبوع',
  'كل جنيه متسجل بإيصال، وكل خزنة عارف رصيدها بالظبط',
];

const FEATURES = [
  { icon: QrCode, title: 'حضور بالباركود', text: 'كارت لكل طالب بكود QR. امسح بالموبايل أو الكاميرا أو قارئ الباركود، أو سجّل باللمس.' },
  { icon: MessageCircle, title: 'رسائل لأولياء الأمور', text: 'واتساب وتليجرام تلقائي: حضور، غياب، تأخير، 3 غيابات متتالية، درجات، تأكيد دفع، وتذكير بالمستحقات.' },
  { icon: Repeat, title: 'تعويض الغياب', text: 'الطالب حضر مع مجموعة تانية في نفس الأسبوع؟ غيابه بيتحسب معذور تلقائي، وولي الأمر بيعرف.' },
  { icon: BookOpenCheck, title: 'امتحانات ودرجات', text: 'بنك أسئلة خاص بيك، امتحانات بالدرجات، وإرسال النتيجة لولي الأمر بضغطة.' },
  { icon: Wallet, title: 'حسابات وتحصيل', text: 'مستحقات شهرية بتتولد لوحدها، خصومات، دفع جزئي، إيصالات للطابعة الحرارية، خزن ومصروفات.' },
  { icon: FileSpreadsheet, title: 'تقارير PDF وExcel', text: 'كشف حضور، كشف درجات، المتأخرين في الدفع، تقرير شهري لكل طالب — جاهزة للطباعة.' },
  { icon: Users, title: 'بوابة ولي الأمر', text: 'ولي الأمر يدخل برمز يوصله على واتساب، ويتابع حضور ودرجات ومستحقات ابنه بنفسه.' },
  { icon: MonitorSmartphone, title: 'كمبيوتر وموبايل', text: 'نسخة ويندوز بتشتغل من غير إنترنت، ونسخة أونلاين من أي مكان، ووضع لمس للشاشات.' },
];

const AUDIENCE = [
  {
    title: 'للمدرس المستقل',
    points: ['كل مجموعاتك وطلابك في مكان واحد', 'رسائلك بتطلع باسمك أنت', 'تتابع من الموبايل وانت في السنتر أو البيت'],
  },
  {
    title: 'للسنتر التعليمي',
    points: ['أكتر من مدرس ومادة وصف', 'صلاحيات لكل موظف (سكرتارية، محاسب، مدرس)', 'خزن ومصروفات وتقارير للإدارة'],
  },
];

const STEPS = [
  { title: 'كلّمنا على واتساب', text: 'قولنا عندك كام مجموعة وطالب، ونحدد مع بعض اللي يناسبك.' },
  { title: 'جرّب على نسخة تجريبية', text: 'هتدخل على مركز تجريبي مليان بيانات وتشوف كل حاجة بنفسك.' },
  { title: 'نجهّزلك مركزك', text: 'موادك وصفوفك ومجموعاتك وهويتك على الرسائل — وتبدأ من أول حصة.' },
];

const FAQ = [
  { q: 'لازم يكون عندي إنترنت؟', a: 'لأ. نسخة الويندوز بتشتغل على جهازك من غير إنترنت. الإنترنت محتاجه بس عشان رسائل الواتساب، ولو اتقطع الرسايل بتستنى وتتبعت بعدين.' },
  { q: 'الرسائل بتطلع من رقم مين؟', a: 'من رقم الواتساب بتاعك أنت (أو رقم السنتر)، وباسمك. وفيه حماية بتنظّم سرعة الإرسال عشان الرقم مايتحظرش.' },
  { q: 'أقدر أشتغل من الموبايل؟', a: 'أيوه. تقدر تسجّل الحضور وتمسح الكروت وتتابع من الموبايل أو التابلت على نفس الشبكة أو أونلاين.' },
  { q: 'بياناتي في أمان؟', a: 'كل مركز ليه قاعدة بيانات منفصلة، وفيه نسخ احتياطي تلقائي يومي، وصلاحيات لكل مستخدم على قد شغله.' },
  { q: 'السعر كام؟', a: 'على حسب عدد الطلاب والمدرسين — كلّمنا على واتساب وهنقولك على طول.' },
];

// ─── صور توضيحية للبرنامج (مرسومة بالكود، بيانات وهمية) ──────────

function AttendanceMock() {
  const rows = [
    { name: 'يوسف محمد عبدالله', code: 'STU-00012', status: 'حاضر', cls: 'bg-emerald-100 text-emerald-700' },
    { name: 'مريم أحمد السيد', code: 'STU-00027', status: 'حاضر', cls: 'bg-emerald-100 text-emerald-700' },
    { name: 'عمر طارق النجار', code: 'STU-00031', status: 'متأخر', cls: 'bg-amber-100 text-amber-700' },
    { name: 'سلمى هشام فرج', code: 'STU-00044', status: 'معذور', cls: 'bg-purple-100 text-purple-700' },
    { name: 'زياد وائل منصور', code: 'STU-00052', status: 'غايب', cls: 'bg-red-100 text-red-600' },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden text-right">
      <div className="bg-[#0E3B2E] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">الدرس 7 — ثالث ثانوي</p>
          <p className="text-[11px] text-white/60">السبت 4:00 م</p>
        </div>
        <span className="text-[11px] bg-[#D4AB53] text-[#0E3B2E] font-bold px-2 py-1 rounded-lg">جارية</span>
      </div>
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
        <QrCode className="w-4 h-4 text-[#1F6B4E]" />
        <div className="flex-1 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">امسح كارت الطالب…</div>
      </div>
      <div className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold">✅ يوسف محمد — اتسجل حضوره</div>
      <div className="p-3 space-y-2">
        {rows.map((r) => (
          <div key={r.code} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E3B2E]/10 text-[#0E3B2E] text-xs font-bold flex items-center justify-center">{r.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{r.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">{r.code}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.cls}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatsAppMock() {
  const msgs = [
    { text: 'أ/ أحمد سامي: الطالب يوسف محمد حضر حصة الرياضيات النهارده الساعة 4:00 ✅', time: '4:02 م' },
    { text: 'أ/ أحمد سامي: درجة يوسف في امتحان الدروس 4-6: 18 من 20 👏', time: '7:15 م' },
    { text: 'أ/ أحمد سامي: تم استلام 450 جنيه اشتراك شهر نوفمبر. شكرًا لحضرتك 🌹', time: '7:40 م' },
  ];
  return (
    <div className="bg-[#E9DFD5] rounded-[2rem] shadow-2xl ring-8 ring-[#1b1b1b] overflow-hidden w-full max-w-[290px] mx-auto">
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">أ</div>
        <div>
          <p className="text-sm font-bold">أ/ أحمد سامي</p>
          <p className="text-[10px] text-white/70">متصل</p>
        </div>
      </div>
      <div className="p-3 space-y-2 min-h-[260px]">
        {msgs.map((m) => (
          <div key={m.time} className="bg-white rounded-xl rounded-tr-sm px-3 py-2 shadow-sm max-w-[92%]">
            <p className="text-[12px] text-gray-800 leading-relaxed">{m.text}</p>
            <p className="text-[9px] text-gray-400 text-left mt-1">{m.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceMock() {
  const stats = [
    { label: 'المحصّل الشهر ده', value: '24,350', cls: 'text-emerald-700' },
    { label: 'المتبقي', value: '6,100', cls: 'text-red-600' },
    { label: 'المصروفات', value: '5,550', cls: 'text-gray-700' },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-4 text-right">
      <p className="text-sm font-bold text-[#0E3B2E] mb-3">المالية — نوفمبر</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-2.5">
            <p className="text-[10px] text-gray-400">{s.label}</p>
            <p className={`text-base font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[
          { name: 'مريم أحمد', month: 'نوفمبر', amount: '450', st: 'مدفوع', cls: 'bg-emerald-100 text-emerald-700' },
          { name: 'عمر طارق', month: 'نوفمبر', amount: '225 / 450', st: 'جزئي', cls: 'bg-amber-100 text-amber-700' },
          { name: 'زياد وائل', month: 'أكتوبر', amount: '350', st: 'متأخر', cls: 'bg-red-100 text-red-600' },
        ].map((r) => (
          <div key={r.name} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-gray-800">{r.name}</p>
              <p className="text-[10px] text-gray-400">{r.month} — {r.amount} ج</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.cls}`}>{r.st}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── الصفحة ────────────────────────────────────────────────

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const waLink = CONTACT_WHATSAPP
    ? `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(CONTACT_MESSAGE)}`
    : null;

  const PrimaryCta = ({ className = '' }: { className?: string }) =>
    waLink ? (
      <a href={waLink} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 bg-[#D4AB53] text-[#0E3B2E] font-black px-7 py-3.5 rounded-xl text-base shadow-lg shadow-black/10 hover:brightness-95 transition ${className}`}>
        <MessageCircle className="w-5 h-5" />
        اطلب عرض تجريبي مجاني
      </a>
    ) : null;

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-gray-800 font-cairo" dir="rtl">
      {/* ── Header ── */}
      <header className="bg-[#0E3B2E]/95 backdrop-blur sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <img src="/Logo-icon-192.png" alt="نبغة" className="w-10 h-10 object-contain" />
            <span className="text-white font-black text-xl">نبغة</span>
          </a>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden md:inline text-white/80 hover:text-white text-sm px-3 py-2">المميزات</a>
            <a href="#how" className="hidden md:inline text-white/80 hover:text-white text-sm px-3 py-2">إزاي نبدأ</a>
            <a href="#faq" className="hidden md:inline text-white/80 hover:text-white text-sm px-3 py-2">أسئلة</a>
            <Link to="/auth/login" className="text-white/90 hover:text-white text-sm font-bold px-3 py-2">دخول</Link>
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="bg-[#D4AB53] text-[#0E3B2E] font-bold text-sm px-4 py-2 rounded-lg hover:brightness-95">
                كلّمنا
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-b from-[#0E3B2E] via-[#124a39] to-[#1F6B4E] text-white">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 sm:pt-20 sm:pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-right">
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-[#E9CF8E] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              نظام إدارة للمدرسين والسناتر — بالعربي
            </span>
            <h1 className="text-3xl sm:text-5xl font-black leading-[1.35] mb-5">
              طلابك ومجموعاتك وحساباتك
              <br />
              <span className="text-[#D4AB53]">من غير كشكول ولا وجع دماغ</span>
            </h1>
            <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              نبغة بيسجّل الحضور بالباركود، ويبعت لولي الأمر على واتساب لوحده، ويحسب المستحقات والتحصيل،
              ويطلعلك تقارير جاهزة — عشان تركّز في الشرح بس.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <PrimaryCta />
              <a href="#features" className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/15">
                شوف المميزات
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mt-7 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4FBF9F]" /> بيشتغل من غير إنترنت</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4FBF9F]" /> رسائل باسمك</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4FBF9F]" /> عرض تجريبي مجاني</span>
            </div>
          </div>

          <div className="relative max-w-md mx-auto w-full">
            <AttendanceMock />
            <div className="hidden sm:block absolute -bottom-10 -left-10 w-56 rotate-[-4deg]">
              <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-3 text-right">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center"><Send className="w-3 h-3 text-white" /></div>
                  <p className="text-[11px] font-bold text-gray-800">اتبعت لولي الأمر</p>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">يوسف محمد حضر حصة الرياضيات الساعة 4:00 ✅</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── قبل / بعد ── */}
      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-3">لو ده يومك… نبغة معمول عشانك</h2>
        <p className="text-gray-500 text-center mb-10">الفرق بين إدارة المجموعات بالورقة وإدارتها بنظام</p>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-red-100 p-6">
            <p className="font-black text-red-600 mb-4">من غير نبغة</p>
            <ul className="space-y-3">
              {PAINS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />{p}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0E3B2E] rounded-2xl p-6 text-white">
            <p className="font-black text-[#D4AB53] mb-4">مع نبغة</p>
            <ul className="space-y-3">
              {GAINS.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-sm text-white/85 leading-relaxed">
                  <CheckCircle2 className="w-5 h-5 text-[#4FBF9F] shrink-0 mt-0.5" />{g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── المميزات ── */}
      <section id="features" className="bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-3">كل اللي محتاجه في برنامج واحد</h2>
          <p className="text-gray-500 text-center mb-12">من أول تسجيل الطالب لحد تقرير آخر الشهر</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-2xl border border-gray-100 bg-[#FAFAF8] p-5 hover:border-[#1F6B4E]/30 hover:shadow-md transition">
                <div className="w-11 h-11 rounded-xl bg-[#0E3B2E] text-[#D4AB53] flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[#0E3B2E] mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── عرض تفصيلي ── */}
      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-24 space-y-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-bold text-[#1F6B4E] bg-[#1F6B4E]/10 px-3 py-1 rounded-full">أولياء الأمور</span>
            <h3 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] mt-4 mb-4">ولي الأمر يعرف كل حاجة… من غير ما يتصل</h3>
            <p className="text-gray-600 leading-relaxed mb-5">
              أول ما الطالب يتسجل حضوره، ولي أمره بتوصله رسالة. غاب؟ رسالة. غاب 3 مرات ورا بعض؟ تنبيه خاص.
              درجة الامتحان وتأكيد الدفع وتذكير المستحقات — كله بيتبعت لوحده من رقمك وباسمك.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> قوالب رسائل تعدّلها زي ما تحب</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> حماية من حظر رقم الواتساب</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> تليجرام كمان، ويقدر ولي الأمر يرد عليك</li>
            </ul>
          </div>
          <WhatsAppMock />
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="lg:order-2">
            <span className="text-xs font-bold text-[#1F6B4E] bg-[#1F6B4E]/10 px-3 py-1 rounded-full">الحسابات</span>
            <h3 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] mt-4 mb-4">تعرف مين دفع ومين لأ… في ثانية</h3>
            <p className="text-gray-600 leading-relaxed mb-5">
              مستحقات الشهر بتتولد لوحدها لكل طالب بالخصم بتاعه. بتحصّل كاش أو فودافون كاش أو إنستاباي،
              وتطبع إيصال على الطابعة الحرارية، والبرنامج بيفكّر المتأخرين بنفسه.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> دفع جزئي ودفع مقدّم</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> أكتر من خزنة وتحويل بينهم</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#1F6B4E]" /> وضع خصوصية يخفي المبالغ قدام الطلاب</li>
            </ul>
          </div>
          <div className="lg:order-1 max-w-md mx-auto w-full"><FinanceMock /></div>
        </div>
      </section>

      {/* ── لمين ── */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-10">مناسب ليك لو…</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="rounded-2xl border border-gray-100 bg-[#FAFAF8] p-6">
                <p className="text-lg font-black text-[#0E3B2E] mb-4">{a.title}</p>
                <ul className="space-y-2.5">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-[#4FBF9F] shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── إزاي نبدأ ── */}
      <section id="how" className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-12">تبدأ إزاي؟</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.title} className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#0E3B2E] text-[#D4AB53] font-black text-2xl flex items-center justify-center shadow-lg">
                {(i + 1).toLocaleString('ar-EG')}
              </div>
              <h3 className="font-bold text-[#0E3B2E] mb-1.5">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10"><PrimaryCta /></div>
      </section>

      {/* ── أسئلة ── */}
      <section id="faq" className="bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0E3B2E] text-center mb-10">أسئلة بتتسأل كتير</h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="rounded-xl border border-gray-100 bg-[#FAFAF8] overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right">
                  <span className="font-bold text-[#0E3B2E]">{f.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
        <div className="rounded-3xl bg-gradient-to-l from-[#0E3B2E] to-[#1F6B4E] text-white px-6 py-12 sm:px-12 text-center relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-[#D4AB53]/10" />
          <div className="absolute -bottom-20 -right-10 w-64 h-64 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-center gap-4 mb-5 text-[#E9CF8E]">
              <ClipboardCheck className="w-6 h-6" /><Clock className="w-6 h-6" /><ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-black mb-3">جرّب نبغة على مركز تجريبي كامل</h2>
            <p className="text-white/75 mb-8 max-w-xl mx-auto">ابعتلنا رسالة، وهنديك دخول على نسخة فيها مجموعات وطلاب وحضور وحسابات — وتحكم بنفسك.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryCta />
              {CONTACT_EMAIL && (
                <a href={`mailto:${CONTACT_EMAIL}`} className="border border-white/30 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/10">{CONTACT_EMAIL}</a>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#0E3B2E] text-white/60 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/Logo-icon-192.png" alt="" className="w-8 h-8 object-contain" />
            <span className="text-white font-bold">نبغة</span>
            <span>— نظام إدارة المدرسين والمراكز التعليمية</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth/login" className="hover:text-white">دخول المشتركين</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* زرار واتساب ثابت */}
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="تواصل على واتساب"
          className="fixed bottom-5 left-5 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl hover:scale-105 transition">
          <MessageCircle className="w-7 h-7" />
        </a>
      )}
    </div>
  );
}

// ===== إعدادات صفحة الهبوط (Landing Page) — عدّل القيم هنا بس =====

// رقم واتساب التواصل/الطلب بالصيغة الدولية من غير + أو مسافات (مثال مصر: 201001234567).
// لو فاضي، زرار "اطلب عرض" بيختفي ويفضل زرار الدخول بس.
export const CONTACT_WHATSAPP = '201016052951';

// رسالة جاهزة بتتفتح مع الواتساب
export const CONTACT_MESSAGE = 'أهلاً، عايز أجرّب برنامج نبغة وأشوف عرض على بيانات زي بتاعتي';

export const CONTACT_EMAIL = '';

// ─────────────────────────────────────────────────────────────
// مدرسين بيشتغلوا بنبغة — قسم "آراء المدرسين"
// ─────────────────────────────────────────────────────────────
// ⚠️ ماتضيفش أي مدرس غير بموافقته على ظهور اسمه وصورته وصوته.
// لو القايمة فاضية القسم كله بيختفي من الصفحة.
//
// الملفات بتتحط في: apps/web/public/testimonials/
//   صورة: مربعة، 400×400 تقريباً، jpg أو webp  →  photo: '/testimonials/ahmed.jpg'
//   تسجيل: mp3 أو m4a (فويس الواتساب .opus لازم يتحوّل الأول عشان يشتغل على الآيفون)
//          →  audio: '/testimonials/ahmed.mp3'
//
// مثال:
// {
//   name: 'أ/ أحمد سامي',
//   subject: 'رياضيات',
//   stage: 'ثانوي',
//   area: 'المنصورة',
//   photo: '/testimonials/ahmed.jpg',
//   audio: '/testimonials/ahmed.mp3',
//   quote: 'الحضور بقى بالباركود في دقيقة، وأولياء الأمور بيوصلهم الغياب لوحدهم.',
//   since: '2025',
// },
export interface Testimonial {
  name:     string;
  subject:  string;
  stage?:   string;
  area?:    string;
  photo?:   string;
  audio?:   string;
  /** جملة قصيرة من كلام المدرس نفسه (من التسجيل أو رسالته) — من غير تأليف */
  quote?:   string;
  /** بيستخدم نبغة من سنة كام (اختياري) */
  since?:   string;
}

export const TESTIMONIALS: Testimonial[] = [];

// أرقام بتظهر فوق آراء المدرسين — سيبها فاضية لو مش متأكد منها.
// مثال: { value: '+40', label: 'مدرس ومركز' }
export const STATS: Array<{ value: string; label: string }> = [];

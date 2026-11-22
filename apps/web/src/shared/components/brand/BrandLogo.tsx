// شعار نبغة الموحّد — أي مكان في البرنامج بيعرض اللوجو يستخدم الكومبوننت ده،
// عشان المقاس والشكل يبقوا ثابتين. الصورة مقصوصة على حدود الشعار بالظبط
// (من غير مساحة فاضية حواليه زي ملفات الأيقونات القديمة، اللي كانت بتخليه يبان صغير جدًا).

export const BRAND_MARK_SRC = '/brand/nabgha-mark.webp';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// ارتفاع الشعار نفسه — العرض بيتظبط لوحده بنسبة الصورة
const MARK_HEIGHT: Record<Size, string> = {
  xs: 'h-7',
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-28',
  '2xl': 'h-40',
};

const NAME_SIZE: Record<Size, string> = {
  xs: 'text-base',
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
  '2xl': 'text-6xl',
};

interface BrandMarkProps {
  size?: Size;
  className?: string;
  glow?: boolean;
}

export function BrandMark({ size = 'md', className = '', glow = false }: BrandMarkProps) {
  return (
    <img
      src={BRAND_MARK_SRC}
      alt="نبغة"
      draggable={false}
      className={`${MARK_HEIGHT[size]} w-auto object-contain select-none ${glow ? 'drop-shadow-[0_0_24px_rgba(212,171,83,0.35)]' : ''} ${className}`}
    />
  );
}

interface BrandLogoProps {
  size?: Size;
  /** light = نص أبيض (على خلفية غامقة)، dark = نص أخضر (على خلفية فاتحة) */
  tone?: 'light' | 'dark';
  /** أفقي (الشعار جنب الاسم) أو رأسي (الشعار فوق الاسم) */
  layout?: 'row' | 'stack';
  tagline?: boolean;
  glow?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'md', tone = 'light', layout = 'row', tagline = false, glow = false, className = '',
}: BrandLogoProps) {
  const nameColor = tone === 'light' ? 'text-white' : 'text-[#0E3B2E]';
  const tagColor = tone === 'light' ? 'text-[#D4AB53]' : 'text-[#1F6B4E]';
  const stacked = layout === 'stack';

  return (
    <div className={`flex ${stacked ? 'flex-col items-center text-center gap-3' : 'items-center gap-2.5'} ${className}`}>
      <BrandMark size={size} glow={glow} />
      <div className={stacked ? '' : 'leading-none'}>
        <p className={`${NAME_SIZE[size]} font-black ${nameColor} leading-none`}>نبغة</p>
        {tagline && (
          <p className={`${tagColor} font-semibold mt-1.5 ${stacked ? 'text-sm tracking-wide flex items-center gap-2 justify-center' : 'text-[11px]'}`}>
            {stacked && <span className="h-px w-6 bg-current opacity-60" />}
            إدارة الدروس الخصوصية
            {stacked && <span className="h-px w-6 bg-current opacity-60" />}
          </p>
        )}
      </div>
    </div>
  );
}

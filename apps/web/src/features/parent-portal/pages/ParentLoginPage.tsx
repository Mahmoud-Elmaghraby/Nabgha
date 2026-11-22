import { BrandLogo } from '@/shared/components/brand/BrandLogo';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRequestOtp, useVerifyOtp } from '../hooks/useParentAuth';

function getErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return anyErr?.response?.data?.error?.message ?? fallback;
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/30 focus:border-[#0E3B2E] focus:bg-white transition-all';

export default function ParentLoginPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const requestOtp = useRequestOtp(slug);
  const verifyOtp = useVerifyOtp(slug);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    requestOtp.mutate(phone.trim(), {
      onSuccess: () => setStep('code'),
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    verifyOtp.mutate({ phone: phone.trim(), code: code.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F7F7]" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo size="xl" tone="dark" layout="stack" />
          <p className="text-gray-500 text-sm mt-1">بوابة أولياء الأمور</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 'phone' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#0E3B2E] mb-1">تسجيل الدخول</h2>
                <p className="text-gray-500 text-xs mb-4">
                  هنبعتلك كود تحقق على رقم واتساب المسجل لدينا
                </p>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  رقم هاتف ولي الأمر
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass.replace('text-center tracking-widest', 'text-right')}
                  autoFocus
                />
              </div>
              {requestOtp.isError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-xs text-center">
                  {getErrorMessage(requestOtp.error, 'تعذر إرسال الكود، حاول مرة أخرى')}
                </div>
              )}
              <button
                type="submit"
                disabled={requestOtp.isPending}
                className="w-full bg-[#0E3B2E] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1F6B4E] transition-colors disabled:opacity-60"
              >
                {requestOtp.isPending ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#0E3B2E] mb-1">أدخل كود التحقق</h2>
                <p className="text-gray-500 text-xs mb-4">
                  تم إرسال كود مكوّن من 6 أرقام على واتساب رقم {phone}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="- - - - - -"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} text-lg`}
                  autoFocus
                />
              </div>
              {verifyOtp.isError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-xs text-center">
                  {getErrorMessage(verifyOtp.error, 'الكود غير صحيح')}
                </div>
              )}
              <button
                type="submit"
                disabled={verifyOtp.isPending}
                className="w-full bg-[#0E3B2E] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1F6B4E] transition-colors disabled:opacity-60"
              >
                {verifyOtp.isPending ? 'جاري التحقق...' : 'تأكيد الدخول'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                }}
                className="w-full text-gray-500 text-xs py-1 hover:text-gray-700"
              >
                تغيير رقم الهاتف
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

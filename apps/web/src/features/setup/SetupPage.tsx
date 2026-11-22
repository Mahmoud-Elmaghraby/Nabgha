import { BrandLogo } from '@/shared/components/brand/BrandLogo';
import { useState } from 'react';
import { apiClient } from '@/shared/lib/api/client';

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    centerName: '',
    slug: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'centerName') {
      setForm(prev => ({
        ...prev,
        centerName: value,
        slug: value.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .substring(0, 30) || 'my-center',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.centerName || !form.username || !form.password) {
      setError('جميع الحقول مطلوبة');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('كلمة المرور غير متطابقة');
      return;
    }
    if (form.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/setup/init', {
        centerName: form.centerName,
        slug: form.slug || 'my-center',
        username: form.username,
        password: form.password,
      });
      // بعد الـ setup → روح للـ login
      window.location.href = '/auth/login';
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E3B2E] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0E3B2E] px-8 py-8 text-center">
          <BrandLogo size="xl" layout="stack" tagline glow />
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold text-gray-900">مرحباً بك! 👋</h2>
            <p className="text-sm text-gray-500 mt-1">أدخل بيانات مركزك لبدء الاستخدام</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm text-center">
              {error}
            </div>
          )}

          {/* اسم المركز */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              اسم المركز *
            </label>
            <input
              value={form.centerName}
              onChange={e => update('centerName', e.target.value)}
              placeholder="مثال: مركز أحمد للدروس"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
          </div>

          {/* اسم المستخدم */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              اسم المستخدم *
            </label>
            <input
              value={form.username}
              onChange={e => update('username', e.target.value)}
              placeholder="admin"
              dir="ltr"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
          </div>

          {/* كلمة المرور */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              كلمة المرور *
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
          </div>

          {/* تأكيد كلمة المرور */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              تأكيد كلمة المرور *
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => update('confirmPassword', e.target.value)}
              placeholder="••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#0E3B2E] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#1F6B4E] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'جاري الإعداد...' : '🚀 إبدأ الاستخدام'}
          </button>
        </div>
      </div>
    </div>
  );
}

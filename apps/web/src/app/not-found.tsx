import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <img src="/Logo.png" alt="نبغة" className="w-24 h-24 object-contain mx-auto mb-6 opacity-50" />
        <h1 className="text-6xl font-black text-[#0E3B2E] mb-2">404</h1>
        <p className="text-gray-500 text-lg mb-6">الصفحة التي تبحث عنها غير موجودة</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-[#0E3B2E] hover:bg-[#1F6B4E] text-white font-medium px-6 py-3 rounded-xl text-sm transition-all"
        >
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}

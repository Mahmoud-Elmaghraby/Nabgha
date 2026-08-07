import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useParentAuthStore } from '../stores/parent-auth.store';
import { useParentMe } from '../hooks/useParentAuth';

export default function ParentDashboardPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const students = useParentAuthStore((s) => s.students);
  useParentMe(slug); // يحدّث قائمة الطلاب في الخلفية (ويتأكد إن التوكن لسه شغال)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0E3B2E]">أبنائي</h1>
        <p className="text-gray-500 text-sm mt-0.5">اختر ابنك لمتابعة حصصه وحضوره ودرجاته ومستحقاته</p>
      </div>

      {students.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
          لا يوجد طلاب مرتبطين برقم هاتفك حاليًا
        </div>
      )}

      <div className="space-y-3">
        {students.map((student) => (
          <button
            key={student.id}
            onClick={() => navigate(`/parent/${slug}/students/${student.id}`)}
            className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-[#0E3B2E]/30 hover:shadow-md transition-all text-right"
          >
            <div className="w-10 h-10 rounded-full bg-[#0E3B2E] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {student.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-tight">{student.fullName}</p>
              {student.grade && <p className="text-xs text-gray-400 leading-tight mt-0.5">{student.grade}</p>}
            </div>
            <ChevronLeft size={18} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

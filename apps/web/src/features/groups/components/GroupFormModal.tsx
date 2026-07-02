import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGroupMutations } from '../hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useTeachers } from '@/features/teachers/hooks/useTeachers';
import type { GroupDto, ScheduleItem, DayOfWeek } from '../types/group.types';
import { DAY_LABELS, DAY_ORDER } from '../types/group.types';

interface Props {
  open: boolean;
  onClose: () => void;
  group?: GroupDto | null;
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E] focus:bg-white transition-all';

export function GroupFormModal({ open, onClose, group }: Props) {
  const isEdit = !!group;
  const { createGroup, updateGroup } = useGroupMutations();
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();

  const [name, setName] = useState('');
  const [subjectGradeId, setSubjectGradeId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [maxStudents, setMaxStudents] = useState(30);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setSubjectGradeId(group.subjectGradeId || '');
      setTeacherId(group.teacherId || '');
      setMaxStudents(group.maxStudents);
      setSchedule(group.schedule || []);
    } else {
      setName(''); setSubjectGradeId(''); setTeacherId('');
      setMaxStudents(30); setSchedule([]);
    }
    setErrors({});
  }, [open, group]);

  const toggleDay = (day: DayOfWeek) => {
    const exists = schedule.find(s => s.day === day);
    if (exists) {
      setSchedule(prev => prev.filter(s => s.day !== day));
    } else {
      setSchedule(prev => [...prev, { day, startTime: '16:00', endTime: '18:00' }]);
    }
  };

  const updateTime = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => prev.map(s => s.day === day ? { ...s, [field]: value } : s));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length < 2) e.name = 'اسم المجموعة يجب أن يكون حرفين على الأقل';
    if (!subjectGradeId) e.subjectGradeId = 'يجب اختيار المادة والصف';
    if (!teacherId) e.teacherId = 'يجب اختيار المدرس';
    if (maxStudents < 1) e.maxStudents = 'الحد الأقصى يجب أن يكون 1 على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      name,
      subjectGradeId,
      teacherId,
      maxStudents,
      schedule,
    };
    if (isEdit && group) {
      await updateGroup.mutateAsync({ id: group.id, data: payload });
    } else {
      await createGroup.mutateAsync(payload);
    }
    onClose();
  };

  const isPending = createGroup.isPending || updateGroup.isPending;

  // flatten grades for select
  const gradeOptions = subjects.flatMap(item =>
    item.grades.map(g => ({
      value: g.id,
      label: `${item.subject.name} — ${g.grade} (${g.fee} ج.م)`,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border-0 p-6" dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEdit ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المجموعة *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="مجموعة الرياضيات أ" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">المادة والصف *</label>
              <select value={subjectGradeId} onChange={e => setSubjectGradeId(e.target.value)} className={inputClass}>
                <option value="">اختر المادة والصف</option>
                {gradeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.subjectGradeId && <p className="text-red-500 text-xs mt-1">{errors.subjectGradeId}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">المدرس *</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={inputClass}>
                <option value="">اختر مدرساً</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {errors.teacherId && <p className="text-red-500 text-xs mt-1">{errors.teacherId}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الحد الأقصى للطلاب *</label>
            <input type="number" min={1} max={200} value={maxStudents} onChange={e => setMaxStudents(Number(e.target.value))} className={inputClass} />
            {errors.maxStudents && <p className="text-red-500 text-xs mt-1">{errors.maxStudents}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الجدول الأسبوعي</label>
            <div className="space-y-2">
              {DAY_ORDER.map(day => {
                const selected = schedule.find(s => s.day === day);
                return (
                  <div key={day} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors w-24 shrink-0 ${
                        selected ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                    {selected && (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={selected.startTime}
                          onChange={e => updateTime(day, 'startTime', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
                        <span className="text-gray-400 text-xs">إلى</span>
                        <input type="time" value={selected.endTime}
                          onChange={e => updateTime(day, 'endTime', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
            <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 text-sm font-semibold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50 transition-colors">
              {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المجموعة'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

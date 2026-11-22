import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormSheet } from '@/shared/components/FormSheet';
import { useExamMutations } from '../hooks/useExams';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { ExamDto, CreateExamPayload } from '../types/exam.types';

const FormSchema = z.object({
  title:             z.string().min(2, 'عنوان الامتحان مطلوب'),
  subjectId:         z.string().optional().or(z.literal('')),
  grade:             z.string().optional().or(z.literal('')),
  examDate:          z.string().optional().or(z.literal('')),
  durationMins:      z.coerce.number().positive().optional().or(z.literal(0)),
  instructions:      z.string().optional().or(z.literal('')),
  isTemplate:        z.boolean().default(false),
  header_color:      z.string().default('#0E3B2E'),
  font_family:       z.string().default('Cairo'),
  show_student_name: z.boolean().default(true),
  show_date:         z.boolean().default(true),
  show_degree:       z.boolean().default(true),
  custom_header_text: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  open:     boolean;
  onClose:  () => void;
  exam?:    ExamDto | null;
}

export function ExamFormModal({ open, onClose, exam }: Props) {
  const isEdit = !!exam;
  const { createExam, updateExam } = useExamMutations();
  const isPending = createExam.isPending || updateExam.isPending;
  const { data: subjects = [] } = useSubjects();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: '',
      subjectId: '',
      grade: '',
      examDate: '',
      durationMins: 60,
      instructions: '',
      isTemplate: false,
      header_color: '#0E3B2E',
      font_family: 'Cairo',
      show_student_name: true,
      show_date: true,
      show_degree: true,
      custom_header_text: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (exam) {
      const cfg = exam.designConfig || {};
      reset({
        title:              exam.title,
        subjectId:          exam.subjectId ?? '',
        grade:              exam.grade ?? '',
        examDate:           exam.examDate ? exam.examDate.split('T')[0] : '',
        durationMins:       exam.durationMins ?? 60,
        instructions:       exam.instructions ?? '',
        isTemplate:         exam.isTemplate,
        header_color:       cfg.header_color ?? '#0E3B2E',
        font_family:        cfg.font_family ?? 'Cairo',
        show_student_name:  cfg.show_student_name ?? true,
        show_date:          cfg.show_date ?? true,
        show_degree:        cfg.show_degree ?? true,
        custom_header_text: cfg.custom_header_text ?? '',
      });
    } else {
      reset({
        title: '',
        subjectId: '',
        grade: '',
        examDate: '',
        durationMins: 60,
        instructions: '',
        isTemplate: false,
        header_color: '#0E3B2E',
        font_family: 'Cairo',
        show_student_name: true,
        show_date: true,
        show_degree: true,
        custom_header_text: '',
      });
    }
  }, [open, exam, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload: CreateExamPayload = {
      title:        values.title,
      subjectId:    values.subjectId || null,
      grade:        values.grade || null,
      examDate:     values.examDate || null,
      durationMins: values.durationMins ? Number(values.durationMins) : null,
      instructions: values.instructions || null,
      isTemplate:   values.isTemplate,
      designConfig: {
        header_color:       values.header_color,
        font_family:        values.font_family,
        show_student_name:  values.show_student_name,
        show_date:          values.show_date,
        show_degree:        values.show_degree,
        custom_header_text: values.custom_header_text || undefined,
      },
    };

    if (isEdit) {
      await updateExam.mutateAsync({ id: exam!.id, data: payload });
    } else {
      await createExam.mutateAsync(payload);
    }
    onClose();
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
  const errCls   = 'text-red-500 text-xs mt-1';

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'تعديل بيانات الامتحان' : 'إنشاء امتحان جديد'}
      subtitle="إعدادات ورقة الامتحان والتصميم"
      size="lg"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            إلغاء
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isPending}
            className="px-5 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 disabled:opacity-50 transition-colors font-medium"
          >
            {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء الامتحان'}
          </button>
        </div>
      }
    >
      <form className="space-y-4" dir="rtl">
        <div>
          <label className={labelCls}>عنوان الامتحان *</label>
          <input
            {...register('title')}
            className={inputCls}
            placeholder="مثال: امتحان نصف العام - جبر وهندسة"
          />
          {errors.title && <p className={errCls}>{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>المادة</label>
            <select {...register('subjectId')} className={inputCls}>
              <option value="">كل المواد / غير محدد</option>
              {subjects.map(s => (
                <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>المرحلة الدراسية</label>
            <select {...register('grade')} className={inputCls}>
              <option value="">كل المراحل</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>تاريخ الامتحان</label>
            <input type="date" {...register('examDate')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>المدة الزمنية (بالدقائق)</label>
            <input type="number" min="5" step="5" {...register('durationMins')} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>نص ترويسة مخصص (يظهر أعلى الورقة)</label>
          <input
            {...register('custom_header_text')}
            className={inputCls}
            placeholder="مثال: مدرسة ... / سنتر ..."
          />
        </div>

        <div>
          <label className={labelCls}>تعليمات الامتحان</label>
          <textarea
            {...register('instructions')}
            rows={2}
            className={inputCls}
            placeholder="مثال: الإجابة في نفس الورقة، ممنوع استخدام الآلة الحاسبة..."
          />
        </div>

        {/* إعدادات المظهر والطباعة */}
        <div className="border-t border-gray-100 pt-3">
          <h4 className="text-xs font-bold text-gray-700 mb-2">إعدادات التصميم والطباعة (PDF)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>لون الترويسة</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register('header_color')}
                  className="w-10 h-8 rounded border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  {...register('header_color')}
                  className={inputCls}
                  placeholder="#0E3B2E"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>نوع الخط</label>
              <select {...register('font_family')} className={inputCls}>
                <option value="Cairo">Cairo (الافتراضي)</option>
                <option value="Tajawal">Tajawal</option>
                <option value="Almarai">Almarai</option>
                <option value="Amiri">Amiri (نسخي كلاسيكي)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('show_student_name')} className="rounded border-gray-300 text-[#0E3B2E]" />
              خانة اسم الطالب ورقم الجلوس
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('show_date')} className="rounded border-gray-300 text-[#0E3B2E]" />
              عرض التاريخ والمدة
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('show_degree')} className="rounded border-gray-300 text-[#0E3B2E]" />
              عرض الدرجات لكل سؤال
            </label>
          </div>
        </div>
      </form>
    </FormSheet>
  );
}

import { useEffect, useRef, useState } from 'react';
import { examsApi } from '../api/exams.api';
import { getFullMediaUrl } from '@/shared/lib/getFullMediaUrl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormSheet } from '@/shared/components/FormSheet';
import { useQuestionMutations } from '../hooks/useExams';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { QuestionDto, QuestionType, Difficulty } from '../types/exam.types';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '../types/exam.types';

const FormSchema = z.object({
  type:          z.enum(['mcq', 'true_false', 'fill', 'essay']),
  questionText:  z.string().min(3, 'نص السؤال مطلوب'),
  subjectId:     z.string().optional().or(z.literal('')),
  grade:         z.string().optional().or(z.literal('')),
  difficulty:    z.enum(['easy', 'medium', 'hard']),
  defaultDegree: z.coerce.number().positive(),
  tags:          z.string(),
  correctAnswer: z.string().optional().or(z.literal('')),
  modelAnswer:   z.string().optional().or(z.literal('')),
  option0:       z.string().optional().or(z.literal('')),
  option1:       z.string().optional().or(z.literal('')),
  option2:       z.string().optional().or(z.literal('')),
  option3:       z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  open:     boolean;
  onClose:  () => void;
  question?: QuestionDto | null;
}

export function QuestionFormModal({ open, onClose, question }: Props) {
  const isEdit = !!question;
  const { createQuestion, updateQuestion } = useQuestionMutations();
  const isPending = createQuestion.isPending || updateQuestion.isPending;
  const { data: subjects = [] } = useSubjects();

  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadErr(null);
    if (file.size > 5 * 1024 * 1024) { setUploadErr('حجم الصورة أكبر من 5 ميجا'); return; }
    setUploading(true);
    try {
      setImageUrl(await examsApi.uploadQuestionImage(file));
    } catch {
      setUploadErr('تعذّر رفع الصورة — جرّب صورة JPG أو PNG');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { type: 'mcq', difficulty: 'medium', defaultDegree: 1, tags: '' },
  });

  const watchedType = watch('type');
  const watchedOptions = [watch('option0'), watch('option1'), watch('option2'), watch('option3')];


  useEffect(() => {
    if (!open) return;
    if (question) {
      reset({
        type:          question.type,
        questionText:  question.questionText,
        subjectId:     question.subjectId  ?? '',
        grade:         question.grade      ?? '',
        difficulty:    question.difficulty,
        defaultDegree: question.defaultDegree,
        tags:          question.tags.join(', '),
        correctAnswer: question.correctAnswer ?? '',
        modelAnswer:   question.modelAnswer   ?? '',
        option0:       question.options?.[0] ?? '',
        option1:       question.options?.[1] ?? '',
        option2:       question.options?.[2] ?? '',
        option3:       question.options?.[3] ?? '',
      });
      setImageUrl(question.imageUrl ?? null);
    } else {
      reset({ type: 'mcq', difficulty: 'medium', defaultDegree: 1, tags: '',
              questionText: '', subjectId: '', grade: '', correctAnswer: '', modelAnswer: '',
              option0: '', option1: '', option2: '', option3: '' });
      setImageUrl(null);
    }
    setUploadErr(null);
  }, [open, question, reset]);

  const onSubmit = async (values: FormValues) => {
    const options = values.type === 'mcq'
      ? [values.option0, values.option1, values.option2, values.option3].filter(Boolean) as string[]
      : null;

    const payload = {
      type:          values.type as QuestionType,
      questionText:  values.questionText,
      subjectId:     values.subjectId  || null,
      grade:         values.grade      || null,
      difficulty:    values.difficulty as Difficulty,
      defaultDegree: values.defaultDegree,
      tags:          values.tags.split(',').map(t => t.trim()).filter(Boolean),
      correctAnswer: values.correctAnswer || null,
      modelAnswer:   values.modelAnswer   || null,
      imageUrl,
      options,
    };

    if (isEdit) {
      await updateQuestion.mutateAsync({ id: question!.id, data: payload });
    } else {
      await createQuestion.mutateAsync(payload);
    }
    onClose();
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
  const errCls   = 'text-red-500 text-xs mt-1';

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
      subtitle="بنك الأسئلة"
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
            {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة السؤال'}
          </button>
        </div>
      }
    >
      <form className="space-y-4" dir="rtl">
        {/* نوع السؤال */}
        <div>
          <label className={labelCls}>نوع السؤال *</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['mcq', 'true_false', 'fill', 'essay'] as QuestionType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  watchedType === t
                    ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0E3B2E]/40'
                }`}
              >
                {QUESTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* نص السؤال */}
        <div>
          <label className={labelCls}>نص السؤال *</label>
          <textarea
            {...register('questionText')}
            rows={3}
            className={inputCls}
            placeholder="اكتب نص السؤال هنا..."
          />
          {errors.questionText && <p className={errCls}>{errors.questionText.message}</p>}
        </div>

        {/* خيارات MCQ */}
        {watchedType === 'mcq' && (
          <div>
            <label className={labelCls}>الخيارات (أ ب ج د) *</label>
            <div className="space-y-2">
              {['أ', 'ب', 'ج', 'د'].map((letter, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] text-xs font-bold flex-shrink-0">{letter}</span>
                  <input
                    {...register(`option${i}` as any)}
                    className={inputCls}
                    placeholder={`الخيار ${letter}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الإجابة الصحيحة — الاختياري بيتختار من الخيارات نفسها عشان نموذج الإجابة يطلع مظبوط */}
        {watchedType === 'mcq' && (
          <div>
            <label className={labelCls}>الإجابة الصحيحة *</label>
            <select {...register('correctAnswer')} className={inputCls}>
              <option value="">— اختر الخيار الصحيح —</option>
              {watchedOptions.map((opt, i) => (opt && opt.trim()) ? (
                <option key={i} value={opt}>{['أ', 'ب', 'ج', 'د'][i]}) {opt}</option>
              ) : null)}
            </select>
          </div>
        )}
        {watchedType === 'fill' && (
          <div>
            <label className={labelCls}>الإجابة الصحيحة</label>
            <input {...register('correctAnswer')} className={inputCls} placeholder="الكلمة/العبارة المطلوبة" />
          </div>
        )}

        {/* صح/خطأ */}
        {watchedType === 'true_false' && (
          <div>
            <label className={labelCls}>الإجابة الصحيحة</label>
            <select {...register('correctAnswer')} className={inputCls}>
              <option value="">— اختر —</option>
              <option value="صح">صح ✓</option>
              <option value="خطأ">خطأ ✗</option>
            </select>
          </div>
        )}

        {/* نموذج الإجابة / شرح — بيظهر في PDF نموذج الإجابة بس */}
        <div>
          <label className={labelCls}>
            {watchedType === 'essay' ? 'الإجابة النموذجية' : 'شرح أو توضيح للإجابة (اختياري)'}
          </label>
          <textarea
            {...register('modelAnswer')}
            rows={watchedType === 'essay' ? 3 : 2}
            className={inputCls}
            placeholder={watchedType === 'essay' ? 'الإجابة النموذجية...' : 'يظهر في نموذج الإجابة فقط'}
          />
        </div>

        {/* صورة السؤال */}
        <div>
          <label className={labelCls}>صورة للسؤال (اختياري)</label>
          {imageUrl ? (
            <div className="flex items-start gap-3">
              <img src={getFullMediaUrl(imageUrl)} alt="" className="max-h-32 rounded-lg border border-gray-200" />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  تغيير
                </button>
                <button type="button" onClick={() => setImageUrl(null)} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                  إزالة
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg py-3 text-xs text-gray-500 hover:border-[#0E3B2E]/40 hover:text-[#0E3B2E] disabled:opacity-50"
            >
              {uploading ? 'جاري رفع الصورة...' : '＋ إضافة صورة (رسم، شكل، جدول...)'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(ev) => handlePickImage(ev.target.files?.[0])}
          />
          {uploadErr && <p className={errCls}>{uploadErr}</p>}
        </div>

        {/* الصف والمادة والصعوبة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>المادة</label>
            <select {...register('subjectId')} className={inputCls}>
              <option value="">كل المواد</option>
              {subjects.map(s => (
                <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>المرحلة</label>
            <select {...register('grade')} className={inputCls}>
              <option value="">كل المراحل</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>المستوى</label>
            <select {...register('difficulty')} className={inputCls}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* الدرجة والتاجات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>الدرجة الافتراضية *</label>
            <input type="number" step="0.5" min="0.5" {...register('defaultDegree')} className={inputCls} />
            {errors.defaultDegree && <p className={errCls}>{errors.defaultDegree.message}</p>}
          </div>
          <div>
            <label className={labelCls}>التاجات (مفصولة بفاصلة)</label>
            <input {...register('tags')} className={inputCls} placeholder="مثال: الوحدة 1، الفصل 2" />
          </div>
        </div>
      </form>
    </FormSheet>
  );
}

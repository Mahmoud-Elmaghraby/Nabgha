import { ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { StudentEntity } from '../domain/entities/student.entity';

export const STUDENT_EXPORT_COLUMNS: ExportColumn<StudentEntity>[] = [
  { key: 'studentCode', header: 'الكود', width: 15 },
  { key: 'fullName', header: 'اسم الطالب', width: 25 },
  { key: 'grade', header: 'الصف', width: 15, format: (v) => v ?? '-' },
  { key: 'parentPhone', header: 'هاتف ولي الأمر', width: 18 },
  { key: 'studentPhone', header: 'هاتف الطالب', width: 18, format: (v) => v ?? '-' },
  { key: 'school', header: 'المدرسة', width: 20, format: (v) => v ?? '-' },
  { key: 'dateOfBirth', header: 'تاريخ الميلاد', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'address', header: 'العنوان', width: 25, format: (v) => v ?? '-' },
  { key: 'parentOccupation', header: 'وظيفة ولي الأمر', width: 20, format: (v) => v ?? '-' },
  { key: 'notes', header: 'ملاحظات', width: 30, format: (v) => v ?? '-' },
  { key: 'isActive', header: 'الحالة', width: 12, format: (v) => (v ? 'نشط' : 'غير نشط') },
  { key: 'groupNames', header: 'المجموعات', width: 25, format: (v) => v || '-' },
];

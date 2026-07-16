-- Migration 008: توحيد صيغة students.grade مع subject_grades.grade
-- GRADE_OPTIONS اتغيرت قديمًا من الصيغة المختصرة ("ثالث إعدادي") للصيغة
-- الطويلة ("الصف الثالث الإعدادي")، وفضل بعض الطلاب القدام بالصيغة القديمة
-- فبقوا مش بيطابقوا subject_grades.grade في فلتر "إضافة طالب لمجموعة"
-- Added: July 2026

UPDATE students SET grade = 'الصف الثالث الإعدادي' WHERE grade = 'ثالث إعدادي';
UPDATE students SET grade = 'الصف الثاني الثانوي' WHERE grade = 'ثاني ثانوي';

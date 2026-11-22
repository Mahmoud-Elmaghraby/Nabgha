import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// فتح الـ PDF في تاب جديد — المستخدم يقدر يشوفه ويطبعه بإعدادات الورق الصحيحة
// ملاحظة: مش بنعمل print() تلقائي عشان المتصفح بيتجاهل مقاس صفحة الـ PDF
// ويستخدم A4 افتراضي — وده بيخلي الليبلات تطلع صغيرة
function printPDF(doc: jsPDF, fallbackName: string): void {
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  const opened = window.open(blobUrl);
  if (!opened) {
    // لو المتصفح منع الـ popup، ننزّل الملف كبديل
    doc.save(fallbackName);
  }
}

export interface StudentQRData {
  id: string;
  studentCode: string;
  fullName: string;
  grade?: string;
}

export interface LabelOptions {
  cols?: number;
  rows?: number;
  showName?: boolean;
  showCode?: boolean;
  showGrade?: boolean;
  centerName?: string;
  labelWidthMm?: number;
  labelHeightMm?: number;
}

export interface CardOptions {
  backgroundImage: string;
  qr: { x: number; y: number; size: number };
  name: { x: number; y: number; fontSize: number };
  code: { x: number; y: number; fontSize: number };
  cardWidth: number;
  cardHeight: number;
  centerName?: string;
}

const DEFAULT_LABEL_WIDTH_MM = 38;
const DEFAULT_LABEL_HEIGHT_MM = 25;
const LABEL_DPI = 300;

// توليد QR كـ base64 — الباركود يحمل كود الطالب الظاهري بس (مش أي معرف داخلي للنظام)
// ملاحظة: الكود بيتخزن كنص عادي (مثلاً STU-00003) بدون JSON عشان السكانر يشتغل
// صح بغض النظر عن لغة الكيبورد — الحروف الخاصة زي { } " : بتتأثر بتغيير اللغة
async function generateQR(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    width: 600,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// رسم ليبل واحد على canvas بمقاس حقيقي بالمليمتر (افتراضياً 38×25مم)
// التوزيع: QR كبير في المنتصف (أعلى)، الاسم تحته، الكود تحت الاسم
async function drawLabelCanvas(
  student: StudentQRData,
  labelWidthMm: number,
  labelHeightMm: number,
  options: LabelOptions
): Promise<string> {
  const { showName = true, showCode = true, showGrade = false } = options;
  const pxPerMm = LABEL_DPI / 25.4;
  const widthPx = Math.round(labelWidthMm * pxPerMm);
  const heightPx = Math.round(labelHeightMm * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  // خلفية بيضاء
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // حساب المساحة المتاحة للنصوص تحت الـ QR
  const padding = heightPx * 0.03; // هامش خارجي بسيط
  const textLineHeight = heightPx * 0.12;
  let textLines = 0;
  if (showName) textLines++;
  if (showCode && student.studentCode) textLines++;
  if (showGrade && student.grade) textLines++;
  const textBlockHeight = textLines > 0 ? (textLines * textLineHeight + padding) : 0;

  // QR — مربع كبير، متمركز أفقياً، بيشغل أكبر مساحة ممكنة
  const availableHeightForQR = heightPx - textBlockHeight - padding * 2;
  const qrSize = Math.min(availableHeightForQR, widthPx * 0.85);
  const qrX = (widthPx - qrSize) / 2;
  const qrY = padding;

  const qrImg = new Image();
  const qrData = await generateQR(student.studentCode);
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.src = qrData;
  });
  // رسم الـ QR بدقة عالية مع image-rendering crisp
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;

  // النصوص تحت الـ QR
  let textY = qrY + qrSize + textLineHeight * 0.85;

  // الاسم — بخط عريض، مع اقتطاع تلقائي لو أطول من عرض الليبلة
  if (showName) {
    const fontSize = Math.round(heightPx * 0.115);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';

    let name = student.fullName;
    const maxWidth = widthPx * 0.92;
    while (ctx.measureText(name).width > maxWidth && name.length > 3) {
      name = name.slice(0, -1);
    }
    if (name !== student.fullName) name = name.trimEnd() + '…';

    ctx.fillText(name, widthPx / 2, textY);
    textY += textLineHeight;
  }

  // الكود
  if (showCode && student.studentCode) {
    const codeFontSize = Math.round(heightPx * 0.10);
    ctx.font = `bold ${codeFontSize}px monospace`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.fillText(student.studentCode, widthPx / 2, textY);
    textY += textLineHeight;
  }

  // المرحلة (اختياري)
  if (showGrade && student.grade) {
    ctx.font = `${Math.round(heightPx * 0.08)}px Arial`;
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(student.grade, widthPx / 2, textY);
  }

  return canvas.toDataURL('image/png');
}

// ─── Label Generator (A4 PDF — شبكة للطباعة على ورق عادي وتقطيعه) ─────
export async function generateLabelsPDF(
  students: StudentQRData[],
  options: LabelOptions = {}
): Promise<void> {
  const { cols = 3, rows = 4 } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const marginX = 8;
  const marginY = 8;
  const cellW = (pageW - marginX * 2) / cols;
  const cellH = (pageH - marginY * 2) / rows;
  const perPage = cols * rows;

  for (let i = 0; i < students.length; i++) {
    const indexOnPage = i % perPage;

    if (indexOnPage === 0 && i > 0) doc.addPage();

    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    const imgData = await drawLabelCanvas(students[i], cellW, cellH, options);
    doc.addImage(imgData, 'PNG', x, y, cellW, cellH);
  }

  printPDF(doc, `barcodes-${Date.now()}.pdf`);
}

// ─── Card Generator ───────────────────────────────────────
export async function generateCardsPDF(
  students: StudentQRData[],
  options: CardOptions
): Promise<void> {
  const { cardWidth, cardHeight, backgroundImage, qr, name, code } = options;

  const doc = new jsPDF({
    orientation: cardWidth > cardHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [cardWidth, cardHeight],
  });

  const pxPerMm = 3.78;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    if (i > 0) doc.addPage();

    if (backgroundImage) {
      doc.addImage(backgroundImage, 'JPEG', 0, 0, cardWidth, cardHeight);
    }

    const qrData = await generateQR(student.studentCode);
    doc.addImage(qrData, 'PNG', qr.x, qr.y, qr.size, qr.size);

    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = Math.floor(cardWidth * pxPerMm);
    nameCanvas.height = Math.floor(name.fontSize * pxPerMm * 2);
    const nCtx = nameCanvas.getContext('2d')!;
    nCtx.font = `bold ${name.fontSize * pxPerMm}px Arial`;
    nCtx.fillStyle = '#000000';
    nCtx.textAlign = 'center';
    nCtx.direction = 'rtl';
    nCtx.fillText(student.fullName, nameCanvas.width / 2, name.fontSize * pxPerMm);
    doc.addImage(nameCanvas.toDataURL(), 'PNG', 0, name.y - name.fontSize, cardWidth, name.fontSize * 2);

    const codeCanvas = document.createElement('canvas');
    codeCanvas.width = Math.floor(cardWidth * pxPerMm);
    codeCanvas.height = Math.floor(code.fontSize * pxPerMm * 2);
    const cCtx = codeCanvas.getContext('2d')!;
    cCtx.font = `${code.fontSize * pxPerMm}px monospace`;
    cCtx.fillStyle = '#333333';
    cCtx.textAlign = 'center';
    cCtx.direction = 'ltr';
    cCtx.fillText(student.studentCode, codeCanvas.width / 2, code.fontSize * pxPerMm);
    doc.addImage(codeCanvas.toDataURL(), 'PNG', 0, code.y - code.fontSize, cardWidth, code.fontSize * 2);
  }

  printPDF(doc, `cards-${Date.now()}.pdf`);
}

// ─── توليد صور الليبلز بمقاس حقيقي (مم) — لمعاينة الطباعة داخل التطبيق ───
export async function generateLabelImages(
  students: StudentQRData[],
  options: LabelOptions = {}
): Promise<string[]> {
  const widthMm = options.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM;
  const heightMm = options.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;

  return Promise.all(
    students.map(s => drawLabelCanvas(s, widthMm, heightMm, { showName: true, showCode: true, ...options }))
  );
}

// ─── توليد PDF للطباعة المباشرة على طابعة الليبل (كل صفحة = لاصقة واحدة) ───
export async function generateDirectLabelsPDF(
  students: StudentQRData[],
  options: LabelOptions = {}
): Promise<void> {
  const widthMm = options.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM;
  const heightMm = options.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;

  const doc = new jsPDF({
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  for (let i = 0; i < students.length; i++) {
    if (i > 0) doc.addPage([widthMm, heightMm]);

    const imgData = await drawLabelCanvas(students[i], widthMm, heightMm, {
      showName: true,
      showCode: true,
      ...options,
    });
    doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
  }

  printPDF(doc, `labels-${Date.now()}.pdf`);
}

// ─── تصدير درجات الحصة كـ PDF احترافي ──────────────────────────────────────
export interface GradeExportRecord {
  studentName: string;
  studentCode: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  degree: number | null;
}

export interface GradeExportOptions {
  sessionTitle: string;
  sessionDate: string;
  outOf: number | null;
  groupName?: string;
  subjectName?: string;
  teacherName?: string;
  centerName?: string;
}

export function exportGradesPDF(
  records: GradeExportRecord[],
  opts: GradeExportOptions,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── ثوابت التخطيط ──────────────────────────────────────────────────────
  const PW = 210;          // عرض A4 بالمم
  const ML = 14;           // هامش يسار/يمين
  const MR = PW - ML;
  const COL = {
    rank:   MR,            // # (RTL: يبدأ من اليمين)
    code:   MR - 14,
    name:   MR - 52,
    status: ML + 32,
    degree: ML + 10,
    outOf:  ML,
  };

  const STATUS_AR: Record<string, string> = {
    present: 'حاضر', absent: 'غايب', late: 'متأخر', excused: 'معذور',
  };
  const STATUS_COLOR: Record<string, [number, number, number]> = {
    present: [16, 185, 129],
    late:    [245, 158, 11],
    absent:  [239, 68,  68],
    excused: [139, 92,  246],
  };

  // ── مساعد: رسم نص RTL على canvas ثم وضعه على الـ PDF ────────────────────
  const drawRtlText = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: [number, number, number] = [30, 30, 30],
    bold = false,
    maxWidthPx = 400,
  ) => {
    const canvas = document.createElement('canvas');
    const scale  = 4;
    const fSize  = fontSize * scale;
    canvas.height = Math.ceil(fSize * 1.6);
    canvas.width  = maxWidthPx * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.font      = `${bold ? 'bold ' : ''}${fSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    // اقتطاع لو أطول
    let t = text;
    while (ctx.measureText(t).width > maxWidthPx * scale - 4 && t.length > 1) t = t.slice(0, -1);
    if (t !== text) t = t.trimEnd() + '…';
    ctx.fillText(t, canvas.width, fSize * 1.1);
    const wmm  = canvas.width  / scale / (96 / 25.4);
    const hmm  = canvas.height / scale / (96 / 25.4);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x - wmm, y - hmm * 0.75, wmm, hmm);
  };

  const drawLtrText = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: [number, number, number] = [30, 30, 30],
    bold = false,
  ) => {
    const canvas = document.createElement('canvas');
    const scale  = 4;
    const fSize  = fontSize * scale;
    canvas.height = Math.ceil(fSize * 1.6);
    canvas.width  = 300 * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.font      = `${bold ? 'bold ' : ''}${fSize}px monospace`;
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, fSize * 1.1);
    const wmm = canvas.width  / scale / (96 / 25.4);
    const hmm = canvas.height / scale / (96 / 25.4);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x - wmm / 2, y - hmm * 0.75, wmm, hmm);
  };

  // ── Header Banner ─────────────────────────────────────────────────────────
  doc.setFillColor(14, 59, 46);
  doc.roundedRect(ML, 10, PW - ML * 2, 28, 3, 3, 'F');

  // عنوان الجلسة
  drawRtlText(opts.sessionTitle, MR - 2, 21, 9, [255, 255, 255], true, 240);

  // تفاصيل فرعية: التاريخ، المجموعة، الكورس، المدرس
  const subParts = [opts.sessionDate];
  if (opts.groupName)   subParts.push(opts.groupName);
  if (opts.subjectName) subParts.push(opts.subjectName);
  if (opts.teacherName) subParts.push(opts.teacherName);
  drawRtlText(subParts.join('  |  '), MR - 2, 31, 6.5, [255, 255, 255, 0.75] as any, false, 240);

  // اسم المركز (يسار)
  if (opts.centerName) {
    drawRtlText(opts.centerName, ML + 52, 21, 7.5, [212, 171, 83], true, 100);
  }

  // ── Stats Bar ─────────────────────────────────────────────────────────────
  const present  = records.filter(r => r.status === 'present' || r.status === 'late');
  const absent   = records.filter(r => r.status === 'absent');
  const graded   = present.filter(r => r.degree !== null);
  const avgGrade = graded.length && opts.outOf
    ? (graded.reduce((s, r) => s + (r.degree ?? 0), 0) / graded.length).toFixed(1)
    : null;

  const stats = [
    { label: 'إجمالي الطلاب', value: String(records.length), color: [14, 59, 46] as [number,number,number] },
    { label: 'الحاضرون',      value: String(present.length),  color: [16, 185, 129] as [number,number,number] },
    { label: 'الغايبون',      value: String(absent.length),   color: [239, 68, 68] as [number,number,number] },
    { label: 'رُصدت درجاتهم', value: String(graded.length),  color: [99, 102, 241] as [number,number,number] },
    ...(avgGrade ? [{ label: 'متوسط الدرجات', value: `${avgGrade}/${opts.outOf}`, color: [245, 158, 11] as [number,number,number] }] : []),
  ];

  const statBoxW  = (PW - ML * 2) / stats.length;
  const statY     = 42;

  stats.forEach((s, i) => {
    const bx = ML + i * statBoxW;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(bx, statY, statBoxW - 1.5, 14, 2, 2, 'FD');
    // القيمة
    drawLtrText(s.value, bx + statBoxW / 2 - 0.75, statY + 6.5, 8.5, s.color, true);
    // التسمية
    drawRtlText(s.label, bx + statBoxW - 3, statY + 11.5, 5, [100, 116, 139], false, 80);
  });

  // ── Table Header ──────────────────────────────────────────────────────────
  let y = statY + 18;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(ML, y, PW - ML * 2, 8, 'FD');

  drawRtlText('#',           COL.rank,   y + 5.5, 6, [71, 85, 105], true, 18);
  drawRtlText('الكود',       COL.code,   y + 5.5, 6, [71, 85, 105], true, 28);
  drawRtlText('اسم الطالب', COL.name,   y + 5.5, 6, [71, 85, 105], true, 100);
  drawRtlText('الحالة',      COL.status, y + 5.5, 6, [71, 85, 105], true, 36);
  drawRtlText('الدرجة',      COL.degree + 10, y + 5.5, 6, [71, 85, 105], true, 36);

  y += 8;

  // ── Table Rows ────────────────────────────────────────────────────────────
  const ROW_H  = 9;
  const PAGE_H = 282;

  records.forEach((rec, idx) => {
    // صفحة جديدة لو اقتربنا من نهاية الصفحة
    if (y + ROW_H > PAGE_H) {
      doc.addPage();
      y = 14;
      // إعادة رسم رأس الجدول
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(ML, y, PW - ML * 2, 8, 'FD');
      drawRtlText('#',           COL.rank,   y + 5.5, 6, [71, 85, 105], true, 18);
      drawRtlText('الكود',       COL.code,   y + 5.5, 6, [71, 85, 105], true, 28);
      drawRtlText('اسم الطالب', COL.name,   y + 5.5, 6, [71, 85, 105], true, 100);
      drawRtlText('الحالة',      COL.status, y + 5.5, 6, [71, 85, 105], true, 36);
      drawRtlText('الدرجة',      COL.degree + 10, y + 5.5, 6, [71, 85, 105], true, 36);
      y += 8;
    }

    // خلفية الصف الزوجي
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(249, 250, 251);
      doc.rect(ML, y, PW - ML * 2, ROW_H, 'F');
    }

    // خط فاصل خفيف
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.15);
    doc.line(ML, y + ROW_H, MR, y + ROW_H);

    const textY = y + ROW_H * 0.68;

    // رقم التسلسل
    drawLtrText(String(idx + 1), COL.rank - 3, textY, 6, [148, 163, 184]);

    // الكود
    drawLtrText(rec.studentCode, COL.code - 5, textY, 6, [71, 85, 105], true);

    // الاسم
    drawRtlText(rec.studentName, COL.name, textY, 6.5, [30, 41, 59], false, 100);

    // بادج الحالة
    const sColor = STATUS_COLOR[rec.status] ?? [100, 116, 139];
    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.roundedRect(COL.status - 16, y + 1.8, 18, 5.5, 1.5, 1.5, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    drawRtlText(STATUS_AR[rec.status] ?? rec.status, COL.status - 0.5, textY, 5.5, sColor, true, 36);

    // الدرجة
    if (rec.status !== 'absent' && rec.status !== 'excused') {
      if (rec.degree !== null) {
        const degStr = opts.outOf ? `${rec.degree} / ${opts.outOf}` : String(rec.degree);
        drawLtrText(degStr, COL.degree + 14, textY, 7, [14, 59, 46], true);
      } else {
        drawLtrText('—', COL.degree + 14, textY, 7, [203, 213, 225]);
      }
    }

    y += ROW_H;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(ML, 289, MR, 289);
    drawRtlText(
      `صفحة ${p} من ${totalPages}  ·  تم التوليد ${new Date().toLocaleDateString('ar-EG')}`,
      MR, 293.5, 5.5, [148, 163, 184],
    );
    if (opts.centerName) {
      drawRtlText(opts.centerName, ML + 40, 293.5, 5.5, [148, 163, 184], false, 80);
    }
  }

  const safeName = opts.sessionTitle.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '-').slice(0, 40);
  printPDF(doc, `grades-${safeName}-${Date.now()}.pdf`);
}
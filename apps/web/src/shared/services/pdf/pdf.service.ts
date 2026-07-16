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
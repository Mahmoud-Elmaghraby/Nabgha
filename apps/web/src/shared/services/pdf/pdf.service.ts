import jsPDF from 'jspdf';
import QRCode from 'qrcode';

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

// توليد QR كـ base64
async function generateQR(data: string): Promise<string> {
  return QRCode.toDataURL(JSON.stringify({ code: data, id: data }), {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// رسم label واحد على canvas وإرجاعه كـ base64
async function drawLabelCanvas(
  student: StudentQRData,
  widthPx: number,
  heightPx: number,
  options: LabelOptions
): Promise<string> {
  const { showName = true, showCode = true, showGrade = false } = options;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  // خلفية بيضاء
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // حدود
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, widthPx - 4, heightPx - 4);

  // QR
  const qrImg = new Image();
  const qrData = await generateQR(student.studentCode);
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.src = qrData;
  });
  const qrSize = widthPx * 0.6;
  const qrX = (widthPx - qrSize) / 2;
  const qrY = 10;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  let textY = qrY + qrSize + 20;

  // الاسم بالعربي
  if (showName) {
    ctx.font = `bold ${widthPx * 0.09}px Arial`;
    ctx.fillStyle = '#0E3B2E';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    const name = student.fullName.length > 18
      ? student.fullName.substring(0, 18) + '...'
      : student.fullName;
    ctx.fillText(name, widthPx / 2, textY);
    textY += widthPx * 0.1;
  }

  // الكود
  if (showCode) {
    ctx.font = `${widthPx * 0.075}px monospace`;
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.fillText(student.studentCode, widthPx / 2, textY);
    textY += widthPx * 0.09;
  }

  // المرحلة
  if (showGrade && student.grade) {
    ctx.font = `${widthPx * 0.065}px Arial`;
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(student.grade, widthPx / 2, textY);
  }

  return canvas.toDataURL('image/png');
}

// ─── Label Generator (A4 PDF) ─────────────────────────────
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

  // DPI تقريبي: 1mm = 3.78px
  const pxPerMm = 3.78;
  const labelWPx = Math.floor(cellW * pxPerMm);
  const labelHPx = Math.floor(cellH * pxPerMm);

  for (let i = 0; i < students.length; i++) {
    const indexOnPage = i % perPage;

    if (indexOnPage === 0 && i > 0) doc.addPage();

    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    const imgData = await drawLabelCanvas(students[i], labelWPx, labelHPx, options);
    doc.addImage(imgData, 'PNG', x, y, cellW, cellH);
  }

  doc.save(`barcodes-${Date.now()}.pdf`);
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

    // الخلفية
    if (backgroundImage) {
      doc.addImage(backgroundImage, 'JPEG', 0, 0, cardWidth, cardHeight);
    }

    // رسم QR على canvas
    const qrData = await generateQR(student.studentCode);
    doc.addImage(qrData, 'PNG', qr.x, qr.y, qr.size, qr.size);

    // رسم الاسم على canvas صغير
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

    // الكود
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

  doc.save(`cards-${Date.now()}.pdf`);
}

// ─── توليد صور الليبلز فقط (بدون فتح نافذة) — تُستخدم لمعاينة الطباعة داخل التطبيق ───
// (استبدلت الطريقة القديمة بفتح نافذة منفصلة window.open، لأن المتصفحات الحديثة بتحظرها
// بصمت لما بتتفتح بعد أي عملية غير متزامنة زي توليد الباركودات، من غير أي رسالة خطأ للمستخدم)
export async function generateLabelImages(
  students: StudentQRData[],
  options: LabelOptions = {}
): Promise<string[]> {
  const pxPerMm = 3.78;
  const labelW = Math.floor(60 * pxPerMm);
  const labelH = Math.floor(70 * pxPerMm);

  return Promise.all(
    students.map(s => drawLabelCanvas(s, labelW, labelH, { showName: true, showCode: true, ...options }))
  );
}

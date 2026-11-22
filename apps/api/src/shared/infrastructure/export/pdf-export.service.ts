import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { ExportColumn, ExportOptions, CompositeReportOptions } from './export.types';

export interface HonorBoardEntry {
  rank: number;
  studentName: string;
  studentCode: string;
  scoreLabel: string;
}

export interface HonorBoardOptions {
  title: string;
  subtitle: string;
  entries: HonorBoardEntry[];
}

const DEFAULT_HEADER_COLOR = '#333333';
const MAX_CONCURRENT_JOBS = 3; // حد أقصى للحمل المتزامن على السيرفر

@Injectable()
export class PdfExportService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfExportService.name);
  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;
  private activeJobs = 0;

  // إطلاق كسول (lazy) — Chrome بتاع Puppeteer مش بيتشغّل غير أول مرة حد
  // فعلاً يطلب تصدير PDF، مش من ساعة ما البرنامج بيفتح. ده بيحل مشكلتين:
  // 1. إقلاع أبطأ من غير داعي لمستخدم أصلاً مش هيستخدم التقارير في الجلسة دي.
  // 2. تشغيل متصفح كامل جديد في كل مرة نبغة بتفتح كان بيسبب آثار جانبية غير
  //    متوقعة على مستوى النظام (زي تفعيل أوفرلايز صوت من برامج تالتة على بعض
  //    الأجهزة) رغم إنه مش استخدام فعلي لأي فيتشر.
  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    if (!this.launchPromise) {
      this.launchPromise = puppeteer
        .launch({
          headless: 'shell',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--mute-audio',
            '--disable-gpu',
          ],
        })
        .then((browser) => {
          this.browser = browser;
          this.logger.log('Puppeteer browser instance launched (lazy, on first use)');
          return browser;
        });
    }

    return this.launchPromise;
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }

  async generate<T extends Record<string, any>>(
    rows: T[],
    columns: ExportColumn<T>[],
    options: ExportOptions = {},
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;
    const page = await browser.newPage();
    try {
      const html = this.buildHtml(rows, columns, options);
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        landscape: options.orientation === 'landscape',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
      this.activeJobs--;
    }
  }

  private buildHtml<T extends Record<string, any>>(
    rows: T[],
    columns: ExportColumn<T>[],
    options: ExportOptions,
  ): string {
    const rtl = options.rtl ?? true;
    const headerColor = options.headerColor ?? DEFAULT_HEADER_COLOR;
    const theadCells = columns.map((col) => `<th>${this.escape(col.header)}</th>`).join('');
    const bodyRows = rows
      .map((row) => {
        const cells = columns
          .map((col) => {
            const rawValue = row[col.key];
            const value = col.format ? col.format(rawValue, row) : (rawValue ?? '');
            return `<td>${this.escape(String(value))}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    const headerBlock = options.title
      ? `<div class="header">
          <h1>${this.escape(options.title)}</h1>
          ${options.subtitle ? `<p class="subtitle">${this.escape(options.subtitle)}</p>` : ''}
        </div>`
      : '';
    return `<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; margin: 0; padding: 0; color: #222; }
  .header { text-align: center; margin-bottom: 16px; }
  .header h1 { font-size: 18px; margin: 0 0 4px; }
  .header .subtitle { font-size: 12px; color: #666; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: ${rtl ? 'right' : 'left'}; }
  th { background-color: ${headerColor}; color: #fff; font-weight: bold; }
  tr:nth-child(even) { background-color: #f9f9f9; }
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 12px; }
</style>
</head>
<body>
  ${headerBlock}
  <table>
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">تم التوليد بتاريخ ${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** تقرير مركّب: ملخص أرقام + أقسام (جداول) متتالية في نفس ملف الـ PDF */
  async generateReport(options: CompositeReportOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;
    const page = await browser.newPage();
    try {
      const html = this.buildCompositeHtml(options);
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
      this.activeJobs--;
    }
  }

  private buildCompositeHtml(options: CompositeReportOptions): string {
    const rtl = options.rtl ?? true;
    const headerColor = options.headerColor ?? DEFAULT_HEADER_COLOR;
    const brandBlock = options.brandName
      ? `<div class="brand-name">${this.escape(options.brandName)}</div>`
      : '';
    const printExtrasBlock = (options.notesAreaLabel || options.signatureLineLabel)
      ? `<div class="print-extras">
          ${options.notesAreaLabel ? `
            <div class="notes-box">
              <div class="extras-label">${this.escape(options.notesAreaLabel)}</div>
              <div class="notes-line"></div>
              <div class="notes-line"></div>
              <div class="notes-line"></div>
            </div>` : ''}
          ${options.signatureLineLabel ? `
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="extras-label">${this.escape(options.signatureLineLabel)}</div>
            </div>` : ''}
        </div>`
      : '';
    const summaryBlock = options.summary && options.summary.length > 0
      ? `<div class="summary">
          ${options.summary.map(item => `
            <div class="summary-item">
              <div class="summary-label">${this.escape(item.label)}</div>
              <div class="summary-value">${this.escape(String(item.value))}</div>
            </div>
          `).join('')}
        </div>`
      : '';
    const sectionsBlock = options.sections.map(section => {
      const theadCells = section.columns.map(col => `<th>${this.escape(col.header)}</th>`).join('');
      const bodyRows = section.rows.length > 0
        ? section.rows.map(row => {
            const cells = section.columns.map(col => {
              const rawValue = row[col.key];
              const value = col.format ? col.format(rawValue, row) : (rawValue ?? '');
              return `<td>${this.escape(String(value))}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('')
        : `<tr><td colspan="${section.columns.length}" class="empty-row">لا توجد بيانات</td></tr>`;
      return `
        <div class="section">
          <h2>${this.escape(section.title)}</h2>
          <table>
            <thead><tr>${theadCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      `;
    }).join('');
    return `<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; margin: 0; padding: 0; color: #222; }
  .header { text-align: center; margin-bottom: 16px; }
  .header h1 { font-size: 18px; margin: 0 0 4px; }
  .header .subtitle { font-size: 12px; color: #666; margin: 0; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .summary-item { flex: 1; min-width: 120px; border: 1px solid #eee; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .summary-label { font-size: 10px; color: #888; margin-bottom: 4px; }
  .summary-value { font-size: 14px; font-weight: bold; color: ${headerColor}; }
  .section { margin-bottom: 20px; page-break-inside: avoid; }
  .section h2 { font-size: 13px; margin: 0 0 8px; border-bottom: 2px solid ${headerColor}; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: ${rtl ? 'right' : 'left'}; }
  th { background-color: ${headerColor}; color: #fff; font-weight: bold; }
  tr:nth-child(even) { background-color: #f9f9f9; }
  .empty-row { text-align: center; color: #aaa; padding: 12px; }
  .brand-name { text-align: center; font-size: 12px; font-weight: bold; color: ${headerColor}; margin-bottom: 4px; }
  .print-extras { display: flex; gap: 16px; margin-top: 26px; page-break-inside: avoid; }
  .notes-box { flex: 2; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .extras-label { font-size: 10px; color: #888; font-weight: bold; margin-bottom: 8px; }
  .notes-line { border-bottom: 1px dashed #ccc; height: 18px; }
  .signature-box { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; }
  .signature-line { width: 100%; border-bottom: 1px solid #333; height: 38px; }
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    ${brandBlock}
    <h1>${this.escape(options.title)}</h1>
    ${options.subtitle ? `<p class="subtitle">${this.escape(options.subtitle)}</p>` : ''}
  </div>
  ${summaryBlock}
  ${sectionsBlock}
  ${printExtrasBlock}
  <div class="footer">تم التوليد بتاريخ ${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`;
  }

  /** لوحة شرف — تصميم احتفالي مختلف تماماً عن الجداول العادية (ميداليات + ألوان) */
  async generateHonorBoard(options: HonorBoardOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;
    const page = await browser.newPage();
    try {
      const html = this.buildHonorBoardHtml(options);
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
      this.activeJobs--;
    }
  }

  private buildHonorBoardHtml(options: HonorBoardOptions): string {
    const MEDALS = ['🥇', '🥈', '🥉'];
    const RANK_COLORS = ['#D4AB53', '#B0B0B0', '#B87333'];
    const entriesHtml = options.entries.map((entry) => {
      const isTop3 = entry.rank <= 3;
      const medal = isTop3 ? MEDALS[entry.rank - 1] : '';
      const accentColor = isTop3 ? RANK_COLORS[entry.rank - 1] : '#0E3B2E';
      return `
        <div class="entry ${isTop3 ? 'top3' : ''}" style="border-color: ${accentColor};">
          <div class="rank-badge" style="background: ${accentColor};">
            ${medal || `#${entry.rank}`}
          </div>
          <div class="entry-info">
            <div class="entry-name">${this.escape(entry.studentName)}</div>
            <div class="entry-code">${this.escape(entry.studentCode)}</div>
          </div>
          <div class="entry-score">${this.escape(entry.scoreLabel)}</div>
        </div>
      `;
    }).join('');
    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Tahoma, sans-serif;
    background: linear-gradient(135deg, #0E3B2E 0%, #1F6B4E 100%);
    padding: 30px;
    min-height: 100vh;
  }
  .board {
    background: white;
    border-radius: 20px;
    padding: 40px 30px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }
  .header { text-align: center; margin-bottom: 30px; }
  .header .star-icon { font-size: 40px; margin-bottom: 8px; }
  .header h1 {
    font-size: 28px;
    color: #0E3B2E;
    margin-bottom: 6px;
  }
  .header .subtitle { font-size: 14px; color: #888; }
  .entries { display: flex; flex-direction: column; gap: 14px; }
  .entry {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 14px;
    border: 2px solid #eee;
    background: #fafafa;
  }
  .entry.top3 {
    background: linear-gradient(90deg, #fdf9f0 0%, #ffffff 100%);
  }
  .rank-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: bold;
    color: white;
    flex-shrink: 0;
  }
  .entry-info { flex: 1; }
  .entry-name { font-size: 18px; font-weight: bold; color: #222; }
  .entry-code { font-size: 12px; color: #999; font-family: monospace; margin-top: 2px; }
  .entry-score {
    font-size: 20px;
    font-weight: bold;
    color: #0E3B2E;
    background: #0E3B2E10;
    padding: 6px 16px;
    border-radius: 10px;
  }
  .footer { text-align: center; font-size: 10px; color: #bbb; margin-top: 24px; }
</style>
</head>
<body>
  <div class="board">
    <div class="header">
      <div class="star-icon">🏆</div>
      <h1>${this.escape(options.title)}</h1>
      <p class="subtitle">${this.escape(options.subtitle)}</p>
    </div>
    <div class="entries">
      ${entriesHtml}
    </div>
  </div>
  <div class="footer">تم التوليد بتاريخ ${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`;
  }

  /**
   * التقرير الشهري لولي الأمر — تصميم تقرير مدرسي احترافي وملوّن (Report Card)،
   * مختلف عن قالب الجداول الرمادي العادي (buildCompositeHtml) المستخدم في باقي
   * التقارير المالية/الإدارية. نفس شكل الـ CompositeReportOptions بالظبط —
   * صفر تغيير على الـ Provider غير استدعاء الدالة دي بدل generateReport().
   */
  async generateStudentMonthlyReport(options: CompositeReportOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;
    const page = await browser.newPage();
    try {
      const html = this.buildStudentMonthlyReportHtml(options);
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
      this.activeJobs--;
    }
  }

  /** ألوان ثيم كل بطاقة ملخص حسب مضمون الـ label (نفس ألوان الحالة المستخدمة في الفرونت إند) */
  private summaryTheme(label: string, value: string | number): { bg: string; border: string; fg: string; icon: string } {
    const v = String(value);
    if (label.includes('مؤشر الأداء')) return { bg: '#F5F3FF', border: '#8B5CF6', fg: '#6D28D9', icon: '⭐' };
    if (label === 'حاضر') return { bg: '#ECFDF5', border: '#10B981', fg: '#047857', icon: '✅' };
    if (label === 'غائب') return { bg: '#FEF2F2', border: '#EF4444', fg: '#B91C1C', icon: '❌' };
    if (label === 'غياب بعذر') return { bg: '#FFFBEB', border: '#F59E0B', fg: '#B45309', icon: '🟡' };
    if (label.includes('نسبة الحضور')) return { bg: '#EFF6FF', border: '#3B82F6', fg: '#1D4ED8', icon: '📈' };
    if (label.includes('متوسط الدرجات')) return { bg: '#F5F3FF', border: '#8B5CF6', fg: '#6D28D9', icon: '📝' };
    if (label.includes('حالة السداد')) {
      const ok = v.includes('مدفوع') && !v.includes('غير');
      return ok
        ? { bg: '#ECFDF5', border: '#10B981', fg: '#047857', icon: '💰' }
        : { bg: '#FEF2F2', border: '#EF4444', fg: '#B91C1C', icon: '💸' };
    }
    if (label.includes('مستحقات متأخرة')) {
      const clear = v === 'لا يوجد';
      return clear
        ? { bg: '#ECFDF5', border: '#10B981', fg: '#047857', icon: '✔️' }
        : { bg: '#FEF2F2', border: '#EF4444', fg: '#B91C1C', icon: '⚠️' };
    }
    return { bg: '#F3F4F6', border: '#9CA3AF', fg: '#374151', icon: '📚' };
  }

  /** خلية ملونة (pill) لأعمدة الحالة/النسبة داخل جداول التقرير الملوّن */
  private themedCell(colKey: string, value: string): string {
    if (colKey === 'status') {
      const map: Record<string, { bg: string; fg: string }> = {
        'حاضر': { bg: '#ECFDF5', fg: '#047857' },
        'غائب': { bg: '#FEF2F2', fg: '#B91C1C' },
        'غياب بعذر': { bg: '#FFFBEB', fg: '#B45309' },
      };
      const theme = map[value] ?? { bg: '#F3F4F6', fg: '#374151' };
      return `<span class="pill" style="background:${theme.bg};color:${theme.fg};">${this.escape(value)}</span>`;
    }
    if (colKey === 'percentage') {
      const num = parseInt(value, 10);
      const theme = Number.isNaN(num) ? { bg: '#F3F4F6', fg: '#374151' }
        : num >= 85 ? { bg: '#ECFDF5', fg: '#047857' }
        : num >= 70 ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : num >= 50 ? { bg: '#FFFBEB', fg: '#B45309' }
        : { bg: '#FEF2F2', fg: '#B91C1C' };
      return `<span class="pill" style="background:${theme.bg};color:${theme.fg};">${this.escape(value)}</span>`;
    }
    return this.escape(value);
  }

  private buildStudentMonthlyReportHtml(options: CompositeReportOptions): string {
    const rtl = options.rtl ?? true;
    const brandBlock = options.brandName
      ? `<div class="brand-pill">${this.escape(options.brandName)}</div>`
      : '';

    const summaryCardsHtml = (options.summary ?? []).map((item) => {
      const theme = this.summaryTheme(item.label, item.value);
      const isHero = item.label.includes('مؤشر الأداء');
      return `
        <div class="summary-card ${isHero ? 'hero' : ''}" style="background:${theme.bg}; border-color:${theme.border};">
          <div class="summary-icon">${theme.icon}</div>
          <div class="summary-text">
            <div class="summary-label">${this.escape(item.label)}</div>
            <div class="summary-value" style="color:${theme.fg};">${this.escape(String(item.value))}</div>
          </div>
        </div>`;
    }).join('');

    const sectionIcons: Record<string, string> = {
      'سجل الحضور هذا الشهر': '📅',
      'الدرجات هذا الشهر': '📝',
    };

    const sectionsHtml = options.sections.map((section) => {
      const theadCells = section.columns.map((col) => `<th>${this.escape(col.header)}</th>`).join('');
      const bodyRows = section.rows.length > 0
        ? section.rows.map((row) => {
            const cells = section.columns.map((col) => {
              const rawValue = row[col.key];
              const value = col.format ? col.format(rawValue, row) : (rawValue ?? '');
              return `<td>${this.themedCell(col.key, String(value))}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('')
        : `<tr><td colspan="${section.columns.length}" class="empty-row">لا توجد بيانات</td></tr>`;
      const icon = sectionIcons[section.title] ?? '📄';
      return `
        <div class="section">
          <h2><span class="section-icon">${icon}</span>${this.escape(section.title)}</h2>
          <table>
            <thead><tr>${theadCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`;
    }).join('');

    // subtitle بييجي من الـ provider بالشكل: "اسم الطالب — الكود — الشهر"
    // بنفصل اسم الطالب لوحده عشان يظهر بخط أكبر ومميز عن باقي التفاصيل
    const subtitleParts = (options.subtitle ?? '').split(' — ');
    const studentNamePart = (subtitleParts[0] ?? '').trim();
    const restSubtitle = subtitleParts.slice(1).join(' — ').trim();

    const printExtrasBlock = (options.notesAreaLabel || options.signatureLineLabel)
      ? `<div class="print-extras">
          ${options.notesAreaLabel ? `
            <div class="notes-box">
              <div class="extras-label">${this.escape(options.notesAreaLabel)}</div>
              <div class="notes-line"></div>
              <div class="notes-line"></div>
              <div class="notes-line"></div>
            </div>` : ''}
          ${options.signatureLineLabel ? `
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="extras-label">${this.escape(options.signatureLineLabel)}</div>
            </div>` : ''}
        </div>`
      : '';

    return `<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="ar">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Tahoma, sans-serif; background: #F4F6F5; color: #222; padding: 0; }
  .page { padding: 0 4px; }
  .header {
    background: #F3FAF6;
    border: 2px solid #0E3B2E;
    border-radius: 16px;
    padding: 18px 24px 14px;
    text-align: center;
    color: #0E3B2E;
    margin-bottom: 14px;
  }
  .brand-pill {
    display: inline-block;
    background: #0E3B2E;
    color: #fff;
    border-radius: 999px;
    padding: 5px 18px;
    font-size: 15.5px;
    font-weight: bold;
    margin-bottom: 10px;
  }
  .header .icon { font-size: 30px; margin-bottom: 6px; }
  .header h1 { font-size: 24px; margin-bottom: 4px; color: #0E3B2E; }
  .header .student-name { font-size: 20px; font-weight: bold; color: #1F6B4E; margin: 2px 0 4px; }
  .header .subtitle { font-size: 12.5px; color: #6B7A75; }
  .summary-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .summary-card {
    flex: 1 1 30%;
    min-width: 150px;
    border: 1.5px solid;
    border-radius: 12px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .summary-card.hero { flex-basis: 100%; padding: 11px 16px; }
  .summary-icon { font-size: 23px; }
  .summary-label { font-size: 12px; color: #666; margin-bottom: 3px; }
  .summary-value { font-size: 18px; font-weight: bold; }
  .summary-card.hero .summary-value { font-size: 21px; }
  .section { margin-bottom: 12px; page-break-inside: avoid; background: #fff; border-radius: 12px; padding: 12px 16px; border: 1px solid #E5E7EB; }
  .section h2 { font-size: 15.5px; margin-bottom: 8px; color: #0E3B2E; display: flex; align-items: center; gap: 6px; }
  .section-icon { font-size: 17px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { padding: 6px 9px; text-align: ${rtl ? 'right' : 'left'}; }
  th { background: #0E3B2E; color: #fff; font-weight: bold; }
  th:first-child { border-top-${rtl ? 'right' : 'left'}-radius: 8px; border-bottom-${rtl ? 'right' : 'left'}-radius: 8px; }
  th:last-child { border-top-${rtl ? 'left' : 'right'}-radius: 8px; border-bottom-${rtl ? 'left' : 'right'}-radius: 8px; }
  tbody tr:nth-child(even) { background-color: #F0F7F4; }
  td { border-bottom: 1px solid #EEF1EF; }
  .pill { display: inline-block; padding: 3px 11px; border-radius: 999px; font-weight: bold; font-size: 11.5px; }
  .empty-row { text-align: center; color: #aaa; padding: 14px; }
  .print-extras { display: flex; gap: 16px; margin-top: 12px; page-break-inside: avoid; }
  .notes-box { flex: 2; border: 1px solid #E5E7EB; background: #fff; border-radius: 12px; padding: 9px 14px; }
  .extras-label { font-size: 11.5px; color: #888; font-weight: bold; margin-bottom: 8px; }
  .notes-line { border-bottom: 1px dashed #ccc; height: 15px; }
  .signature-box { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; }
  .signature-line { width: 100%; border-bottom: 1px solid #333; height: 28px; }
  .footer { text-align: center; font-size: 10.5px; color: #999; margin-top: 8px; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${brandBlock}
      <div class="icon">🎓</div>
      <h1>${this.escape(options.title)}</h1>
      ${studentNamePart ? `<p class="student-name">${this.escape(studentNamePart)}</p>` : ''}
      ${restSubtitle ? `<p class="subtitle">${this.escape(restSubtitle)}</p>` : ''}
    </div>
    <div class="summary-grid">
      ${summaryCardsHtml}
    </div>
    ${sectionsHtml}
    ${printExtrasBlock}
    <div class="footer">تم التوليد بتاريخ ${new Date().toLocaleDateString('ar-EG')}</div>
  </div>
</body>
</html>`;
  }
}
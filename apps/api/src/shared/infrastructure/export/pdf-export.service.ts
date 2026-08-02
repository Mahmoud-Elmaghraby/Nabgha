import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
export class PdfExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfExportService.name);
  private browser: Browser | null = null;
  private activeJobs = 0;

  async onModuleInit(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.logger.log('Puppeteer browser instance launched');
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }

  async generate<T extends Record<string, any>>(
    rows: T[],
    columns: ExportColumn<T>[],
    options: ExportOptions = {},
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('PdfExportService: browser not initialized');
    }

    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;

    const page = await this.browser.newPage();
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
    if (!this.browser) {
      throw new Error('PdfExportService: browser not initialized');
    }

    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;

    const page = await this.browser.newPage();
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
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${this.escape(options.title)}</h1>
    ${options.subtitle ? `<p class="subtitle">${this.escape(options.subtitle)}</p>` : ''}
  </div>
  ${summaryBlock}
  ${sectionsBlock}
  <div class="footer">تم التوليد بتاريخ ${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`;
  }

  /** لوحة شرف — تصميم احتفالي مختلف تماماً عن الجداول العادية (ميداليات + ألوان) */
  async generateHonorBoard(options: HonorBoardOptions): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('PdfExportService: browser not initialized');
    }

    while (this.activeJobs >= MAX_CONCURRENT_JOBS) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.activeJobs++;

    const page = await this.browser.newPage();
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
}

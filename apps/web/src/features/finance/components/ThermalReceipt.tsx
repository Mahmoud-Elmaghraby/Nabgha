import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/lib/api/client';
import { printHtml } from '../../../shared/lib/printHtml';

interface ReceiptData {
  receiptNumber: number;
  studentName: string;
  studentCode: string;
  amount: number;
  paymentMethod: string;
  subjectName?: string;
  month?: string;
  treasuryName?: string;
  paidAt: string;
  notes?: string;
  monthlyDueId?: string;
  discountApplied?: number;
}

interface ThermalReceiptProps {
  receipt: ReceiptData;
  onClose: () => void;
  autoPrint?: boolean;
}

const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: 'كاش', visa: 'فيزا', instapay: 'إنستاباي',
  vodafone: 'فودافون كاش', bank: 'تحويل بنكي', other: 'أخرى',
};

/**
 * شكل الإيصال على ورق 80مم. بيتطبع في iframe معزول (printHtml) بطول الإيصال بالظبط.
 * FIN-013: قبل كده كان بيتطبع من صفحة البرنامج كلها بـ position:fixed وطول ثابت 150مم،
 * فكان بيطلع نسختين وبينهم ورق فاضي.
 */
const RECEIPT_CSS = `
  .receipt { box-sizing: border-box; width: 100%; padding: 2mm 4mm 0; font-family: 'Arial', sans-serif;
    font-size: 12px; direction: rtl; color: #000; line-height: 1.6; }
  .receipt .name { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 1mm; }
  .receipt .subtitle { font-size: 10px; text-align: center; margin-bottom: 2mm; }
  .receipt .line-dashed { border-top: 1px dashed #000; margin: 2mm 0; }
  .receipt .line-double { border-top: 3px double #000; margin: 2mm 0; }
  .receipt .row { display: flex; justify-content: space-between; align-items: center; gap: 2mm; margin: 1.5mm 0; font-size: 12px; }
  .receipt .label { color: #333; white-space: nowrap; }
  .receipt .value { font-weight: bold; text-align: left; }
  .receipt .amount-box { text-align: center; margin: 3mm 0; padding: 2mm 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .receipt .amount-num { font-size: 22px; font-weight: bold; }
  .receipt .receipt-num { font-size: 10px; text-align: center; color: #333; }
  .receipt .footer { text-align: center; font-size: 10px; margin-top: 2mm; }
  .receipt .footer-phone { font-size: 11px; font-weight: bold; }
`;

function useBrandingInfo(monthlyDueId?: string) {
  return useQuery({
    queryKey: ['branding-info', monthlyDueId ?? null],
    queryFn: async () => {
      const res = await apiClient.get('/settings/branding-info', {
        params: monthlyDueId ? { monthlyDueId } : undefined,
      });
      return res.data.data as {
        name: string;
        phone: string | null;
        phone2: string | null;
        address: string | null;
        source: 'center' | 'teacher';
      };
    },
    staleTime: 1000 * 30,
  });
}

export function ThermalReceipt({ receipt, onClose, autoPrint = false }: ThermalReceiptProps) {
  const { data: branding } = useBrandingInfo(receipt.monthlyDueId);
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!printRef.current || printing) return;
    setPrinting(true);
    try {
      await printHtml(printRef.current.innerHTML, RECEIPT_CSS, { pageWidthMm: 80, title: `إيصال ${receipt.receiptNumber}` });
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (autoPrint && branding) {
      const t = setTimeout(() => { void handlePrint(); }, 300);
      return () => clearTimeout(t);
    }
  }, [autoPrint, branding]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = new Date(receipt.paidAt);
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  const centerName = branding?.name || 'نبغة';
  const centerPhone = branding?.phone || '';
  const centerPhone2 = branding?.phone2 || '';
  const centerAddress = branding?.address || '';

  return (
    <>

      {/* محتوى الطباعة — مخفي هنا، وبيتنسخ لـ iframe الطباعة (printHtml) */}
      <div ref={printRef} style={{ display: 'none' }} aria-hidden="true">
      <div className="receipt">

        {/* Header */}
        <div className="name">{centerName}</div>
        {centerAddress && <div className="subtitle">{centerAddress}</div>}
        <div className="line-double"/>

        {/* Receipt Info */}
        <div className="receipt-num">إيصال رقم: {receipt.receiptNumber}</div>

        <div className="row">
          <span className="label">التاريخ:</span>
          <span className="value">{date}</span>
        </div>
        <div className="row">
          <span className="label">الوقت:</span>
          <span className="value">{time}</span>
        </div>
        <div className="line-dashed"/>

        {/* Student Info */}
        <div className="row">
          <span className="label">الطالب:</span>
          <span className="value">{receipt.studentName}</span>
        </div>
        <div className="row">
          <span className="label">الكود:</span>
          <span className="value">{receipt.studentCode}</span>
        </div>
        {receipt.subjectName && (
          <div className="row">
            <span className="label">المادة:</span>
            <span className="value">{receipt.subjectName}</span>
          </div>
        )}
        {receipt.month && (
          <div className="row">
            <span className="label">الشهر:</span>
            <span className="value">{receipt.month}</span>
          </div>
        )}
        {!!receipt.discountApplied && receipt.discountApplied > 0 && (
          <div className="row">
            <span className="label">الخصم:</span>
            <span className="value">{receipt.discountApplied.toLocaleString('ar-EG')} جنيه</span>
          </div>
        )}
        <div className="line-dashed"/>

        {/* Amount */}
        <div className="amount-box">
          <div className="amount-label">المبلغ المدفوع</div>
          <div className="amount-num">{receipt.amount.toLocaleString('ar-EG')} جنيه</div>
        </div>

        {/* Payment Method */}
        <div className="row">
          <span className="label">طريقة الدفع:</span>
          <span className="value">{PAYMENT_METHOD_AR[receipt.paymentMethod] || receipt.paymentMethod}</span>
        </div>
        {receipt.notes && (
          <div className="row">
            <span className="label">ملاحظات:</span>
            <span className="value">{receipt.notes}</span>
          </div>
        )}
        <div className="line-double"/>

        {/* Footer */}
        <div className="footer">
          <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '1mm' }}>شكراً لثقتكم 🎓</div>
          {centerPhone && <div className="footer-phone">📞 {centerPhone}</div>}
          {centerPhone2 && <div className="footer-phone">📞 {centerPhone2}</div>}
        </div>

      </div>
      </div>

      {/* Modal Preview */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
          <div className="bg-[#0E3B2E] px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">إيصال #{receipt.receiptNumber}</h3>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-2 bg-gray-50 max-h-96 overflow-y-auto" dir="rtl">
            {/* Header Preview */}
            <p className="text-center font-bold text-base">{centerName}</p>
            {centerAddress && <p className="text-center text-gray-400 text-xs">{centerAddress}</p>}
            <div className="border-t-2 border-double border-gray-400 my-2"/>

            {/* Receipt num + date */}
            <p className="text-center text-gray-400 text-xs">إيصال رقم: {receipt.receiptNumber}</p>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">التاريخ:</span><span className="font-bold">{date}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">الوقت:</span><span className="font-bold">{time}</span>
            </div>
            <div className="border-t border-dashed border-gray-300 my-2"/>

            {/* Student */}
            <div className="flex justify-between text-xs"><span className="text-gray-500">الطالب:</span><span className="font-bold">{receipt.studentName}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">الكود:</span><span className="font-mono">{receipt.studentCode}</span></div>
            {receipt.subjectName && <div className="flex justify-between text-xs"><span className="text-gray-500">المادة:</span><span className="font-bold">{receipt.subjectName}</span></div>}
            {receipt.month && <div className="flex justify-between text-xs"><span className="text-gray-500">الشهر:</span><span className="font-bold">{receipt.month}</span></div>}
            {!!receipt.discountApplied && receipt.discountApplied > 0 && (
              <div className="flex justify-between text-xs"><span className="text-gray-500">الخصم:</span><span className="font-bold text-amber-600">{receipt.discountApplied.toLocaleString('ar-EG')} ج</span></div>
            )}
            <div className="border-t border-dashed border-gray-300 my-2"/>

            {/* Amount */}
            <div className="text-center border-y-2 border-gray-400 py-2 my-2">
              <p className="text-xs text-gray-500">المبلغ المدفوع</p>
              <p className="text-2xl font-bold text-[#0E3B2E]">{receipt.amount.toLocaleString('ar-EG')} ج</p>
            </div>

            <div className="flex justify-between text-xs"><span className="text-gray-500">طريقة الدفع:</span><span className="font-bold">{PAYMENT_METHOD_AR[receipt.paymentMethod] || receipt.paymentMethod}</span></div>
            {receipt.notes && <div className="flex justify-between text-xs"><span className="text-gray-500">ملاحظات:</span><span>{receipt.notes}</span></div>}
            <div className="border-t-2 border-double border-gray-400 my-2"/>

            {/* Footer */}
            <p className="text-center text-sm font-bold">شكراً لثقتكم 🎓</p>
            {centerPhone && <p className="text-center text-gray-500 text-xs font-bold">📞 {centerPhone}</p>}
            {centerPhone2 && <p className="text-center text-gray-500 text-xs font-bold">📞 {centerPhone2}</p>}
          </div>

          <div className="p-4 flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              إغلاق
            </button>
            <button onClick={handlePrint} disabled={printing}
              className="flex-1 py-2.5 bg-[#0E3B2E] text-white rounded-xl text-sm font-medium hover:bg-[#1F6B4E] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              طباعة
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

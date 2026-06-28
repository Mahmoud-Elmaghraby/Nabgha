import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/lib/api/client';

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

function useCenterSettings() {
  return useQuery({
    queryKey: ['center-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/center');
      return res.data.data as {
        centerName: string;
        centerPhone: string | null;
        centerAddress: string | null;
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function ThermalReceipt({ receipt, onClose, autoPrint = false }: ThermalReceiptProps) {
  const { data: centerSettings } = useCenterSettings();

  useEffect(() => {
    if (autoPrint && centerSettings) {
      setTimeout(() => window.print(), 400);
    }
  }, [autoPrint, centerSettings]);

  const handlePrint = () => window.print();

  const d = new Date(receipt.paidAt);
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  const centerName = centerSettings?.centerName || 'نبغة';
  const centerPhone = centerSettings?.centerPhone || '';
  const centerAddress = centerSettings?.centerAddress || '';

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #thermal-receipt-print { display: block !important; }
          @page { size: 58mm auto; margin: 0; }
        }
        #thermal-receipt-print {
          display: none;
          width: 58mm;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          direction: rtl;
          padding: 4mm 3mm;
          color: #000;
        }
        #thermal-receipt-print .c { text-align: center; }
        #thermal-receipt-print .b { font-weight: bold; }
        #thermal-receipt-print .lg { font-size: 13px; }
        #thermal-receipt-print .sm { font-size: 8px; }
        #thermal-receipt-print .div { border-top: 1px dashed #000; margin: 2mm 0; }
        #thermal-receipt-print .row { display: flex; justify-content: space-between; margin: 0.8mm 0; }
        #thermal-receipt-print .amt { font-size: 15px; font-weight: bold; text-align: center; margin: 2mm 0; }
      `}</style>

      {/* Printable Content */}
      <div id="thermal-receipt-print">
        <div className="c b lg">{centerName}</div>
        <div className="div"/>
        <div className="c b">إيصال دفع #{receipt.receiptNumber}</div>
        <div className="c sm">{date}</div>
        <div className="div"/>
        <div className="row"><span>الطالب:</span><span>{receipt.studentName}</span></div>
        <div className="row"><span>الكود:</span><span>{receipt.studentCode}</span></div>
        {receipt.subjectName && <div className="row"><span>المادة:</span><span>{receipt.subjectName}</span></div>}
        {receipt.month && <div className="row"><span>الشهر:</span><span>{receipt.month}</span></div>}
        <div className="div"/>
        <div className="amt">{receipt.amount.toLocaleString('ar-EG')} جنيه</div>
        <div className="row"><span>طريقة الدفع:</span><span>{PAYMENT_METHOD_AR[receipt.paymentMethod] || receipt.paymentMethod}</span></div>
        {receipt.treasuryName && <div className="row"><span>الخزينة:</span><span>{receipt.treasuryName}</span></div>}
        {receipt.notes && <div className="row"><span>ملاحظات:</span><span>{receipt.notes}</span></div>}
        <div className="div"/>
        <div className="c sm">شكراً لثقتكم 🎓</div>
        {centerAddress && <div className="c sm">{centerAddress}</div>}
        {centerPhone && <div className="c sm">📞 {centerPhone}</div>}
      </div>

      {/* Modal Preview */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
          {/* Header */}
          <div className="bg-[#0E3B2E] px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">إيصال #{receipt.receiptNumber}</h3>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Preview */}
          <div className="p-4 font-mono text-xs space-y-1.5 bg-gray-50 max-h-96 overflow-y-auto" dir="rtl">
            <p className="text-center font-bold text-sm">{centerName}</p>
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <p className="text-center font-bold">إيصال #{receipt.receiptNumber}</p>
            <p className="text-center text-gray-400 text-xs">{date}</p>
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <div className="flex justify-between"><span className="text-gray-500">الطالب:</span><span className="font-medium">{receipt.studentName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الكود:</span><span className="font-mono">{receipt.studentCode}</span></div>
            {receipt.subjectName && <div className="flex justify-between"><span className="text-gray-500">المادة:</span><span>{receipt.subjectName}</span></div>}
            {receipt.month && <div className="flex justify-between"><span className="text-gray-500">الشهر:</span><span>{receipt.month}</span></div>}
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <p className="text-center text-2xl font-bold text-[#0E3B2E]">{receipt.amount.toLocaleString('ar-EG')} ج</p>
            <div className="flex justify-between"><span className="text-gray-500">طريقة الدفع:</span><span>{PAYMENT_METHOD_AR[receipt.paymentMethod] || receipt.paymentMethod}</span></div>
            {receipt.treasuryName && <div className="flex justify-between"><span className="text-gray-500">الخزينة:</span><span>{receipt.treasuryName}</span></div>}
            {receipt.notes && <div className="flex justify-between"><span className="text-gray-500">ملاحظات:</span><span>{receipt.notes}</span></div>}
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <p className="text-center text-gray-400">شكراً لثقتكم 🎓</p>
            {centerAddress && <p className="text-center text-gray-400 text-xs">{centerAddress}</p>}
            {centerPhone && <p className="text-center text-gray-400 text-xs">📞 {centerPhone}</p>}
          </div>

          {/* Actions */}
          <div className="p-4 flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              إغلاق
            </button>
            <button onClick={handlePrint}
              className="flex-1 py-2.5 bg-[#0E3B2E] text-white rounded-xl text-sm font-medium hover:bg-[#1F6B4E] transition-colors flex items-center justify-center gap-2">
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

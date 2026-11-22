import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/shared/lib/api/client';
import type { StudentDto } from '../types/student.types';

interface Props {
  student: StudentDto | null;
  onClose: () => void;
}

export function StudentQrModal({ student, onClose }: Props) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!student) { setSvgContent(''); return; }
    setLoading(true);
    apiClient.get(`/students/${student.id}/qr`, { responseType: 'text' })
      .then(res => setSvgContent(res.data))
      .finally(() => setLoading(false));
  }, [student?.id]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>QR - ${student?.fullName}</title>
        <meta charset="UTF-8">
        <style>
          body { display:flex; flex-direction:column; align-items:center;
                 justify-content:center; height:100vh; font-family:sans-serif; gap:12px; }
          h2 { font-size:20px; color:#0E3B2E; margin:0; }
          .code { font-size:16px; font-weight:bold; color:#333; letter-spacing:2px; }
          .grade { font-size:13px; color:#888; }
        </style>
      </head>
      <body>
        ${svgContent}
        <h2>${student?.fullName}</h2>
        <div class="code">${student?.studentCode || student?.qrCode}</div>
        ${student?.grade ? `<div class="grade">${student.grade}</div>` : ''}
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={onClose}>
      <DialogContent
        className="max-w-xs bg-white rounded-2xl shadow-xl border-0 p-6"
        dir="rtl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-900 text-center">
            {student.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 mt-2">
          {loading ? (
            <div className="w-48 h-48 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <div
              className="w-48 h-48 border border-gray-100 rounded-lg p-2 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}

          <div className="text-center">
            <p className="text-lg font-bold text-[#0E3B2E] tracking-widest">
              {student.studentCode || student.qrCode}
            </p>
            {student.grade && (
              <p className="text-xs text-gray-400 mt-1">{student.grade}</p>
            )}
          </div>

          <div className="flex gap-2 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex-1 py-2 text-sm bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50 transition-colors"
            >
              طباعة
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from 'react';
import { apiClient } from '@/shared/lib/api/client';

interface ImageUploaderProps {
  endpoint: 'image' | 'logo' | 'card';
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  accept?: string;
  maxSizeMB?: number;
  aspectRatio?: string;
}

export function ImageUploader({
  endpoint,
  value,
  onChange,
  label,
  hint,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMB = 5,
  aspectRatio,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`حجم الملف يتجاوز ${maxSizeMB}MB`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('يُسمح فقط بالصور');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`/upload/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs text-gray-500">{label}</label>}

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${
          uploading
            ? 'border-[#0E3B2E]/30 bg-[#0E3B2E]/5'
            : 'border-gray-200 hover:border-[#0E3B2E]/40 hover:bg-gray-50'
        }`}
        style={{ aspectRatio: aspectRatio || 'auto', minHeight: '120px', maxHeight: '160px' }}
      >
        {value ? (
          <div className="relative w-full h-full min-h-[120px]">
            <img
              src={value}
              alt="uploaded"
              className="w-full h-full object-contain rounded-xl p-2"
              style={{ maxHeight: '140px' }}
            />
            <button
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ×
            </button>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-xs text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">
                اضغط لتغيير الصورة
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 min-h-[120px]">
            {uploading ? (
              <>
                <div className="w-8 h-8 border-2 border-[#0E3B2E] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-gray-400">جاري الرفع...</p>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-gray-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-sm text-gray-500 font-medium">اسحب الصورة هنا</p>
                <p className="text-xs text-gray-400 mt-1">أو اضغط للاختيار</p>
                {hint && <p className="text-xs text-gray-300 mt-1">{hint}</p>}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

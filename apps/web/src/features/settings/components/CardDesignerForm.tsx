import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { ImageUploader } from '@/shared/components/upload/ImageUploader';

interface CardDesignerSettings {
  frontImage: string;
  backImage: string;
  groupX: number;
  groupY: number;
  qrSize: number;
}

const DEFAULT: CardDesignerSettings = {
  frontImage: '',
  backImage: '',
  groupX: 5,
  groupY: 8,
  qrSize: 25,
};

const CARD_W = 85.6;
const CARD_H = 54;
const CANVAS_W = 428;
const CANVAS_H = 270;
const SCALE_X = CANVAS_W / CARD_W;
const SCALE_Y = CANVAS_H / CARD_H;

export function CardDesignerForm() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'card-designer'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/card-designer');
      return (res.data.data ?? DEFAULT) as CardDesignerSettings;
    },
  });

  const [settings, setSettings] = useState<CardDesignerSettings>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, gx: 0, gy: 0 });

  useEffect(() => { if (data) setSettings(data); }, [data]);
  useEffect(() => { drawPreview(); }, [settings, activeTab]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (activeTab !== 'front') return;
      e.preventDefault();
      setSettings(prev => ({
        ...prev,
        qrSize: Math.max(15, Math.min(40, prev.qrSize + (e.deltaY > 0 ? -1 : 1))),
      }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [activeTab]);

  const saveMutation = useMutation({
    mutationFn: async (s: CardDesignerSettings) => {
      await apiClient.put('/settings/card-designer', s);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'card-designer'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const drawGroup = (ctx: CanvasRenderingContext2D) => {
    const gx = settings.groupX * SCALE_X;
    const gy = settings.groupY * SCALE_Y;
    const qrPx = settings.qrSize * SCALE_X;
    const padding = 6;
    const nameFont = Math.round(qrPx * 0.18);
    const codeFont = Math.round(qrPx * 0.13);
    const textX = gx + qrPx + padding;
    const totalW = qrPx + padding + 90;
    const totalH = qrPx;

    // Group background
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 4, totalW + 8, totalH + 8, 6);
    ctx.fill();

    // QR box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx, gy, qrPx, qrPx);
    ctx.fillStyle = '#0E3B2E';
    ctx.font = `bold ${Math.round(qrPx * 0.22)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('QR', gx + qrPx / 2, gy + qrPx / 2 + 5);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${nameFont}px Arial`;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('أحمد محمد علي', textX + 85, gy + nameFont + 4);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textX, gy + qrPx * 0.45);
    ctx.lineTo(textX + 85, gy + qrPx * 0.45);
    ctx.stroke();

    // Code
    ctx.fillStyle = '#D4AB53';
    ctx.font = `${codeFont}px monospace`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText('STU-00001', textX, gy + qrPx * 0.45 + codeFont + 4);

    // Grade
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${codeFont}px Arial`;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('أول ابتدائي', textX + 85, gy + qrPx * 0.45 + codeFont + 4);

    // Drag handle indicator
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(gx - 4, gy - 4, totalW + 8, totalH + 8);
    ctx.setLineDash([]);
  };

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const bgImage = activeTab === 'front' ? settings.frontImage : settings.backImage;

    const draw = () => {
      if (activeTab === 'front') drawGroup(ctx);
    };

    if (bgImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        draw();
      };
      img.src = bgImage;
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.font = '13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ارفع صورة الكارت', CANVAS_W / 2, CANVAS_H / 2);
      draw();
    }
  };


  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  };

  const isInGroup = (px: number, py: number) => {
    const gx = settings.groupX * SCALE_X;
    const gy = settings.groupY * SCALE_Y;
    const qrPx = settings.qrSize * SCALE_X;
    return px >= gx - 10 && px <= gx + qrPx + 100 && py >= gy - 10 && py <= gy + qrPx + 10;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'front') return;
    const pos = getPos(e);
    if (isInGroup(pos.x, pos.y)) {
      isDragging.current = true;
      dragStart.current = { mx: pos.x, my: pos.y, gx: settings.groupX, gy: settings.groupY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const pos = getPos(e);
    const dx = (pos.x - dragStart.current.mx) / SCALE_X;
    const dy = (pos.y - dragStart.current.my) / SCALE_Y;
    setSettings(prev => ({
      ...prev,
      groupX: Math.max(0, Math.min(CARD_W - prev.qrSize - 10, Math.round(dragStart.current.gx + dx))),
      groupY: Math.max(0, Math.min(CARD_H - prev.qrSize - 5, Math.round(dragStart.current.gy + dy))),
    }));
  };

  const handleMouseUp = () => { isDragging.current = false; };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'front') return;
    e.preventDefault();
    setSettings(prev => ({
      ...prev,
      qrSize: Math.max(15, Math.min(40, prev.qrSize + (e.deltaY > 0 ? -1 : 1))),
    }));
  };

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
        <p className="font-medium mb-1">📌 تعليمات</p>
        <p className="text-xs">• اسحب المجموعة (QR + الاسم + الكود) لتحريكها</p>
        <p className="text-xs">• استخدم scroll wheel لتغيير الحجم</p>
        <p className="text-xs">• الكارت بمقاس بطاقة الرقم القومي (85.6 × 54mm)</p>
      </div>

      {/* تبويب وش/ضهر */}
      <div className="flex border border-gray-200 rounded-xl overflow-hidden">
        {(['front', 'back'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-[#0E3B2E] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {tab === 'front' ? '🪪 وش الكارت' : '🔄 ضهر الكارت'}
          </button>
        ))}
      </div>

      {/* رفع الصورة */}
      <ImageUploader
        endpoint="card"
        value={activeTab === 'front' ? settings.frontImage || null : settings.backImage || null}
        onChange={url => setSettings(prev => ({
          ...prev,
          [activeTab === 'front' ? 'frontImage' : 'backImage']: url,
        }))}
        label={activeTab === 'front' ? 'صورة وش الكارت' : 'صورة ضهر الكارت'}
        hint="PNG أو JPG — حجم أقصى 5MB"
        maxSizeMB={5}
      />

      {/* Canvas */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">
          معاينة الكارت {activeTab === 'front' ? '(اسحب المجموعة — scroll لتغيير الحجم)' : ''}
        </label>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full border border-gray-200 rounded-xl bg-gray-900 ${activeTab === 'front' ? 'cursor-move' : 'cursor-default'}`}
        />
      </div>

      {/* حفظ */}
      <button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}
        className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${
          saved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E]'
        } disabled:opacity-50`}>
        {saved ? '✓ تم حفظ إعدادات الكارت' : saveMutation.isPending ? 'جاري الحفظ...' : '💾 حفظ إعدادات الكارت'}
      </button>
    </div>
  );
}

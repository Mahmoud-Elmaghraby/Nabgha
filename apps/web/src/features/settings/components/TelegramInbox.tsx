import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/shared/lib/api/client';

// صندوق وارد تليجرام — الميزة التنافسية الجديدة: محادثة ثنائية فعلية. عكس
// الواتساب، كل رسالة هنا مربوطة باسم الطالب تلقائيًا (عن طريق chat_id) من
// غير أي مطابقة يدوية.

interface TelegramInboundDto {
  id: string;
  chatId: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  isRead: boolean;
  receivedAt: string;
}

export function TelegramInbox() {
  const [messages, setMessages] = useState<TelegramInboundDto[] | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/telegram/inbound', { params: { unreadOnly, limit: 30 } });
      setMessages(res.data.data);
    } catch {
      setError('تعذّر تحميل صندوق الوارد');
    }
  }, [unreadOnly]);

  useEffect(() => {
    load();
    // بولينج كل 15 ثانية — تليجرام قناة رسمية آمنة، مفيش داعي لأي تعقيد
    // زي الحالة اللي بتتبع بيها بلاغات الواتساب
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setMessages(prev => prev?.map(m => (m.id === id ? { ...m, isRead: true } : m)) ?? null);
    try {
      await apiClient.put(`/telegram/inbound/${id}/read`);
    } catch {
      load(); // لو فشل التحديث المتفائل، ارجع للحالة الحقيقية من السيرفر
    }
  };

  const unreadCount = messages?.filter(m => !m.isRead).length ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-[#0E3B2E] text-base">صندوق وارد تليجرام</h3>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">{unreadCount} جديد</span>
          )}
        </div>
        <button
          onClick={() => setUnreadOnly(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            unreadOnly ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          غير المقروء فقط
        </button>
      </div>

      <p className="text-xs text-gray-400">
        ردود أولياء الأمور على بوت تليجرام تظهر هنا فورًا — مربوطة باسم الطالب تلقائيًا.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {messages === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">مفيش رسايل واردة لسه</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map(m => (
            <div
              key={m.id}
              className={`p-3 rounded-lg border ${m.isRead ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {m.entityName ?? 'غير مربوط بطالب'}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(m.receivedAt).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{m.body}</p>
              {!m.isRead && (
                <button
                  onClick={() => handleMarkRead(m.id)}
                  className="text-xs text-[#0E3B2E] mt-2 hover:underline"
                >
                  تعليم كمقروءة
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

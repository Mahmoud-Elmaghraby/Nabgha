import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxApi, displayPhone, type InboxThreadItem } from '../api/inbox.api';
import { MediaView } from './MediaView';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useToast } from '@/shared/components/Toast';

const NOTIFICATION_LABELS: Record<string, string> = {
  ABSENT: 'إشعار غياب', PRESENT: 'إشعار حضور', LATE: 'إشعار تأخير', THREE_ABSENCES: 'تنبيه 3 غيابات',
  PAYMENT_CONFIRM: 'إيصال دفع', PAYMENT_DUE: 'تذكير بالدفع', PAYMENT_OVERDUE: 'تأخير في الدفع',
  NEW_STUDENT: 'تسجيل طالب', GROUP_ADDED: 'إضافة لمجموعة', GROUP_REMOVED: 'خروج من مجموعة',
  ABSENCE_EXCUSED: 'غياب معذور', GRADE_RECORDED: 'درجة', TELEGRAM_LINK: 'رابط تليجرام',
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'النهارده';
  if (d.toDateString() === yesterday.toDateString()) return 'امبارح';
  return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
};

function StatusMark({ item, onRetry }: { item: Extract<InboxThreadItem, { kind: 'message' }>; onRetry: () => void }) {
  if (item.direction !== 'out') return null;
  if (item.source === 'phone') return <span className="opacity-60">من الموبايل</span>;
  if (item.status === 'pending') return <span className="opacity-60">بيتبعت…</span>;
  if (item.status === 'failed') {
    return (
      <span className="text-red-600">
        مااتبعتتش{item.error ? ` — ${item.error}` : ''}{' '}
        <button onClick={onRetry} className="font-bold underline">إعادة</button>
      </span>
    );
  }
  return <span className="opacity-60">✓</span>;
}

/**
 * محادثة واحدة: رسايل ولي الأمر والردود (من البرنامج أو من الموبايل) والإشعارات التلقائية،
 * والرد من تحت. بتتحدّث كل 5 ثواني، وبتعلّم الرسايل مقروءة أول ما تتفتح.
 */
export function ThreadView({ phone, onBack }: { phone: string; onBack: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canReply = hasPermission('inbox.reply');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState<InboxThreadItem[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => { setOlder([]); setOlderHasMore(null); setDraft(''); stickToBottom.current = true; }, [phone]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inbox-thread', phone],
    queryFn: () => inboxApi.thread(phone),
    refetchInterval: 5_000,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...(data?.items ?? [])].filter((i) => {
      const k = `${i.kind}:${i.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [older, data]);
  const hasMore = olderHasMore ?? data?.hasMore ?? false;

  // تعليم المحادثة مقروءة أول ما تتفتح، ولما توصل رسايل جديدة وهي مفتوحة
  const lastInId = [...(data?.items ?? [])].reverse().find((i) => i.kind === 'message' && i.direction === 'in')?.id;
  useEffect(() => {
    if (!data) return;
    inboxApi.markRead(phone).then(() => {
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] });
      qc.invalidateQueries({ queryKey: ['inbox-unread'] });
    }).catch(() => undefined);
  }, [phone, lastInId, !!data]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [items.length, phone]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    const first = items[0];
    if (!first) return;
    setLoadingOlder(true);
    try {
      const page = await inboxApi.thread(phone, { before: first.at });
      stickToBottom.current = false;
      setOlder((prev) => [...page.items, ...prev]);
      setOlderHasMore(page.hasMore);
    } catch {
      toast.error('تعذّر تحميل الرسايل الأقدم');
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const item = await inboxApi.reply(phone, body);
      setDraft('');
      stickToBottom.current = true;
      qc.setQueryData(['inbox-thread', phone], (prev: typeof data) => prev ? { ...prev, items: [...prev.items, item] } : prev);
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'الرسالة مااتبعتتش');
    } finally {
      setSending(false);
    }
  };

  const retry = async (id: string) => {
    try {
      await inboxApi.retry(id);
      qc.invalidateQueries({ queryKey: ['inbox-thread', phone] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'تعذّرت إعادة الإرسال');
    }
  };

  const students = data?.students ?? [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F4F5F8]">
      {/* ── الهيدر ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="md:hidden p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="رجوع">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold shrink-0">
          {students[0]?.fullName.charAt(0) ?? '؟'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate">
            {students.length ? students.map((s) => s.fullName).join('، ') : 'رقم مش متسجّل لطالب'}
          </p>
          <p className="text-xs text-gray-400 flex flex-wrap items-center gap-x-2">
            <span dir="ltr" className="font-mono">{displayPhone(phone)}</span>
            {students.length > 0 && <span>{students[0].relation === 'parent' ? 'ولي أمر' : 'الطالب نفسه'}{students.length > 1 ? ` (${students.length} إخوات)` : ''}</span>}
          </p>
        </div>
        {students.length > 0 && (
          <div className="hidden sm:flex gap-1.5 shrink-0">
            {students.slice(0, 3).map((s) => (
              <Link key={s.id} to={`/students/${s.id}`} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 truncate max-w-[120px]" title={`ملف ${s.fullName}`}>
                ملف {s.fullName.split(' ')[0]}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── الرسايل ── */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 py-4 space-y-2">
        {isLoading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className={`h-12 w-2/3 rounded-2xl bg-white animate-pulse ${i % 2 ? '' : 'mr-auto'}`} />)}</div>}
        {isError && <p className="text-center text-sm text-red-600 py-6">تعذّر تحميل المحادثة</p>}
        {hasMore && (
          <div className="text-center">
            <button onClick={loadOlder} disabled={loadingOlder} className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 disabled:opacity-50">
              {loadingOlder ? 'جاري التحميل…' : 'رسايل أقدم'}
            </button>
          </div>
        )}
        {items.map((item, idx) => {
          const prev = items[idx - 1];
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(item.at).toDateString();
          return (
            <div key={`${item.kind}:${item.id}`}>
              {newDay && (
                <div className="text-center my-3">
                  <span className="text-[11px] px-3 py-1 rounded-full bg-white text-gray-500 shadow-sm">{dayLabel(item.at)}</span>
                </div>
              )}
              {item.kind === 'notification' ? (
                <div className="flex justify-center">
                  <div className="max-w-[85%] md:max-w-[70%] rounded-xl bg-[#FFF8E6] border border-[#F2E2B5] px-3 py-2 text-xs text-gray-700">
                    <p className="font-bold text-[#8A6A1F] mb-0.5">
                      🔔 {NOTIFICATION_LABELS[item.templateKey ?? ''] ?? 'رسالة من البرنامج'}
                      <span className="font-normal text-gray-400 mr-2">{time(item.at)}</span>
                      {item.status === 'failed' && <span className="text-red-600 font-normal mr-1">(مااتبعتتش)</span>}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  </div>
                </div>
              ) : (
                <div className={`flex ${item.direction === 'in' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm ${
                    item.direction === 'in'
                      ? 'bg-white text-gray-900 rounded-tr-sm'
                      : item.status === 'failed' ? 'bg-red-50 text-gray-900 border border-red-200 rounded-tl-sm' : 'bg-[#DCF3E5] text-gray-900 rounded-tl-sm'
                  }`}>
                    {item.media && <div className="mb-1"><MediaView messageId={item.id} media={item.media} /></div>}
                    {item.body && <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>}
                    <p className="text-[10px] mt-1 flex flex-wrap gap-x-2 justify-end text-gray-500">
                      <StatusMark item={item} onRetry={() => retry(item.id)} />
                      <span>{time(item.at)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && items.length === 0 && <p className="text-center text-sm text-gray-400 py-8">مفيش رسايل</p>}
      </div>

      {/* ── الرد ── */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2">
        {data && !data.connected && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-2">
            الواتساب مش متصل — الرد هيتسجّل بس مش هيتبعت. <Link to="/whatsapp" className="font-bold underline">وصّل الواتساب</Link>
          </p>
        )}
        {canReply ? (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              }}
              rows={Math.min(5, Math.max(1, draft.split('\n').length))}
              maxLength={4000}
              placeholder="اكتب ردك…"
              title="Enter للإرسال، Shift+Enter لسطر جديد"
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#0E3B2E] max-h-32"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="shrink-0 h-10 px-4 rounded-xl bg-[#0E3B2E] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#1F6B4E]"
            >
              {sending ? '…' : 'إرسال'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">مش عندك صلاحية الرد على أولياء الأمور</p>
        )}
      </div>
    </div>
  );
}

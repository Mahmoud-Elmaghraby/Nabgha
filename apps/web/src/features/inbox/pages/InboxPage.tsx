import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inboxApi, displayPhone, type InboxConversation } from '../api/inbox.api';
import { ThreadView } from '../components/ThreadView';

function shortTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 7) return d.toLocaleDateString('ar-EG', { weekday: 'short' });
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });
}

function ConversationRow({ c, active, onClick }: { c: InboxConversation; active: boolean; onClick: () => void }) {
  const title = c.students.length ? c.students.map((s) => s.fullName.split(' ').slice(0, 2).join(' ')).join('، ') : displayPhone(c.phone);
  return (
    <button
      onClick={onClick}
      className={`w-full text-right flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${active ? 'bg-[#0E3B2E]/5' : 'hover:bg-gray-50'}`}
    >
      <div className="w-11 h-11 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold shrink-0">
        {c.students[0]?.fullName.charAt(0) ?? '؟'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${c.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{title}</p>
          <span className={`text-[11px] shrink-0 ${c.unread ? 'text-[#1F6B4E] font-bold' : 'text-gray-400'}`}>{shortTime(c.lastAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`truncate text-xs ${c.unread ? 'text-gray-700' : 'text-gray-400'}`}>
            {c.lastDirection === 'out' && <span className="text-gray-400">إنت: </span>}
            {c.lastPreview}
          </p>
          {c.unread > 0 && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#1F6B4E] text-white text-[11px] font-bold flex items-center justify-center">
              {c.unread.toLocaleString('ar-EG')}
            </span>
          )}
        </div>
        {c.students.length === 0 && <p className="text-[11px] text-amber-600 mt-0.5">رقم مش متسجّل لأي طالب</p>}
      </div>
    </button>
  );
}

/**
 * المحادثات (WA-110): رسايل أولياء الأمور على واتساب، والرد عليها من البرنامج.
 * على الكمبيوتر: القايمة والمحادثة جنب بعض. على الموبايل: القايمة، ولما تختار محادثة بتفتح لوحدها.
 */
export default function InboxPage() {
  const { phone } = useParams<{ phone?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inbox-conversations', search.trim(), unreadOnly],
    queryFn: () => inboxApi.conversations({ search: search.trim() || undefined, unreadOnly, limit: 200 }),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });
  const conversations = data?.data ?? [];

  return (
    <div className="h-[calc(100dvh-64px)] md:h-[calc(100dvh-72px)] flex bg-white md:border-t md:border-gray-100" dir="rtl">
      {/* ── القايمة ── */}
      <aside className={`${phone ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] shrink-0 flex-col border-l border-gray-100 min-h-0`}>
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-[#0E3B2E]">المحادثات</h1>
            {data && !data.connected && (
              <button onClick={() => navigate('/whatsapp')} className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                الواتساب مش متصل
              </button>
            )}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="دوّر باسم الطالب أو الكود أو الرقم"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:border-[#0E3B2E] focus:bg-white"
          />
          <div className="flex gap-2">
            {[{ v: false, l: 'الكل' }, { v: true, l: 'غير المقروء' }].map((f) => (
              <button
                key={f.l}
                onClick={() => setUnreadOnly(f.v)}
                className={`text-xs px-3 py-1.5 rounded-full border ${unreadOnly === f.v ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && <div className="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-50 animate-pulse" />)}</div>}
          {isError && <p className="p-6 text-center text-sm text-red-600">تعذّر تحميل المحادثات</p>}
          {!isLoading && !isError && conversations.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400 space-y-2">
              <p className="text-3xl">💬</p>
              <p>{search || unreadOnly ? 'مفيش محادثات بالبحث ده' : 'لسه مفيش رسايل من أولياء الأمور'}</p>
              {!search && !unreadOnly && <p className="text-xs">أي رسالة ولي أمر يبعتها على رقم واتساب المركز هتظهر هنا، صوت وصور كمان.</p>}
            </div>
          )}
          {conversations.map((c) => (
            <ConversationRow key={c.phone} c={c} active={c.phone === phone} onClick={() => navigate(`/inbox/${c.phone}`)} />
          ))}
        </div>
      </aside>

      {/* ── المحادثة ── */}
      <section className={`${phone ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 min-h-0 flex-col`}>
        {phone ? (
          <ThreadView key={phone} phone={phone} onBack={() => navigate('/inbox')} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#F4F5F8] text-center p-8">
            <div className="space-y-2 text-gray-400">
              <p className="text-4xl">💬</p>
              <p className="text-sm">اختار محادثة من القايمة</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

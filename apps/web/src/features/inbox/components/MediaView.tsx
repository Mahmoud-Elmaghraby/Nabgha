import { useEffect, useState } from 'react';
import { inboxApi, type InboxMedia } from '../api/inbox.api';

const LABELS: Record<string, string> = {
  audio: 'رسالة صوتية', image: 'صورة', video: 'فيديو', document: 'ملف', sticker: 'ملصق',
};

function formatSeconds(s: number | null): string {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * فويس نوت / صورة / فيديو / ملف من ولي الأمر. الملف بيتحمّل بالتوكن من /inbox/messages/:id/media
 * (مش رابط عام) وبيتعرض من object URL. الصور والصوت بيتحمّلوا على طول، الفيديو والملفات لما تدوس.
 */
export function MediaView({ messageId, media }: { messageId: string; media: InboxMedia }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState(media.type === 'audio' || media.type === 'image' || media.type === 'sticker');

  useEffect(() => {
    if (!requested || media.status !== 'stored') return;
    let objectUrl: string | null = null;
    let cancelled = false;
    inboxApi.media(messageId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, requested, media.status]);

  const label = LABELS[media.type] ?? 'رسالة';

  if (media.status === 'unsupported') {
    return <p className="text-xs italic opacity-70">نوع رسالة مش مدعوم في البرنامج (موقع أو جهة اتصال مثلاً) — افتحها من الموبايل</p>;
  }
  if (media.status === 'too_large') {
    return <p className="text-xs italic opacity-70">📎 {label} حجمه كبير — افتحه من الموبايل</p>;
  }
  if (media.status !== 'stored' || error) {
    return <p className="text-xs italic opacity-70">📎 {label} — ماقدرناش نحمّله، افتحه من الموبايل</p>;
  }

  if (!requested) {
    return (
      <button onClick={() => setRequested(true)} className="text-xs font-bold underline underline-offset-2">
        {media.type === 'video' ? '🎬' : '📄'} عرض ال{label}
      </button>
    );
  }
  if (!url) return <div className="h-10 w-48 max-w-full rounded-lg bg-black/5 animate-pulse" />;

  switch (media.type) {
    case 'audio':
      return (
        <div className="flex items-center gap-2">
          <audio controls preload="metadata" src={url} className="h-10 w-56 max-w-full" />
          {media.seconds ? <span className="text-[11px] opacity-60 shrink-0">{formatSeconds(media.seconds)}</span> : null}
        </div>
      );
    case 'image':
    case 'sticker':
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className={`rounded-lg object-cover ${media.type === 'sticker' ? 'w-28 h-28' : 'max-h-64 max-w-full'}`} />
        </a>
      );
    case 'video':
      return <video controls src={url} className="rounded-lg max-h-64 max-w-full" />;
    default:
      return (
        <a href={url} download className="text-xs font-bold underline underline-offset-2">📄 تحميل الملف</a>
      );
  }
}

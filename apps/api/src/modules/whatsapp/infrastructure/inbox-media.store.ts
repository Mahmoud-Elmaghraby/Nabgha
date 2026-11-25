import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const EXT_BY_MIME: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'application/pdf': 'pdf',
};

/**
 * ملفات صندوق الوارد (فويس نوت، صور، فيديو، ملفات من أولياء الأمور) — WA-110.
 * بتتحفظ في فولدر **خاص** مش جوّه /storage العام (اللي بيتقري من غير تسجيل دخول)،
 * وبتتقري بس من GET /inbox/messages/:id/media بعد الصلاحيات.
 * المكان: INBOX_MEDIA_PATH أو %APPDATA%\Nabgha\inbox-media (والنسخ الاحتياطي بياخده).
 */
@Injectable()
export class InboxMediaStore {
  getBaseDir(): string {
    return process.env.INBOX_MEDIA_PATH
      ?? path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'inbox-media');
  }

  /** بيرجّع مسار نسبي (YYYY-MM/uuid.ext) بيتخزن في wa_chat_messages.media_path */
  save(buffer: Buffer, mime: string, fileName?: string): string {
    const base = mime.split(';')[0].trim().toLowerCase();
    const fromName = fileName?.includes('.') ? fileName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : '';
    const ext = EXT_BY_MIME[base] ?? (fromName || 'bin');
    const month = new Date().toISOString().slice(0, 7);
    const rel = `${month}/${randomUUID()}.${ext}`;
    const full = path.join(this.getBaseDir(), rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buffer);
    return rel;
  }

  /** المسار الكامل لملف — مع حماية من path traversal. null لو مش موجود */
  resolve(relPath: string): string | null {
    if (!/^\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(relPath)) return null;
    const full = path.join(this.getBaseDir(), relPath);
    return fs.existsSync(full) ? full : null;
  }
}

import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { testPool } from './support/db';
import { WaChatRepository } from '../../src/modules/whatsapp/infrastructure/wa-chat.repository';
import { InboxMediaStore } from '../../src/modules/whatsapp/infrastructure/inbox-media.store';
import { InboxUseCase, MAX_INBOX_MEDIA_BYTES } from '../../src/modules/whatsapp/application/use-cases/inbox.usecase';
import type { WaIncomingMessage } from '../../src/modules/whatsapp/domain/interfaces/wa-provider.interface';
import { BaileysProvider } from '../../src/modules/whatsapp/infrastructure/baileys.provider';

// صندوق وارد الواتساب (WA-110) على Postgres حقيقي (migration 029).
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x: any = '') => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, x); } };
const errCode = async (p: Promise<any>) => { try { await p; return 'NO_ERROR'; } catch (e: any) { return `${e.code}/${e.statusCode}`; } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pool = testPool();
const base = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });
const db = base.withSchema('tenant_t');
const fakeKysely: any = { getTenantDb: () => db, getTenantSchema: () => 'tenant_t' };

/** provider وهمي: بيسجّل الرسايل اللي اتبعتت، وممكن نخليه يفشل */
const sent: Array<{ phone: string; body: string; priority?: boolean }> = [];
let providerMode: 'ok' | 'not_connected' = 'ok';
const provider: any = {
  getConnectionState: async () => ({ status: providerMode === 'ok' ? 'connected' : 'disconnected' }),
  sendMessage: async (_t: string, phone: string, body: string, opts?: { priority?: boolean }) => {
    if (providerMode !== 'ok') return { success: false, error: 'not_connected' };
    sent.push({ phone, body, priority: opts?.priority });
    return { success: true, messageId: `OUT-${sent.length}` };
  },
};

const incoming = (o: Partial<WaIncomingMessage>): WaIncomingMessage => ({
  phone: '201012345678', fromMe: false, messageId: null, timestamp: new Date(), body: '', ...o,
});

(async () => {
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabgha-inbox-'));
  process.env.INBOX_MEDIA_PATH = mediaDir;
  const repo = new WaChatRepository(fakeKysely);
  const store = new InboxMediaStore();
  const uc = new InboxUseCase(repo, store, provider);

  await db.deleteFrom('wa_chat_messages').execute();
  await db.deleteFrom('wa_messages_log').execute();
  await sql`DELETE FROM tenant_t.students WHERE qr_code LIKE 'INBOX-%'`.execute(base);
  // أخين بنفس رقم ولي الأمر (مخزّن 010…)، وطالب رقمه هو اللي بيبعت
  await db.insertInto('students').values([
    { full_name: 'أحمد محمد علي', parent_phone: '01012345678', qr_code: 'INBOX-1', student_code: 'STU-90001', is_active: true },
    { full_name: 'عمر محمد علي', parent_phone: '+201012345678', qr_code: 'INBOX-2', student_code: 'STU-90002', is_active: true },
    { full_name: 'مريم خالد', parent_phone: '01100000000', student_phone: '01112223334', qr_code: 'INBOX-3', student_code: 'STU-90003', is_active: true },
  ]).execute();

  console.log('— migration 029');
  const cols = await sql<{ column_name: string }>`SELECT column_name FROM information_schema.columns WHERE table_schema='tenant_t' AND table_name='wa_chat_messages'`.execute(base);
  check('جدول wa_chat_messages موجود بكل الأعمدة', ['phone', 'direction', 'source', 'media_path', 'wa_message_id', 'is_read'].every((c) => cols.rows.some((r) => r.column_name === c)));
  check('قيد direction شغال', (await errCode(db.insertInto('wa_chat_messages').values({ phone: '1', direction: 'x', source: 'parent' }).execute())) !== 'NO_ERROR');

  console.log('— الوارد');
  const t0 = new Date(Date.now() - 60 * 60_000);
  const r1 = await uc.recordIncoming('t', incoming({ body: 'السلام عليكم، أحمد تعبان النهارده', messageId: 'IN-1', timestamp: t0 }));
  check('رسالة نصية اتسجلت وارد ومش مقروءة', r1?.direction === 'in' && r1?.source === 'parent' && r1?.is_read === false);
  const dup = await uc.recordIncoming('t', incoming({ body: 'السلام عليكم، أحمد تعبان النهارده', messageId: 'IN-1', timestamp: t0 }));
  check('نفس الرسالة مرتين (نفس wa_message_id) → مرة واحدة', dup === null);

  const voice = Buffer.from('OggS-fake-voice-note');
  const r2 = await uc.recordIncoming('t', incoming({
    messageId: 'IN-2', timestamp: new Date(t0.getTime() + 60_000),
    media: { type: 'audio', mime: 'audio/ogg; codecs=opus', seconds: 7, size: voice.length, download: async () => voice },
  }));
  check('فويس نوت اتسجّل واتحفظ', r2?.media_type === 'audio' && r2?.media_status === 'stored' && !!r2?.media_path);
  const media = await uc.getMedia('t', r2!.id);
  check('الملف بيتقري من المكان الخاص بالنوع الصح', fs.readFileSync(media.path).equals(voice) && media.mime === 'audio/ogg' && media.path.startsWith(mediaDir));

  let downloaded = false;
  const r3 = await uc.recordIncoming('t', incoming({
    messageId: 'IN-3', body: 'فيديو',
    media: { type: 'video', mime: 'video/mp4', size: MAX_INBOX_MEDIA_BYTES + 1, download: async () => { downloaded = true; return Buffer.alloc(1); } },
  }));
  check('فيديو كبير → too_large ومن غير تحميل', r3?.media_status === 'too_large' && !downloaded);
  const r4 = await uc.recordIncoming('t', incoming({
    messageId: 'IN-4', media: { type: 'image', mime: 'image/jpeg', download: async () => { throw new Error('expired'); } },
  }));
  check('فشل تحميل صورة → الرسالة بتتسجّل بـ failed', r4?.media_status === 'failed');
  const r5 = await uc.recordIncoming('t', incoming({ messageId: 'IN-5', unsupportedType: 'locationMessage' }));
  check('نوع مش مدعوم (موقع) → بيتسجّل إن فيه رسالة', r5?.media_type === 'unsupported');
  check('رسالة فاضية خالص → مابتتسجّلش', (await uc.recordIncoming('t', incoming({ messageId: 'IN-6' }))) === null);

  const r6 = await uc.recordIncoming('t', incoming({ phone: '201112223334', body: 'هو الامتحان امتى؟', messageId: 'IN-7' }));
  check('رقم الطالب نفسه', r6?.phone === '201112223334');
  const r7 = await uc.recordIncoming('t', incoming({ phone: '201555555555', body: 'عايز أحجز', messageId: 'IN-8' }));
  check('رقم مش متسجّل لطالب بيتسجّل برضه', !!r7);

  console.log('— رد المدرس من الموبايل');
  const r8 = await uc.recordIncoming('t', incoming({ fromMe: true, body: 'ألف سلامة عليه', messageId: 'PH-1', timestamp: new Date(t0.getTime() + 120_000) }));
  check('بيتسجّل out من الموبايل ومقروء', r8?.direction === 'out' && r8?.source === 'phone' && r8?.is_read === true);

  console.log('— المحادثات');
  let list = await uc.listConversations('t', {});
  const c1 = list.data.find((c) => c.phone === '201012345678');
  check('3 محادثات', list.total === 3, list.total);
  check('الإخوات بنفس الرقم ظاهرين الاتنين (WA-112)', c1?.students.length === 2 && c1.students.every((s) => s.relation === 'parent'), c1?.students);
  check('عدد غير المقروء بيعدّ الوارد بس', c1?.unread === 5, c1?.unread);
  check('رقم الطالب نفسه بيتعرف إنه الطالب', list.data.find((c) => c.phone === '201112223334')?.students[0]?.relation === 'student');
  check('الرقم الغريب من غير طلاب', list.data.find((c) => c.phone === '201555555555')?.students.length === 0);
  check('البحث باسم الطالب', (await uc.listConversations('t', { search: 'عمر' })).data.map((c) => c.phone).join() === '201012345678');
  check('البحث بالرقم بصيغة 011…', (await uc.listConversations('t', { search: '01112' })).data.map((c) => c.phone).join() === '201112223334');
  check('البحث بالكود', (await uc.listConversations('t', { search: 'stu-90003' })).total === 1);
  check('الإجمالي غير المقروء', JSON.stringify(await uc.unreadCount('t')) === JSON.stringify({ messages: 7, conversations: 3 }), await uc.unreadCount('t'));

  console.log('— المحادثة + الإشعارات');
  await db.insertInto('wa_messages_log').values({ tenant_id: '00000000-0000-0000-0000-000000000000', phone: '01012345678', template_key: 'ABSENT', body: 'غياب أحمد', status: 'sent', sent_at: new Date(t0.getTime() - 60_000) }).execute();
  await db.insertInto('wa_messages_log').values({ tenant_id: '00000000-0000-0000-0000-000000000000', phone: '01999999999', template_key: 'ABSENT', body: 'رقم تاني', status: 'sent' }).execute();
  const th = await uc.getThread('t', '01012345678', {});
  check('المحادثة بأي صيغة رقم', th.phone === '201012345678' && th.students.length === 2);
  check('فيها إشعار الغياب (متخزن 010…) ومش فيها إشعارات أرقام تانية', th.items.filter((i) => i.kind === 'notification').length === 1);
  check('مترتبة من الأقدم: الإشعار، الرسالة، الفويس، الرد', th.items.slice(0, 4).map((i) => i.kind === 'notification' ? 'n' : (i as any).media?.type ?? (i as any).source).join(',') === 'n,parent,audio,phone', th.items.map((i) => i.kind));

  const page1 = await uc.getThread('t', '201012345678', { limit: 2 });
  check('الصفحات: أحدث رسالتين + فيه أقدم', page1.items.filter((i) => i.kind === 'message').length === 2 && page1.hasMore);
  const oldest = page1.items.find((i) => i.kind === 'message')!;
  const page2 = await uc.getThread('t', '201012345678', { limit: 50, before: oldest.at });
  check('الصفحة اللي قبلها فيها الباقي', page2.items.filter((i) => i.kind === 'message').length === 4 && !page2.hasMore, page2.items.length);

  check('تعليم مقروء', (await uc.markRead('t', '201012345678')).updated === 5);
  list = await uc.listConversations('t', { unreadOnly: true });
  check('غير المقروء بس → المحادثتين التانيين', list.total === 2);

  console.log('— الرد من البرنامج');
  check('رد فاضي مرفوض', (await errCode(uc.reply('t', null, '201012345678', '   '))) === 'VALIDATION_ERROR/400');
  check('رقم غلط مرفوض', (await errCode(uc.reply('t', null, 'abc', 'x'))) === 'VALIDATION_ERROR/400');
  const reply = await uc.reply('t', '11111111-1111-1111-1111-111111111111', '01012345678', '  يقدر يعوّض السبت  ');
  check('الرد بيرجع pending على طول', reply.kind === 'message' && reply.status === 'pending' && reply.body === 'يقدر يعوّض السبت');
  await wait(50);
  let row = await repo.findById('t', reply.id);
  check('اتبعت بأولوية وبقى sent ومعاه معرّف واتساب', row?.status === 'sent' && row?.wa_message_id === 'OUT-1' && sent[0]?.priority === true && sent[0]?.phone === '201012345678', row);
  check('صدى نفس الرسالة من واتساب (fromMe) مابيتكررش', (await uc.recordIncoming('t', incoming({ fromMe: true, body: 'يقدر يعوّض السبت', messageId: 'OUT-1' }))) === null);

  providerMode = 'not_connected';
  const failed = await uc.reply('t', null, '201012345678', 'رد والواتساب مقطوع');
  await wait(50);
  row = await repo.findById('t', failed.id);
  check('الواتساب مقطوع → failed برسالة مفهومة', row?.status === 'failed' && /مش متصل/.test(row?.error_message ?? ''), row?.error_message);
  check('إعادة رسالة مش فاشلة مرفوضة', (await errCode(uc.retry('t', reply.id))) === 'INVALID_STATE/409');
  providerMode = 'ok';
  const retried = await uc.retry('t', failed.id);
  await wait(50);
  row = await repo.findById('t', failed.id);
  check('إعادة الإرسال → sent', retried.status === 'pending' && row?.status === 'sent');

  console.log('— قراية رسايل واتساب (BaileysProvider.toIncoming) بأشكالها الحقيقية');
  const ctx: any = { recentlySentIds: new Map([['ECHO-1', Date.now()]]), logger: { warn() {} } };
  const parse = (m: any) => (BaileysProvider.prototype as any).toIncoming.call(ctx, { updateMediaMessage: async () => ({}) }, m);
  const jid = '201012345678@s.whatsapp.net';
  const long = (n: number) => ({ toNumber: () => n });
  let p = parse({ key: { remoteJid: jid, id: 'A' }, messageTimestamp: long(1764000000), message: { conversation: 'أهلاً' } });
  check('نص عادي + الوقت من messageTimestamp', p?.body === 'أهلاً' && p.phone === '201012345678' && !p.fromMe && p.timestamp.getTime() === 1764000000000);
  p = parse({ key: { remoteJid: jid, id: 'B' }, message: { extendedTextMessage: { text: 'رد على رسالة' } } });
  check('extendedTextMessage (رد/لينك)', p?.body === 'رد على رسالة');
  p = parse({ key: { remoteJid: jid, id: 'C' }, message: { ephemeralMessage: { message: { conversation: 'رسالة مختفية' } } } });
  check('الرسايل المختفية (ephemeral) بتتفك', p?.body === 'رسالة مختفية');
  p = parse({ key: { remoteJid: jid, id: 'D' }, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 12, ptt: true, fileLength: long(20480) } } });
  check('فويس نوت: النوع والمدة والحجم', p?.media?.type === 'audio' && p.media.seconds === 12 && p.media.size === 20480 && typeof p.media.download === 'function');
  p = parse({ key: { remoteJid: jid, id: 'E' }, message: { imageMessage: { mimetype: 'image/jpeg', caption: 'الروشتة' } } });
  check('صورة بكابشن', p?.media?.type === 'image' && p.body === 'الروشتة');
  p = parse({ key: { remoteJid: '1234@lid', remoteJidAlt: jid, id: 'F' }, message: { conversation: 'من @lid' } });
  check('@lid → الرقم الحقيقي من remoteJidAlt', p?.phone === '201012345678');
  check('جروب مابيتسجّلش', parse({ key: { remoteJid: '120363@g.us', participant: jid, id: 'G' }, message: { conversation: 'x' } }) === null);
  check('حالة واتساب مابتتسجّلش', parse({ key: { remoteJid: 'status@broadcast', id: 'H' }, message: { conversation: 'x' } }) === null);
  check('تفاعل (reaction) مابيتسجّلش', parse({ key: { remoteJid: jid, id: 'I' }, message: { reactionMessage: { text: '👍' } } }) === null);
  check('حذف رسالة (protocolMessage) مابيتسجّلش', parse({ key: { remoteJid: jid, id: 'J' }, message: { protocolMessage: { type: 0 } } }) === null);
  p = parse({ key: { remoteJid: jid, id: 'K' }, message: { locationMessage: { degreesLatitude: 30 } } });
  check('موقع → unsupported', p?.unsupportedType === 'locationMessage');
  p = parse({ key: { remoteJid: jid, id: 'L', fromMe: true }, message: { conversation: 'رد من الموبايل' } });
  check('رد المركز من الموبايل → fromMe', p?.fromMe === true && p.body === 'رد من الموبايل');
  check('صدى رسالة البرنامج نفسه مابيتسجّلش', parse({ key: { remoteJid: jid, id: 'ECHO-1', fromMe: true }, message: { conversation: 'x' } }) === null);

  console.log('— الأمان');
  await db.updateTable('wa_chat_messages').set({ media_path: '../../etc/passwd' }).where('id', '=', r5!.id).execute();
  check('مسار ملف فيه ../ مايتقريش', (await errCode(uc.getMedia('t', r5!.id))) === 'NOT_FOUND/404');
  check('رسالة من غير ملف → 404', (await errCode(uc.getMedia('t', r1!.id))) === 'NOT_FOUND/404');

  fs.rmSync(mediaDir, { recursive: true, force: true });
  await sql`DELETE FROM tenant_t.students WHERE qr_code LIKE 'INBOX-%'`.execute(base);
  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });

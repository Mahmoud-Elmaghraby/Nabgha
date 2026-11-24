import 'reflect-metadata';
import { BaileysProvider } from '../../src/modules/whatsapp/infrastructure/baileys.provider';
import { normalizePhone, phoneVariants } from '../../src/shared/utils/phone.util';
import { WaSessionEntity } from '../../src/modules/whatsapp/domain/entities/wa-session.entity';

(async () => {
  let ok = 0, bad = 0;
  const check = (n: string, c: boolean, x = '') => { c ? ok++ : bad++; console.log(c ? '✅' : '❌', n, x); };

  check('01012345678', normalizePhone('01012345678') === '201012345678');
  check('+20 101 234 5678', normalizePhone('+20 101 234 5678') === '201012345678');
  check('00201012345678', normalizePhone('00201012345678') === '201012345678');
  check('1012345678 (من غير صفر)', normalizePhone('1012345678') === '201012345678');
  check('رقم سعودي 966...', normalizePhone('+966501234567') === '966501234567');
  check('variants فيها الصيغة المحلية', phoneVariants('201012345678').includes('01012345678'));

  const s = new WaSessionEntity('1','t','201',"connected",null,null,null,new Date(Date.now()-20*864e5),20,false,null,null,new Date(),new Date());
  check('بعد التسخين الحد = اللي المستخدم اختاره (150)', s.getCurrentDailyLimit(150) === 150);
  const s2 = new WaSessionEntity('1','t','201',"connected",null,null,null,new Date(Date.now()-1*864e5),1,false,null,null,new Date(),new Date());
  check('أثناء التسخين الحد صغير (يوم 1 = 10)', s2.getCurrentDailyLimit(150) === 10);

  const sentAt: number[] = [];
  const fakeSock: any = {
    onWhatsApp: async (n: string) => [{ exists: !n.endsWith('999'), jid: n + '@s.whatsapp.net' }],
    sendPresenceUpdate: async () => {},
    sendMessage: async () => { sentAt.push(Date.now()); return { key: { id: 'x' } }; },
  };
  const redis: any = { set: async () => {}, setex: async () => {}, get: async () => null };
  const settingsRepo: any = { findByTenantId: async () => ({ delayMinSeconds: 0.4, delayMaxSeconds: 0.5 }) };
  const p = new BaileysProvider(redis, settingsRepo);
  (p as any).simulateHumanTyping = async () => {};
  (p as any).sockets.set('t', fakeSock);

  const t0 = Date.now();
  const results = await Promise.all([1,2,3,4].map(i => p.sendMessage('t', `0101234560${i}`, 'hi')));
  const gaps = sentAt.slice(1).map((v, i) => v - sentAt[i]);
  check('4 رسايل اتنادوا مع بعض → اتبعتوا ورا بعض بفاصل ≥ 400ms', results.every(r => r.success) && gaps.every(g => g >= 390), JSON.stringify(gaps));
  check('أول رسالة بتطلع على طول', sentAt[0] - t0 < 200, String(sentAt[0] - t0));

  const r = await p.sendMessage('t', '01012345999', 'hi');
  check('رقم مش على واتساب → phone_not_on_whatsapp', r.error === 'phone_not_on_whatsapp');
  check('ومش بيتحسب على الـ circuit breaker', (p as any).getCircuit('t').consecutiveFailures === 0);

  const before = sentAt.length;
  const t1 = Date.now();
  const pr = await p.sendMessage('t', '01012345601', 'otp', { priority: true });
  check('رسالة عاجلة (كود دخول) مابتستناش الفاصل', pr.success && Date.now() - t1 < 300 && sentAt.length === before + 1, String(Date.now() - t1));

  check('مفيش إعادة اتصال متجدولة', p.isReconnecting('t') === false);
  console.log(`\n${ok} نجح، ${bad} فشل`); process.exit(bad ? 1 : 0);
})();

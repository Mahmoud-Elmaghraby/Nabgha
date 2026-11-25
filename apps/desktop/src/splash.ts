/**
 * شاشة التحميل بتاعة نسخة الديسكتوب: اللوجو + الاسم + شريط تقدّم + حالة التشغيل.
 * HTML ثابت بيتحمّل كـ data URL (مفيش سيرفر لسه)، واللوجو جاي data URI من assets/splash-mark.png.
 * الحالة بتتغيّر من main.ts بـ window.setStatus(text, step) و window.setError(text).
 */
export const SPLASH_WIDTH = 520;
export const SPLASH_HEIGHT = 360;

export function buildSplashHtml(markDataUri: string, version: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; user-select: none; -webkit-app-region: drag; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #fff;
    background: radial-gradient(120% 90% at 50% 35%, #15513F 0%, #0E3B2E 55%, #082A20 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 1px solid rgba(212,171,83,0.25);
  }
  .glow { position: absolute; top: 34px; width: 220px; height: 220px; border-radius: 50%;
    background: radial-gradient(circle, rgba(212,171,83,0.28) 0%, rgba(212,171,83,0) 65%); filter: blur(4px);
    animation: breathe 2.8s ease-in-out infinite; }
  .mark { position: relative; height: 120px; width: auto; filter: drop-shadow(0 6px 18px rgba(0,0,0,0.45));
    animation: rise .7s cubic-bezier(.2,.8,.2,1) both; }
  h1 { position: relative; margin-top: 14px; font-size: 40px; font-weight: 800; letter-spacing: 1px;
    animation: rise .7s .08s cubic-bezier(.2,.8,.2,1) both; }
  .tag { margin-top: 4px; font-size: 13px; font-weight: 600; color: #D4AB53; display: flex; align-items: center; gap: 10px;
    animation: rise .7s .16s cubic-bezier(.2,.8,.2,1) both; }
  .tag::before, .tag::after { content: ''; width: 26px; height: 1px; background: currentColor; opacity: .6; }
  .bar { position: relative; margin-top: 30px; width: 220px; height: 4px; border-radius: 4px;
    background: rgba(255,255,255,0.12); overflow: hidden; }
  .fill { position: absolute; inset: 0 0 0 auto; width: 8%; border-radius: 4px;
    background: linear-gradient(90deg, #B8902F, #E6C46E); transition: width .6s ease; }
  .fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
    animation: shimmer 1.4s linear infinite; }
  .status { margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.65); min-height: 16px; }
  .version { position: absolute; bottom: 12px; left: 16px; font-size: 10px; color: rgba(255,255,255,0.35); direction: ltr; }
  body.error .fill { background: #E05555; width: 100% !important; }
  body.error .fill::after { display: none; }
  body.error .status { color: #FFB4B4; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes breathe { 0%,100% { opacity: .7; transform: scale(.95); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
</style>
</head>
<body>
  <div class="glow"></div>
  <img class="mark" src="${markDataUri}" alt="">
  <h1>نبغة</h1>
  <div class="tag">إدارة الدروس الخصوصية</div>
  <div class="bar"><div class="fill" id="fill"></div></div>
  <div class="status" id="status">جاري التشغيل…</div>
  <div class="version">v${version}</div>
<script>
  window.setStatus = function (text, step, total) {
    document.getElementById('status').textContent = text;
    if (step && total) document.getElementById('fill').style.width = Math.max(8, Math.round(step / total * 100)) + '%';
  };
  window.setError = function (text) {
    document.body.classList.add('error');
    document.getElementById('status').textContent = text;
  };
</script>
</body>
</html>`;
}

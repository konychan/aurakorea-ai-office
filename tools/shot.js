/* 대시보드 화면 촬영 — 도면을 눈으로 검수하기 위한 도구.
 *
 * 문서는 렌더해서 보고 고치는데, 정작 사무실 화면은 눈으로 못 봐서
 * 방이 겹치거나 크기가 어긋나는 걸 대표님이 먼저 발견하시는 일이 반복됐다.
 * 이제 화면도 찍어서 확인한 뒤에 올린다.
 *
 * 사용: node tools/shot.js [출력경로] [가로] [세로]
 *   dev-server(5500)가 떠 있어야 한다. 없으면 알아서 띄웠다 내린다.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 5500;
const out = path.resolve(process.argv[2] || path.join(__dirname, 'docgen/out/_preview/office.png'));
const W = Number(process.argv[3] || 1907);   // 대표님 모니터 기준
const H = Number(process.argv[4] || 902);

const alive = () => new Promise(res => {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 900 }, r => { r.destroy(); res(true); });
  req.on('error', () => res(false));
  req.on('timeout', () => { req.destroy(); res(false); });
});

(async () => {
  let server = null;
  if (!(await alive())) {
    server = spawn(process.execPath, [path.join(ROOT, 'dev-server.js')], { cwd: ROOT, stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await alive()); i++) await new Promise(r => setTimeout(r, 250));
  }

  const puppeteer = require(path.join(__dirname, 'docgen/node_modules/puppeteer'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // SHOT_SCALE=3 처럼 키우면 작은 부분도 크게 볼 수 있다 (세부 검수용)
    await page.setViewport({ width: W, height: H, deviceScaleFactor: Number(process.env.SHOT_SCALE || 1) });

    const errors = [];
    page.on('pageerror', e => errors.push('JS 오류: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('콘솔: ' + m.text()); });
    // 404 는 "무엇이" 없는지 알아야 고칠 수 있다 — URL 까지 남긴다
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });

    // 로컬에서는 비밀번호 게이트가 없지만, 있으면 통과시킨다
    await page.evaluate(() => {
      const gate = document.getElementById('authGate');
      if (gate && gate.style.display !== 'none') {
        const btn = gate.querySelector('button');
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    // 하루를 시작시켜 캐릭터가 자리에 앉은 상태를 찍는다
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /하루 시작|시작/.test(x.textContent));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    fs.mkdirSync(path.dirname(out), { recursive: true });
    // SHOT_SEL 로 특정 영역만 크게 찍는다 (예: SHOT_SEL="#docStudio" → 문서제작실 확대 검수)
    const sel = process.env.SHOT_SEL;
    if (sel) {
      const clip = await page.evaluate(s => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const pad = 28;
        return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 };
      }, sel);
      if (!clip) throw new Error(`화면에서 못 찾음: ${sel}`);
      await page.screenshot({ path: out, clip });
    } else {
      await page.screenshot({ path: out });
    }
    console.log(out);
    if (errors.length) {
      console.log('\n--- 화면에서 난 오류 ---');
      [...new Set(errors)].slice(0, 12).forEach(e => console.log('  ' + e));
    } else {
      console.log('화면 오류 없음');
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });

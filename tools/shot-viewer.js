/* 뷰어 창을 찍어서 눈으로 검수한다 — 대표님이 실제로 보실 화면이다.
 * 사용: node tools/shot-viewer.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 5500;
const OUT = path.join(__dirname, 'docgen/out/_preview');

const alive = () => new Promise(res => {
  const req = http.get({ host:'127.0.0.1', port:PORT, path:'/', timeout:900 }, r => { r.destroy(); res(true); });
  req.on('error', () => res(false));
  req.on('timeout', () => { req.destroy(); res(false); });
});

(async () => {
  let server = null;
  if(!(await alive())){
    server = spawn(process.execPath, [path.join(ROOT,'dev-server.js')], { cwd:ROOT, stdio:'ignore' });
    for(let i=0;i<40 && !(await alive());i++) await new Promise(r=>setTimeout(r,250));
  }
  const puppeteer = require(path.join(__dirname,'docgen/node_modules/puppeteer'));
  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  fs.mkdirSync(OUT, { recursive:true });
  try{
    const page = await browser.newPage();
    await page.setViewport({ width:1400, height:960, deviceScaleFactor:2 });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'networkidle0' });
    await new Promise(r=>setTimeout(r,900));

    const shoot = async (name) => {
      const el = await page.$('.vwCard');
      if(!el) { console.log('창이 안 열림: ' + name); return; }
      const p = path.join(OUT, name + '.png');
      await el.screenshot({ path: p });
      console.log(p);
      await page.evaluate(() => document.querySelector('.vwClose')?.click());
      await new Promise(r=>setTimeout(r,250));
    };

    /* 보고 내용 창 — 실제 시장조사 보고 형태로 하나 만들어 띄운다 */
    await page.evaluate(async () => {
      const { openReport } = await import('/src/viewer.js');
      const res = await fetch('/data/agent-results.json');
      const d = (await res.json())['최이든'];
      openReport({
        id: 1, reporter:'문가온', worker:'최이든', team:'gcc',
        title:'GCC 시장조사',
        result: (d.headline ? `【핵심】 ${d.headline}\n\n` : '') + d.text +
                (d.keyPoints?.length ? '\n\n' + d.keyPoints.map(k=>'· '+k).join('\n') : ''),
        sources: d.sources, files:['data/agent-results.json'],
        tests:'실제 웹 검색 결과에 근거 (출처 첨부)',
        uncertain: d.watchOut,
        needsDecision:'대응 여부와 우선순위 판단 필요',
        at: 0,
      });
    });
    await new Promise(r=>setTimeout(r,700));
    await shoot('viewer-report');

    /* 결재 안건 창 */
    await page.evaluate(async () => {
      const { openAgenda } = await import('/src/viewer.js');
      const { AGENDAS } = await import('/data/staff.js');
      const a = AGENDAS.gcc[0];
      openAgenda({ id:1, name:'하람', team:'gcc', title:a.t, why:a.why, point:a.point, simMin:0 });
    });
    await new Promise(r=>setTimeout(r,500));
    await shoot('viewer-agenda');

    /* 만든 문서 창 */
    await page.evaluate(async () => {
      const { openDocuments } = await import('/src/viewer.js');
      openDocuments();
    });
    await new Promise(r=>setTimeout(r,1400));
    await shoot('viewer-docs');
  } finally {
    await browser.close();
    if(server) server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });

/* 화면 동작 점검 — 실제로 눌러 보고 확인한다.
 * 사용: node tools/test-ui.js   (dev-server 5500 필요, 없으면 띄웠다 내린다)
 */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 5500;
const SHOT = path.join(__dirname, 'docgen/out/_preview');

const alive = () => new Promise(res => {
  const req = http.get({ host:'127.0.0.1', port:PORT, path:'/', timeout:900 }, r => { r.destroy(); res(true); });
  req.on('error', () => res(false));
  req.on('timeout', () => { req.destroy(); res(false); });
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '통과' : '실패'}  ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  let server = null;
  if(!(await alive())){
    server = spawn(process.execPath, [path.join(ROOT,'dev-server.js')], { cwd:ROOT, stdio:'ignore' });
    for(let i=0;i<40 && !(await alive());i++) await new Promise(r=>setTimeout(r,250));
  }
  const puppeteer = require(path.join(__dirname,'docgen/node_modules/puppeteer'));
  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  try{
    const page = await browser.newPage();
    await page.setViewport({ width:1907, height:902 });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'networkidle0' });
    await new Promise(r=>setTimeout(r,900));

    /* 1. 문서제작실이 있고 강태오가 그 안에 있다 */
    check('문서제작실 렌더링', await page.$('#docStudio') !== null);
    check('강태오가 문서제작실에 있다',
      await page.$eval('#docStudio .docDesk', el => el.dataset.n) === '강태오');
    check('강태오가 팀 룸에는 없다',
      await page.$$eval('.room .desk', els => els.every(e => e.dataset.n !== '강태오')));

    /* 2. 요청 버튼 → 폼 → 제출 → 작업지시서 */
    await page.click('.dsBtn[data-doc="PPT"]');
    await new Promise(r=>setTimeout(r,250));
    check('PPT 요청 폼이 열린다', await page.$('#dqTitle') !== null);

    await page.type('#dqTitle','스페인 바이어 제안서');
    await page.type('#dqPurpose','다음 주 화상미팅 화면공유');
    await page.type('#dqAudience','스페인 유통사 구매담당');
    await page.type('#dqContent','시장조사 3인 보고 내용 기반');
    await page.click('.dsOk');
    await new Promise(r=>setTimeout(r,400));

    const order = await page.$eval('#dsOrderText', el => el.textContent).catch(()=>'');
    check('작업지시서가 생성된다', order.includes('스페인 바이어 제안서') && order.includes('PowerPoint'),
      order ? order.split('\n')[1] : '지시서 없음');
    check('지시서에 용도·받는사람이 담긴다',
      order.includes('화상미팅') && order.includes('구매담당'));

    await page.click('.dsCancel');
    await new Promise(r=>setTimeout(r,250));

    /* 3. 도면 대기열에 표시된다 */
    const q = await page.$eval('#docQueue', el => el.textContent.trim());
    check('도면에 요청 대기열이 뜬다', q.length > 0, q);
    const stateTxt = await page.$eval('#docState', el => el.textContent);
    check('문서제작실 상태가 바뀐다', /요청/.test(stateTxt), stateTxt);

    /* 4. 새로고침해도 요청이 남는다 */
    await page.reload({ waitUntil:'networkidle0' });
    await new Promise(r=>setTimeout(r,900));
    const q2 = await page.$eval('#docQueue', el => el.textContent.trim());
    check('새로고침 후에도 요청이 남는다', q2.includes('스페인'), q2);

    /* 5. @ 자동완성 */
    await page.click('#cmd');
    await page.type('#cmd','@강');
    await new Promise(r=>setTimeout(r,250));
    const names = await page.$$eval('.mention .mItem b', els => els.map(e=>e.textContent));
    check('@ 자동완성 목록이 뜬다', names.length > 0, names.join(', '));
    check('강태오가 후보에 있다', names.includes('강태오'));

    await page.keyboard.press('ArrowDown');
    const picked = await page.$$eval('.mention .mItem', els => {
      const on = els.findIndex(e => e.classList.contains('on'));
      return els[on] ? els[on].querySelector('b').textContent : '';
    });
    check('방향키로 고를 수 있다', !!picked, picked);

    /* 6. 담당업무로도 찾아진다 */
    await page.$eval('#cmd', el => el.value = '');
    await page.type('#cmd','@시장조사');
    await new Promise(r=>setTimeout(r,250));
    const byRole = await page.$$eval('.mention .mItem b', els => els.map(e=>e.textContent));
    check('담당업무로도 검색된다', byRole.length >= 3, byRole.join(', '));

    /* 7. @태그로 강태오 지시 → 형식 고르기 창 */
    await page.$eval('#cmd', el => el.value = '');
    await page.type('#cmd','@강태오 브랜드 소개서 만들어줘');
    await page.keyboard.press('Escape');
    await page.click('#sendBtn');
    await new Promise(r=>setTimeout(r,500));
    check('@태그 지시가 형식 선택창을 연다', await page.$('.dsPick') !== null);
    const pickTxt = await page.$eval('.dsPick .dsHint', el => el.textContent).catch(()=>'');
    check('태그를 뗀 내용만 넘어간다', pickTxt.includes('브랜드 소개서') && !pickTxt.includes('@'), pickTxt.trim());

    check('자바스크립트 오류 없음', jsErrors.length === 0, jsErrors[0] || '');

    await page.screenshot({ path: path.join(SHOT,'ui-test.png') });
  } finally {
    await browser.close();
    if(server) server.kill();
  }

  const failed = results.filter(r=>!r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 통과`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

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

    /* 8. 결재·보고를 열어 보고 파일로 받을 수 있다 */
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.querySelectorAll('.vwModal,.dsModal').forEach(e => e.remove());
      // 하루를 시작하고 속도를 올려 안건·보고가 실제로 쌓이게 한다
      const speed = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '4x');
      const start = [...document.querySelectorAll('button')].find(b => /하루 시작/.test(b.textContent));
      if(start) start.click();
      if(speed) speed.click();
    });

    const waitFor = async (sel, ms = 40000) => {
      const t0 = Date.now();
      while(Date.now() - t0 < ms){
        if(await page.$(sel)) return true;
        await new Promise(r => setTimeout(r, 400));
      }
      return false;
    };

    // 결재 안건
    const gotAgenda = await waitFor('#agendaQueue button[data-act="see"]');
    check('결재 안건이 쌓인다', gotAgenda);
    if(gotAgenda){
      await page.click('#agendaQueue button[data-act="see"]');
      await new Promise(r=>setTimeout(r,350));
      const txt = await page.$eval('.vwCard', el => el.textContent).catch(()=>'');
      check('결재 안건을 열어 볼 수 있다', txt.includes('어떤 건인지'), txt.slice(0,40).replace(/\s+/g,' '));
      check('무엇을 정해야 하는지 보여준다', txt.includes('정해 주셔야 할 것'));
      check('안건이 반려되지 않는다 (열어만 봤다)',
        await page.$('#agendaQueue button[data-act="see"]') !== null);
      check('안건 내려받기 버튼이 있다', await page.$('.vwDown') !== null);
      await page.click('.vwClose');
      await new Promise(r=>setTimeout(r,200));
    }

    // 보고 대기열
    const gotReport = await waitFor('#reportQueue button[data-see]');
    check('보고가 대기열에 쌓인다', gotReport);
    if(gotReport){
      await page.click('#reportQueue button[data-see]');
      await new Promise(r=>setTimeout(r,350));
      const txt = await page.$eval('.vwCard', el => el.textContent).catch(()=>'');
      check('입장 전에도 보고를 열어 볼 수 있다', txt.includes('한 일과 결과'), txt.slice(0,40).replace(/\s+/g,' '));
      check('본부장 검토 표시가 있다', txt.includes('본부장 검토 완료'));

      // 실제로 내려받아지는지 확인한다
      const dir = path.join(SHOT,'dl');
      require('fs').mkdirSync(dir,{recursive:true});
      const cdp = await page.createCDPSession();
      await cdp.send('Page.setDownloadBehavior',{ behavior:'allow', downloadPath:dir });
      await page.click('.vwDown');
      let files = [];
      for(let i=0;i<25;i++){
        files = require('fs').readdirSync(dir).filter(f => f.endsWith('.html'));
        if(files.length) break;
        await new Promise(r=>setTimeout(r,250));
      }
      check('보고서가 파일로 내려받아진다', files.length > 0, files[0] || '받은 파일 없음');
      if(files.length){
        const body = require('fs').readFileSync(path.join(dir,files[0]),'utf8');
        check('받은 파일에 내용이 들어 있다', body.includes('한 일과 결과') && body.includes('AURAKOREA'));
      }
      await page.click('.vwClose');
    }

    /* 9. 만든 문서 보기 + 실제 파일 링크 */
    await page.evaluate(() => {
      const d = [...document.querySelectorAll('.desk')].find(e => e.dataset.n === '강태오');
      if(d) d.click();
    });
    await new Promise(r=>setTimeout(r,500));
    const hasSeeDocs = await page.$('#seeDocs') !== null;
    check('강태오 패널에 문서 보기 버튼이 있다', hasSeeDocs);
    if(hasSeeDocs){
      // 도면이 축소 변환돼 있어 좌표 클릭은 빗나갈 수 있다. 요소를 직접 누른다.
      await page.evaluate(() => document.getElementById('seeDocs').click());
      await waitFor('.vwFile[download]', 8000);
      const links = await page.$$eval('.vwFile[download]', els => els.map(e => e.getAttribute('href')));
      check('실제 문서 파일 링크가 있다', links.length >= 3, links.join(' '));
      // 링크가 정말 살아 있는지 서버에 물어본다
      const statuses = await page.evaluate(async urls => {
        const out = [];
        for(const u of urls){ try{ const r = await fetch(u,{method:'HEAD'}); out.push(r.status); }catch(e){ out.push(0); } }
        return out;
      }, links);
      check('파일이 실제로 받아진다', links.length > 0 && statuses.every(s => s === 200), statuses.join(','));
      await page.evaluate(() => document.querySelector('.vwClose')?.click());
    }

    /* 10. 일반 지시가 실패하지 않는다 (예전엔 브라우저가 api.anthropic.com 을 불러 매번 실패했다) */
    const external = [];
    page.on('request', r => { if(!/^http:\/\/127\.0\.0\.1:/.test(r.url())) external.push(r.url()); });
    await page.evaluate(() => { document.querySelectorAll('.vwModal,.dsModal').forEach(e=>e.remove()); });
    await page.$eval('#cmd', el => el.value = '');
    // 앞 단계에서 강태오를 눌러 뒀으므로 태그로 대상을 분명히 지정한다
    await page.type('#cmd','@나윤호 아르헨티나 재고 확인해줘');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('sendBtn').click());
    await new Promise(r=>setTimeout(r,2500));
    const out = await page.$eval('#out', el => el.textContent);
    check('지시가 실패 메시지를 내지 않는다', !out.includes('호출 실패'), out.split('\n')[1] || out.slice(0,40));
    check('지시가 접수된다', out.includes('접수'), '');
    check('외부 서버를 부르지 않는다', external.length === 0, external[0] || '');

    /* 11. 지시가 본부장 숙제로 접수된다 (로컬 서버는 저장소 파일에 기록한다) */
    const hwBefore = require('fs').existsSync(path.join(ROOT,'data/homework.json'))
      ? JSON.parse(require('fs').readFileSync(path.join(ROOT,'data/homework.json'),'utf8')).length : 0;
    await page.$eval('#cmd', el => el.value = '');
    await page.type('#cmd','@하람 두바이 바이어 연락처 정리');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('sendBtn').click());
    await new Promise(r=>setTimeout(r,1200));
    const hwAfter = require('fs').existsSync(path.join(ROOT,'data/homework.json'))
      ? JSON.parse(require('fs').readFileSync(path.join(ROOT,'data/homework.json'),'utf8')) : [];
    check('지시가 본부장 숙제로 쌓인다', hwAfter.length > hwBefore, hwAfter[0] ? hwAfter[0].title : '없음');
    check('숙제에 한글이 깨지지 않는다', !!hwAfter[0] && hwAfter[0].title.includes('두바이'), hwAfter[0] ? hwAfter[0].title : '');
    check('숙제 접수 안내가 뜬다', (await page.$eval('#out', el=>el.textContent)).includes('숙제'), '');

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

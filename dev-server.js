// 아우라코리아 AI 오피스 로컬 서버
// - 정적 파일(index.html 등)을 서비스한다
// - /api/agent/:name 은 클로드 API(웹 검색 포함)를 실시간으로 호출하는 유료 경로다.
//   지금은 프론트엔드가 이 경로 대신 data/agent-results.json(무료, Claude Code가 직접 채워둔 결과)을 읽는다.
//   대표님이 나중에 Anthropic 크레딧을 충전하면 이 경로로 실시간 자동 검색으로 전환할 수 있다.
// - API 키는 이 서버 안에서만 쓰이고 브라우저로는 절대 내려가지 않는다
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 5500;

function loadEnvFile(){
  const envPath = path.join(ROOT, '.env');
  const env = {};
  if(fs.existsSync(envPath)){
    for(const line of fs.readFileSync(envPath, 'utf8').split('\n')){
      const t = line.trim();
      if(!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if(i < 0) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return env;
}
const ENV = loadEnvFile();
const API_KEY = process.env.ANTHROPIC_API_KEY || ENV.ANTHROPIC_API_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res){
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p === '/') p = '/index.html';
  const filePath = path.join(ROOT, p);
  if(!filePath.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if(err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      // 개발 중에는 항상 최신 파일을 받도록 캐시를 끈다
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(data);
  });
}

function callClaudeWebSearch(systemPrompt, userText){
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: userText }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try{ resolve(JSON.parse(raw)); } catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 1호 실제 에이전트: 유래인 (브랜드소싱팀 · 브랜드 발굴)
const AGENT_TASKS = {
  '유래인': {
    system: '너는 아우라코리아 브랜드소싱팀 브랜드 발굴 담당이다. 반드시 이번에 실행한 실제 웹 검색 결과에 근거해서만 답하고, 검색으로 확인되지 않은 내용은 추측해서 말하지 않는다. 한국어로, 대표에게 보고하듯 400자 내외로 간결하게 정리한다.',
    user: '지금 화제성이 있거나 최근 해외 진출을 시작한 한국 화장품(K뷰티) 브랜드 후보를 실제로 검색해서 2~3곳 찾아줘. 브랜드명, 특징, 왜 아우라코리아가 주목할 만한지를 정리해줘.',
  },
};

/* 대표님 지시를 본부장 숙제로 접수한다.
   브라우저는 파일을 못 쓰지만 이 서버는 쓸 수 있다 — 그래서 지시가 저장소 안(data/homework.json)에
   바로 떨어지고, 본부장이 그 파일을 읽어 처리한다. 배포본(Vercel)에는 이 경로가 없으므로
   프론트엔드가 실패를 감지해 "복사해서 전달" 방식으로 넘어간다. */
const HOMEWORK = path.join(ROOT, 'data/homework.json');
function addHomework(item){
  let list = [];
  try{ list = JSON.parse(fs.readFileSync(HOMEWORK, 'utf8').replace(/^﻿/, '')); }catch(e){}
  list.unshift({ ...item, id: 'hw' + Date.now(), at: new Date().toISOString(), status: '대기' });
  fs.writeFileSync(HOMEWORK, JSON.stringify(list.slice(0, 200), null, 2) + '\n', 'utf8');
  pushHomework(item.title);
  return list.length;
}

/* 숙제를 저장소로 올린다 — 그래야 클라우드 루틴이 아침에 읽어 자동으로 처리한다.
   실패해도(오프라인 등) 파일은 이미 남아 있으므로 지시가 사라지지는 않는다. */
function pushHomework(title){
  const { execFile } = require('child_process');
  const run = args => new Promise(r => execFile('git', args, { cwd: ROOT }, (e, o, s) => r(e ? (s || e.message) : null)));
  (async () => {
    for(const args of [
      ['add', 'data/homework.json'],
      ['commit', '-m', `대표님 지시 접수: ${title}`],
      ['pull', '--rebase', '-q', 'origin', 'master'],
      ['push', '-q', 'origin', 'master'],
    ]){
      const err = await run(args);
      if(err){ console.log('숙제 업로드 보류(로컬에는 저장됨):', String(err).split('\n')[0]); return; }
    }
    console.log('숙제 업로드 완료 — 클라우드가 처리합니다');
  })();
}

/* 대표님이 올리신 PPT 를 사무실 안으로 들여놓는다.
   브라우저는 파일을 저장할 수 없지만 이 서버는 할 수 있다 — 그래서 번역실 업로드 버튼이
   실제로 동작한다. 배포본(Vercel)에는 이 경로가 없으므로 프론트엔드가 실패를 감지해
   "지시서 복사해서 전달" 방식으로 넘어간다.
   ★ 파일은 저장소에 올리지 않는다(.gitignore). 대표님 문서를 임의로 외부에 내보내지 않는다. */
const INBOX = path.join(ROOT, 'tools/translate/inbox');
const MAX_UPLOAD = 40 * 1024 * 1024;      // base64 로 부풀어도 받아낼 수 있는 상한

function saveUpload({ name, langs, note, data }){
  // 경로 조작 방지 — 파일명만 쓴다
  const safe = path.basename(String(name || '')).replace(/[\\/:*?"<>|]/g, '_');
  if(!/\.pptx$/i.test(safe)) throw new Error('.pptx 파일만 받습니다');

  const buf = Buffer.from(String(data || ''), 'base64');
  if(!buf.length) throw new Error('파일 내용이 비어 있습니다');
  // .pptx 는 ZIP 이다. 앞 두 글자가 PK 가 아니면 진짜 pptx 가 아니다.
  if(buf[0] !== 0x50 || buf[1] !== 0x4B) throw new Error('pptx 파일이 아닙니다');

  fs.mkdirSync(INBOX, { recursive: true });
  fs.writeFileSync(path.join(INBOX, safe), buf);

  const list = Array.isArray(langs) ? langs : [];
  addHomework({
    title: `PPT 번역: ${safe} → ${list.join(', ')}`,
    assignee: '송하린',
    team: 'trans',
    local: true,                    // 파일은 이 PC 에만 있다 (클라우드에서는 처리할 수 없다)
    file: `tools/translate/inbox/${safe}`,
    langs: list,
    note: note || '',
  });
  return safe;
}

const server = http.createServer(async (req, res) => {
  if(req.method === 'POST' && req.url === '/api/translate-upload'){
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', c => {
      size += c.length;
      if(size > MAX_UPLOAD){ tooBig = true; req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try{
        if(tooBig) throw new Error('파일이 너무 큽니다');
        const saved = saveUpload(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        console.log(`번역 요청 파일 저장: tools/translate/inbox/${saved}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok:true, file: saved }));
      }catch(e){
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok:false, error: String(e.message || e) }));
      }
    });
    return;
  }

  if(req.method === 'POST' && req.url === '/api/homework'){
    // 한글이 조각나서 오면 문자열 이어붙이기로는 깨진다. 버퍼로 모아 한 번에 해석한다.
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try{
        const item = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const count = addHomework(item);
        console.log(`숙제 접수: ${item.title} (총 ${count}건)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok:true, count }));
      }catch(e){
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok:false, error: String(e.message || e) }));
      }
    });
    return;
  }

  if(req.method === 'POST' && req.url.startsWith('/api/agent/')){
    const name = decodeURIComponent(req.url.slice('/api/agent/'.length));
    const task = AGENT_TASKS[name];
    if(!task){
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok:false, error: '등록되지 않은 에이전트입니다: ' + name }));
    }
    if(!API_KEY){
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok:false, error: '서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env 파일을 만들어주세요.' }));
    }
    try{
      const data = await callClaudeWebSearch(task.system, task.user);
      if(data.error){
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok:false, error: data.error.message || 'API 오류' }));
      }
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '(응답 없음)';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok:true, text }));
    }catch(e){
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok:false, error: String(e.message || e) }));
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`AURAKOREA AI OFFICE 서버 실행 중 → http://localhost:${PORT}`);
  if(!API_KEY) console.log('경고: ANTHROPIC_API_KEY가 없어 실제 업무 수행 기능은 "리서치 실패"로 표시됩니다. .env 파일을 만들어주세요 (.env.example 참고).');
});

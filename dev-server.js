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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
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

const server = http.createServer(async (req, res) => {
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

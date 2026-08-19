/* 휴대폰·외부에서 내리신 지시를 저장소에 바로 기록한다.
 *
 * 배포 환경(Vercel)에는 파일을 쓸 곳이 없으므로 GitHub API 로 data/homework.json 을 직접 고친다.
 * 그러면 시간마다 도는 클라우드 루틴이 그걸 읽어 처리한다 — 로컬에서 쓰실 때와 똑같아진다.
 *
 * 안전장치
 *  - 로그인 세션 쿠키가 있어야만 받는다 (비밀번호를 통과한 브라우저만)
 *  - 토큰은 Vercel 환경변수에만 있고 브라우저로는 절대 내려가지 않는다
 *  - data/homework.json 한 파일만 건드린다. 다른 파일은 손대지 않는다
 */
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'konychan/aurakorea-ai-office';
const FILE = 'data/homework.json';
const BRANCH = 'master';
const MAX = 200;

function parseCookies(header){
  const out = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if(i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function authed(req){
  const expected = process.env.SITE_PASSWORD || '';
  if(!expected) return false;
  const valid = crypto.createHmac('sha256', expected).update('aurakorea-office-session').digest('hex');
  return parseCookies(req.headers.cookie).auk_session === valid;
}

const gh = (token, path, init = {}) => fetch(`https://api.github.com/repos/${REPO}/${path}`, {
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
});

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST 만 받습니다.' });
  if(!authed(req))          return res.status(401).json({ ok:false, error:'로그인이 필요합니다.' });

  const token = process.env.GITHUB_TOKEN || '';
  if(!token) return res.status(200).json({ ok:false, error:'GITHUB_TOKEN 이 설정되어 있지 않습니다.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const title = String(body.title || '').trim();
  if(!title) return res.status(400).json({ ok:false, error:'지시 내용이 비어 있습니다.' });

  try{
    // 1) 현재 파일을 읽는다 (sha 가 있어야 덮어쓸 수 있다)
    const cur = await gh(token, `contents/${FILE}?ref=${BRANCH}`);
    let list = [], sha;
    if(cur.ok){
      const j = await cur.json();
      sha = j.sha;
      try{ list = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); }catch(e){ list = []; }
    }else if(cur.status !== 404){
      return res.status(200).json({ ok:false, error:`저장소 읽기 실패 (${cur.status})` });
    }

    // 2) 지시를 맨 앞에 넣는다
    list.unshift({
      title,
      assignee: String(body.assignee || '').trim(),
      team: String(body.team || '').trim(),
      at: new Date().toISOString(),
      status: '대기',
      id: 'hw' + Date.now(),
      via: '모바일/웹',
    });

    // 3) 커밋한다
    const put = await gh(token, `contents/${FILE}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `대표님 지시 접수: ${title}`,
        content: Buffer.from(JSON.stringify(list.slice(0, MAX), null, 2) + '\n', 'utf8').toString('base64'),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if(!put.ok){
      const t = await put.text();
      return res.status(200).json({ ok:false, error:`저장 실패 (${put.status}) ${t.slice(0, 120)}` });
    }
    res.status(200).json({ ok:true, count: list.length });
  }catch(e){
    res.status(200).json({ ok:false, error: String(e.message || e) });
  }
};

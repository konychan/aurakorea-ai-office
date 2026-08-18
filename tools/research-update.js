/* 시장조사 결과 반영기 — 토큰 절약용.
 *
 * 클라우드 자동 갱신 담당이 8KB짜리 data/agent-results.json 을 통째로 읽고 쓰면
 * 그만큼이 매번 토큰 비용이 된다. 그래서 담당은 "자기 몫 한 사람치"만 작은 JSON 으로 쓰고,
 * 합치는 일은 토큰이 들지 않는 이 스크립트가 한다.
 *
 * 사용: node tools/research-update.js <조각파일.json>
 * 조각파일 형식:
 *   { "name":"박세렌", "headline":"...", "text":"...", "keyPoints":["..."], "watchOut":"...",
 *     "sources":[{"title":"...","url":"..."}], "angle":"이번에 본 각도 한 줄" }
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RESULTS = path.join(ROOT, 'data/agent-results.json');
const ANGLES = path.join(ROOT, 'data/research-angles.json');
const KEEP_ANGLES = 6;   // 사람당 최근 6개만 남긴다 — 담당이 읽을 파일을 작게 유지하는 게 목적이다

function die(msg) { console.error('오류: ' + msg); process.exit(1); }

/* 요일 당번표 — 하루에 한 사람만 갱신한다.
   4명을 매일 다 돌리면 비용이 4배가 된다. 시장 뉴스는 하루 만에 뒤집히지 않으므로
   사람당 주 1회면 충분하고, 그러면 총 실행이 주 7회에서 주 4회로 오히려 줄어든다. */
const DUTY = {
  1: { name: '박세렌', topic: '아르헨티나 화장품/K뷰티 시장·규제·유통' },
  2: { name: '윤도아', topic: '스페인 및 EU 화장품/K뷰티 시장·규제(INCI·PPWR)·유통' },
  3: { name: '최이든', topic: 'GCC(사우디·UAE 중심) 화장품/K뷰티 시장·규제·할랄·유통' },
  4: { name: '유래인', topic: '해외 진출 가능성 있는 한국 화장품 브랜드 발굴' },
};

// 담당 조회 모드 — 담당자가 파일을 열어보지 않아도 되게, 필요한 것만 한 번에 알려준다
if (process.argv[2] === '--today') {
  const kstDay = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
  const duty = DUTY[kstDay];
  if (!duty) { console.log('오늘은 당번이 없습니다. 아무것도 하지 말고 종료하세요.'); process.exit(0); }
  const angles = fs.existsSync(ANGLES) ? JSON.parse(fs.readFileSync(ANGLES, 'utf8')) : {};
  console.log(`담당: ${duty.name}`);
  console.log(`주제: ${duty.topic}`);
  console.log('최근에 이미 다룬 각도 (겹치지 말 것):');
  (angles[duty.name] || ['(없음)']).forEach(a => console.log('  - ' + a));
  process.exit(0);
}

const src = process.argv[2];
if (!src) die('조각 파일 경로가 필요합니다. 예) node tools/research-update.js tmp-research.json');
if (!fs.existsSync(src)) die(`파일이 없습니다: ${src}`);

let p;
// 편집기에 따라 파일 앞에 BOM 이 붙는다. 그대로 두면 JSON.parse 가 실패한다.
try { p = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, '')); }
catch (e) { die('조각 파일이 올바른 JSON 이 아닙니다 — ' + e.message); }

for (const f of ['name', 'headline', 'text']) if (!p[f]) die(`'${f}' 값이 비어 있습니다.`);
if (!Array.isArray(p.sources) || p.sources.length === 0) die('sources 가 최소 1개는 있어야 합니다. 출처 없는 보고는 올리지 않는다.');

// 한국 시간 기준 현재 시각 (+09:00)
const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00');

const results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
results[p.name] = {
  headline: p.headline,
  text: p.text,
  keyPoints: (p.keyPoints || []).slice(0, 5),
  watchOut: p.watchOut || '',
  sources: p.sources.slice(0, 3),
  updatedAt: kst,
  note: 'Claude 클라우드 스케줄러가 자동으로 갱신한 결과입니다.',
};
fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2) + '\n', 'utf8');

// 조사 각도 기록 — 다음 실행 때 같은 얘기를 반복하지 않으려고 남긴다
const angles = fs.existsSync(ANGLES) ? JSON.parse(fs.readFileSync(ANGLES, 'utf8')) : {};
if (p.angle) {
  angles[p.name] = [`${kst.slice(0, 10)} ${p.angle}`, ...(angles[p.name] || [])].slice(0, KEEP_ANGLES);
  fs.writeFileSync(ANGLES, JSON.stringify(angles, null, 2) + '\n', 'utf8');
}

fs.unlinkSync(src);   // 조각 파일은 커밋되면 안 된다
console.log(`반영 완료: ${p.name} (${kst})`);

/* --push : 커밋·푸시까지 여기서 끝낸다.
   클라우드 실행 환경은 detached HEAD 로 체크아웃되기 때문에 `git push origin master` 가 거절된다.
   담당이 그때마다 헤매면 그 시행착오가 전부 토큰이다. 정답 절차를 여기 박아 둔다. */
if (process.argv.includes('--push')) {
  const { execFileSync } = require('child_process');
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  try {
    git('add', 'data/');                              // data/ 밖은 절대 커밋하지 않는다
    git('commit', '-m', `시장조사 자동 갱신: ${p.name} (${kst.slice(0, 10)})`);
    git('fetch', 'origin', 'master');
    git('rebase', 'origin/master');                   // 그 사이 올라온 원격 커밋 위로 얹는다
    git('push', 'origin', 'HEAD:master');             // detached HEAD 에서도 통하는 형태
    console.log('커밋·푸시 완료');
  } catch (e) {
    console.error('git 처리 실패 — ' + (e.stderr || e.stdout || e.message).toString().trim());
    process.exit(1);
  }
}

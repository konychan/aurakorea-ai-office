/* 본부장 숙제 처리기 — 클라우드 루틴이 쓴다.
 *
 * 대표님이 지시창에 입력하시면 data/homework.json 에 쌓이고 저장소로 올라간다.
 * 클라우드 루틴이 아침에 그걸 읽어 처리하고 결과를 같은 파일에 적어 되돌린다.
 * 대시보드는 완료된 숙제를 보고 대기열에 띄운다 — 대표님은 열어 보고 결정만 하시면 된다.
 *
 * 사용:
 *   node tools/homework.js --next            대기 중인 숙제 1건을 알려준다 (없으면 그렇게 말한다)
 *   node tools/homework.js --save <조각.json> 결과를 적고 완료 처리 + 커밋·푸시
 *
 * 조각 형식: { "id":"hw...", "result":"...", "sources":[{"title":"","url":""}], "uncertain":"", "needsDecision":"" }
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data/homework.json');

const read = () => {
  try{ return JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, '')); }catch(e){ return []; }
};
const write = list => fs.writeFileSync(FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
const die = m => { console.error('오류: ' + m); process.exit(1); };

if (process.argv[2] === '--next') {
  const item = read().find(h => h.status === '대기');
  if (!item) { console.log('대기 중인 숙제가 없습니다. 아무것도 하지 말고 종료하세요.'); process.exit(0); }
  console.log(`숙제 id: ${item.id}`);
  console.log(`지시: ${item.title}`);
  console.log(`담당으로 지정된 직원: ${item.assignee}`);
  console.log(`접수: ${item.at}`);
  const rest = read().filter(h => h.status === '대기').length - 1;
  if (rest > 0) console.log(`(뒤에 ${rest}건 더 있습니다 — 이번에는 위 1건만 처리하세요)`);
  process.exit(0);
}

if (process.argv[2] !== '--save') die('사용법: node tools/homework.js --next | --save <조각.json>');

const src = process.argv[3];
if (!src || !fs.existsSync(src)) die('조각 파일이 없습니다: ' + src);
let p;
try{ p = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '')); }
catch(e){ die('조각 파일이 올바른 JSON 이 아닙니다 — ' + e.message); }
if (!p.id || !p.result) die("'id' 와 'result' 는 반드시 있어야 합니다.");

const list = read();
const item = list.find(h => h.id === p.id);
if (!item) die('그런 숙제가 없습니다: ' + p.id);

Object.assign(item, {
  status: '완료',
  result: p.result,
  sources: (p.sources || []).slice(0, 3),
  uncertain: p.uncertain || '',
  needsDecision: p.needsDecision || '',
  doneAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00'),
});
write(list);
fs.unlinkSync(src);
console.log(`처리 완료: ${item.title}`);

// 클라우드는 detached HEAD 로 체크아웃된다 — 매번 헤매지 않도록 정답 절차를 박아 둔다
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
try{
  git('add', 'data/homework.json');
  git('commit', '-m', `숙제 처리: ${item.title}`);
  git('fetch', 'origin', 'master');
  git('rebase', 'origin/master');
  git('push', 'origin', 'HEAD:master');
  console.log('커밋·푸시 완료');
}catch(e){
  console.error('git 처리 실패 — ' + (e.stderr || e.stdout || e.message).toString().trim());
  process.exit(1);
}

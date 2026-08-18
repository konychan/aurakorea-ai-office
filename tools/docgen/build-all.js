/* 문서 전체 재생성 — 토큰 0.
 *
 * 설계한 문서는 코드로 남아 있으므로, 최신 시장조사 내용으로 다시 뽑는 데
 * AI 를 한 번도 부르지 않는다. 대표님이 "자료 최신본 줘" 하시면 이 한 줄이면 끝난다:
 *   node tools/docgen/build-all.js
 *
 * 새 종류의 문서를 "설계"할 때만 토큰이 든다. 이미 만든 문서를 "갱신"하는 건 공짜다.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPTS = ['build-brief-ppt.js', 'build-market-xlsx.js', 'build-brief-docx.js'];

let failed = 0;
for (const s of SCRIPTS) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8' });
    console.log('완료  ' + out.trim());
  } catch (e) {
    failed++;
    console.error('실패  ' + s + ' — ' + (e.stderr || e.message).toString().trim().split('\n')[0]);
  }
}
console.log(failed ? `\n${failed}건 실패. 위 메시지를 확인하세요.` : '\n전체 재생성 완료 (토큰 사용 0).');
process.exit(failed ? 1 : 0);

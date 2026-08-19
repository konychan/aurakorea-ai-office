/* 자체 점검 — 번역 도구가 제대로 도는지 확인하는 유일한 검사.
 *
 *   node tools/translate/selfcheck.js
 *
 * 실제 저장소에 있는 .pptx 로 왕복시켜 본다:
 *   뽑기 → 가짜 번역문 채우기 → 되돌려 넣기 → 다시 뽑아서 대조.
 * 글자가 정확히 그 자리에 들어갔는지, 나머지 파일이 그대로인지 확인한다.
 * 틀리면 예외를 던지고 멈춘다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { openPptx, scanXml, scanChartValues, isChart, sortTargets } = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const SAMPLE = path.join(ROOT, 'files', '2026-하반기-3대-수출시장-브리핑.pptx');

// XML 이스케이프까지 확인하려고 일부러 & 와 < 를 섞는다
const mark = t => `«${t} & <ok>»`;

async function readUnits(buf){
  const { zip, names } = await openPptx(buf);
  const out = [];
  for(const n of sortTargets(names)){
    const xml = await zip.file(n).async('string');
    for(const u of scanXml(xml).units) out.push(u.text.trim());
    if(isChart(n)) for(const u of scanChartValues(xml)) out.push(u.text.trim());
  }
  return out;
}

async function main(){
  assert.ok(fs.existsSync(SAMPLE), '견본 파일이 없습니다: ' + SAMPLE);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akt-'));
  const jsonPath = path.join(tmp, 'strings.json');
  const outPptx  = path.join(tmp, 'out.pptx');
  const node = process.execPath;

  // 1) 뽑기
  execFileSync(node, [path.join(__dirname, 'extract.js'), SAMPLE, '-o', jsonPath], { stdio: 'pipe' });
  const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(doc.units.length > 0, '번역 단위를 하나도 못 뽑았다');
  assert.ok(doc.stats.slides > 0, '슬라이드를 찾지 못했다');

  // 2) 가짜 번역문 채우기
  doc.units.forEach(u => { u.t.test = mark(u.text); });
  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf8');

  // 3) 되돌려 넣기 (apply 안의 자기 검사가 여기서 같이 돈다 — 실패하면 종료코드 2)
  execFileSync(node, [path.join(__dirname, 'apply.js'), SAMPLE, jsonPath, '--lang', 'test', '-o', outPptx], { stdio: 'pipe' });

  // 4) 다시 뽑아서 대조
  const after = new Set(await readUnits(fs.readFileSync(outPptx)));
  const want  = doc.units.map(u => mark(u.text).trim());
  const lost  = want.filter(w => !after.has(w));
  assert.strictEqual(lost.length, 0, `번역문이 들어가지 않은 항목 ${lost.length}건: ${lost.slice(0, 3).join(' | ')}`);

  // 5) 원문이 남아 있으면 안 된다 (덮어쓰기가 아니라 덧붙이기가 된 경우를 잡는다)
  const stillKorean = doc.units.map(u => u.text.trim()).filter(t => t && after.has(t));
  assert.strictEqual(stillKorean.length, 0, `원문이 그대로 남은 항목: ${stillKorean.slice(0, 3).join(' | ')}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`자체 점검 통과 — 슬라이드 ${doc.stats.slides}장 · 번역 단위 ${doc.units.length}개 왕복 확인`);
}

main().catch(e => { console.error('자체 점검 실패:', e.message); process.exit(1); });

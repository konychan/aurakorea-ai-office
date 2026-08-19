/* 3단계 — 번역문을 원본에 되돌려 넣기 (토큰 0)
 *
 *   node tools/translate/apply.js <원본.pptx> <결과.json> --lang es-AR [-o 결과.pptx]
 *
 * <a:t> 안의 글자만 갈아 끼운다. 나머지는 한 바이트도 바꾸지 않는다.
 * 만든 뒤 원본과 대조해서 "글자 말고 바뀐 게 없는지" 스스로 검사하고 결과를 찍는다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { openPptx, rewriteXml, rewriteChartValues, sortTargets, keepPad, TARGET } = require('./lib');

/* 언어 이름표(한국어)는 화면 쪽 data/langs.js 가 갖고 있다.
   여기서는 코드를 그대로 찍는다 — 코드가 곧 파일 이름이라 헷갈릴 일이 없고,
   ESM 인 langs.js 를 CommonJS 도구에서 끌어오면 실행마다 경고가 나온다. */

async function main(){
  const args = process.argv.slice(2);
  const plain = args.filter(a => !a.startsWith('-'));
  const [src, jsonPath] = plain;
  const li = args.indexOf('--lang');
  const lang = li >= 0 ? args[li + 1] : null;
  const oi = args.indexOf('-o');

  if(!src || !jsonPath || !lang){
    console.error('사용법: node tools/translate/apply.js <원본.pptx> <결과.json> --lang <언어코드> [-o 결과.pptx]');
    process.exit(1);
  }
  for(const p of [src, jsonPath]){
    if(!fs.existsSync(p)){ console.error('파일이 없습니다: ' + p); process.exit(1); }
  }

  const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if(doc.source && doc.source !== path.basename(src)){
    console.error(`중단: 번역문은 "${doc.source}" 용인데 원본은 "${path.basename(src)}" 입니다. 짝이 맞지 않습니다.`);
    process.exit(1);
  }

  const base = path.basename(src).replace(/\.pptx$/i, '');
  const out = oi >= 0 && args[oi + 1]
    ? args[oi + 1]
    : path.join(__dirname, 'out', `${base}.${lang}.pptx`);

  const srcBuf = fs.readFileSync(src);
  const { zip, names } = await openPptx(srcBuf);

  /* ── 파일별 { 번호: 새 글자 } 표를 만든다 (t = 글상자, v = 차트 캐시) ── */
  const plan = {};
  let done = 0, missing = [];
  for(const u of doc.units){
    const tr = u.t && u.t[lang];
    if(tr === undefined || tr === null || String(tr).trim() === ''){ missing.push(u); continue; }
    done++;
    for(const [file, runs, original, kind = 't'] of u.at){
      const f = plan[file] || (plan[file] = { t: {}, v: {} });
      const map = f[kind];
      map[runs[0]] = keepPad(original, tr);      // 번역문은 첫 자리에 통째로 넣고
      for(let i = 1; i < runs.length; i++) map[runs[i]] = '';   // 같은 묶음의 나머지는 비운다
    }
  }

  if(!done){
    console.error(`중단: "${lang}" 번역문이 하나도 채워져 있지 않습니다.`);
    process.exit(1);
  }

  /* ── 대상 파일만 다시 쓴다 ── */
  let changedFiles = 0;
  for(const name of sortTargets(names)){
    if(!plan[name]) continue;
    const entry = zip.file(name);
    const xml = await entry.async('string');
    let next = rewriteXml(xml, plan[name].t);
    next = rewriteChartValues(next, plan[name].v);
    if(next !== xml){ zip.file(name, next, { date: entry.date }); changedFiles++; }
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);

  /* ── 자기 검사: 글자 말고 바뀐 게 정말 없는가 ── */
  const problems = await verify(srcBuf, buf);

  console.log(`번역본 생성 → ${out}`);
  console.log(`  언어 ${lang} · 적용 ${done}건 / 전체 ${doc.units.length}건 · 파일 ${changedFiles}개 수정`);
  if(missing.length){
    console.log(`  ※ 번역이 비어 있어 원문 그대로 둔 항목 ${missing.length}건:`);
    missing.slice(0, 8).forEach(u => console.log(`     - [${u.where.join(', ')}] ${u.text.slice(0, 40)}`));
    if(missing.length > 8) console.log(`     ... 외 ${missing.length - 8}건`);
  }
  if(problems.length){
    console.log('  검사 실패 — 글자 외의 것이 바뀌었습니다:');
    problems.forEach(p => console.log('     ! ' + p));
    process.exit(2);
  }
  console.log('  검사 통과 — 슬라이드 구성·서식·이미지는 원본과 동일합니다.');
}

/* 원본과 결과를 대조한다.
   ① 들어 있는 파일 목록이 같은가  ② 번역 대상이 아닌 파일은 바이트까지 같은가 */
async function verify(srcBuf, outBuf){
  const a = await openPptx(srcBuf);
  const b = await openPptx(outBuf);
  const problems = [];

  const missing = a.names.filter(n => !b.names.includes(n));
  const added   = b.names.filter(n => !a.names.includes(n));
  if(missing.length) problems.push(`빠진 파일: ${missing.join(', ')}`);
  if(added.length)   problems.push(`추가된 파일: ${added.join(', ')}`);

  for(const n of a.names){
    if(TARGET.test(n) || !b.names.includes(n)) continue;
    const [x, y] = await Promise.all([a.zip.file(n).async('nodebuffer'), b.zip.file(n).async('nodebuffer')]);
    if(!x.equals(y)) problems.push(`내용이 바뀐 파일: ${n}`);
  }
  return problems;
}

main().catch(e => { console.error(e); process.exit(1); });

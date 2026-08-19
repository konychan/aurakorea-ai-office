/* 1단계 — 원문 뽑기 (토큰 0)
 *
 *   node tools/translate/extract.js <파일.pptx> [-o 결과.json]
 *
 * .pptx 안의 번역할 글자만 뽑아 JSON 으로 만든다. 파일 자체는 건드리지 않는다.
 * 같은 문구가 여러 슬라이드에 반복되면 하나로 합친다 — 번역할 양이 곧 비용이라서다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { openPptx, scanXml, scanChartValues, isChart, sortTargets, whereOf } = require('./lib');

async function main(){
  const args = process.argv.slice(2);
  const src = args.find(a => !a.startsWith('-'));
  if(!src){
    console.error('사용법: node tools/translate/extract.js <파일.pptx> [-o 결과.json]');
    process.exit(1);
  }
  if(!fs.existsSync(src)){ console.error('파일이 없습니다: ' + src); process.exit(1); }

  const oi = args.indexOf('-o');
  const base = path.basename(src).replace(/\.pptx$/i, '');
  const out = oi >= 0 && args[oi + 1]
    ? args[oi + 1]
    : path.join(__dirname, 'work', base + '.strings.json');

  const { zip, names } = await openPptx(fs.readFileSync(src));
  const targets = sortTargets(names);
  if(!targets.length){ console.error('번역할 슬라이드를 찾지 못했습니다. .pptx 파일이 맞습니까?'); process.exit(1); }

  /* 같은 문구는 하나로 합친다. key = 원문 그대로 (앞뒤 공백 포함하지 않은 형태로 묶는다) */
  const byText = new Map();
  let total = 0;

  for(const name of targets){
    const xml = await zip.file(name).async('string');
    // kind 't' = 글상자 <a:t> · 'v' = 차트 캐시 <c:v>. 차트는 둘 다 있다.
    const found = [
      ...scanXml(xml).units.map(u => ({ ...u, kind: 't' })),
      ...(isChart(name) ? scanChartValues(xml).map(u => ({ ...u, kind: 'v' })) : []),
    ];
    for(const u of found){
      total++;
      const key = u.text.trim();
      let unit = byText.get(key);
      if(!unit){
        unit = { id: byText.size + 1, where: [], text: key, at: [], t: {} };
        byText.set(key, unit);
      }
      const w = whereOf(name);
      if(!unit.where.includes(w)) unit.where.push(w);
      // 서식이 갈려 조각난 것은 줄 전체를 문맥으로 붙여 둔다 (조각만 보고 번역하지 않게)
      if(u.line && !unit.line) unit.line = u.line.trim();
      unit.at.push([name, u.runs, u.text, u.kind]);   // [파일, 번호들, 공백 포함 원문, 종류]
    }
  }

  const units = [...byText.values()];
  const doc = {
    source: path.basename(src),
    sourceLang: 'ko',
    createdAt: new Date().toISOString(),
    note: '각 unit 의 t 에 "언어코드": "번역문" 을 채운 뒤 apply.js 를 돌린다. text 는 고치지 않는다. '
        + 'line 이 있는 것은 한 줄에서 서식이 갈려 쪼개진 조각이다 — line(줄 전체)을 보고 앞뒤가 이어지게 옮긴다.',
    stats: {
      slides: targets.filter(n => n.startsWith('ppt/slides/')).length,
      units: total,
      unique: units.length,
      splitByFormat: units.filter(u => u.line).length,
    },
    units,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  console.log(`원문 추출 완료 → ${out}`);
  console.log(`  슬라이드 ${doc.stats.slides}장 · 번역 단위 ${doc.stats.units}개 (중복 제외 ${doc.stats.unique}개)`);
  if(doc.stats.splitByFormat){
    console.log(`  ※ 서식이 갈려 조각난 항목 ${doc.stats.splitByFormat}개 — line(줄 전체)을 보고 앞뒤가 이어지게 옮기세요`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

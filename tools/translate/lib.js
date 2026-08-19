/* ═══════════════════════════════════════════════════════════════
   PPT 번역 공용 로직 — 원문 보존이 최우선이다.

   왜 이렇게 만드는가:
   .pptx 는 사실 ZIP 파일이고, 화면에 보이는 글자는 전부 <a:t> 태그 안에 들어 있다.
   그래서 <a:t> 안의 글자만 갈아 끼우고 나머지 바이트는 손대지 않는다.
   레이아웃·글꼴·크기·색·이미지·도형·애니메이션은 건드릴 수가 없다 — 구조적으로 불가능하다.
   대표님 지시("번역만 하고 그 이상은 수정하지 말 것")를 코드 차원에서 보장하는 방식이다.

   번역 단위는 "문단 안의 한 줄 · 같은 서식끼리"다.

   ① PowerPoint 는 한 문장을 <a:r>(run) 여러 개로 쪼개 두는 일이 흔하다
      ("안녕" + "하세요"). run 하나씩 따로 번역하면 반드시 엉터리가 된다.
      그래서 </a:p> 와 <a:br/> 을 경계로 한 줄씩 묶는다.
   ② 다만 한 줄 안에서 서식(rPr)이 바뀌는 곳은 더 쪼갠다.
      "본부장 의견(금색 굵게) + 세 시장을…(흰색)" 같은 줄을 통째로 합쳐 첫 run 에 넣으면
      줄 전체가 금색으로 변한다 — 그건 번역이 아니라 서식 수정이다(실제로 한 번 냈다).
      같은 서식끼리만 묶으면 강조가 그대로 남는다.
      쪼개진 조각에는 line(줄 전체)을 같이 실어 보내 문맥을 잃지 않게 한다.

   되돌릴 때는 묶음의 첫 run 에 번역문을 넣고 그 묶음의 나머지 run 만 비운다.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const path = require('path');

// jszip 은 tools/docgen 에 이미 설치돼 있다. 같은 걸 또 받지 않는다.
let JSZip;
try { JSZip = require('jszip'); }
catch (e) { JSZip = require(path.join(__dirname, '..', 'docgen', 'node_modules', 'jszip')); }

/* 번역 대상 파일 — 슬라이드 본문 · 발표자 노트 · 차트 라벨 · SmartArt.
   슬라이드 마스터/레이아웃은 건드리지 않는다 (거기 글자는 화면에 안 나오는 안내문이다). */
const TARGET = /^ppt\/(slides\/slide\d+\.xml|notesSlides\/notesSlide\d+\.xml|charts\/chart\d+\.xml|diagrams\/data\d+\.xml)$/;

/* 문서 순서대로 훑는다: run 한 개 / 줄바꿈 / 문단 끝 */
const SCAN   = /(<a:r>[\s\S]*?<\/a:r>)|(<a:br\b[^>]*?\/?>)|(<\/a:p>)/g;
const IN_T   = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/;
const IN_RPR = /<a:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/;

/* 차트는 <a:t> 만으로 부족하다.
   범례와 항목 이름은 <c:v> 에 따로 캐시돼 있고 화면에는 그쪽이 그려진다.
   (실제로 한 번 놓쳤다 — 슬라이드는 스페인어인데 도넛 범례만 한국어로 남았다)
   숫자 값도 같은 <c:v> 를 쓰지만 글자가 없으면 걸러지므로 건드려지지 않는다. */
const V_SCAN = /<c:v>([^<]*)<\/c:v>/g;

// 글자가 하나라도 있어야 번역 대상이다. "2026", "%", "—" 같은 건 그대로 둔다.
const HAS_LETTER = /\p{L}/u;

const unesc = s => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');           // &amp; 를 마지막에 풀어야 이중 해제가 안 난다

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── 파일 하나 훑기 ──
   runs  : <a:t> 를 가진 run 목록 (문서 순서). 이 순서가 곧 번호다.
   units : 번역 단위. runs 의 번호 목록과 이어 붙인 원문. */
function scanXml(xml){
  const runs = [];
  const units = [];
  let cur = [];

  const flush = () => {
    if(cur.length){
      // 한 줄 안에서 서식이 같은 run 끼리 이어 붙인다. 서식이 바뀌면 거기서 끊는다.
      const groups = [];
      for(const i of cur){
        const last = groups[groups.length - 1];
        if(last && runs[last[last.length - 1]].rpr === runs[i].rpr) last.push(i);
        else groups.push([i]);
      }
      const line = cur.map(i => runs[i].text).join('');
      for(const g of groups){
        const text = g.map(i => runs[i].text).join('');
        // 서식이 갈린 줄에서만 line(줄 전체)을 문맥으로 함께 넘긴다
        if(HAS_LETTER.test(text)) units.push({ runs: g, text, line: groups.length > 1 ? line : null });
      }
    }
    cur = [];
  };

  SCAN.lastIndex = 0;
  let m;
  while((m = SCAN.exec(xml)) !== null){
    if(m[1]){
      const t = IN_T.exec(m[1]);
      if(!t) continue;                       // <a:t> 없는 run 은 번호를 주지 않는다
      runs.push({ text: unesc(t[1]), rpr: (IN_RPR.exec(m[1]) || [''])[0] });
      cur.push(runs.length - 1);
    }else{
      flush();                               // <a:br/> · </a:p> 에서 한 줄이 끝난다
    }
  }
  flush();
  return { runs, units };
}

/* ── 번역문을 되돌려 넣기 ──
   byIdx: { run번호: 새 글자 }. 목록에 없는 run 은 한 글자도 건드리지 않는다. */
function rewriteXml(xml, byIdx){
  let k = -1;
  SCAN.lastIndex = 0;
  return xml.replace(SCAN, (whole, rblock) => {
    if(!rblock || !IN_T.test(rblock)) return whole;
    k++;
    if(!Object.prototype.hasOwnProperty.call(byIdx, k)) return whole;
    return rblock.replace(IN_T, w => w.slice(0, w.indexOf('>') + 1) + esc(byIdx[k]) + '</a:t>');
  });
}

/* ── 차트 캐시(<c:v>) 훑기 ──
   번례·항목 이름은 한 칸이 곧 한 단위다. 문단처럼 이어 붙이지 않는다. */
function scanChartValues(xml){
  const units = [];
  let k = -1, m;
  V_SCAN.lastIndex = 0;
  while((m = V_SCAN.exec(xml)) !== null){
    k++;
    const text = unesc(m[1]);
    if(HAS_LETTER.test(text)) units.push({ runs: [k], text, line: null });
  }
  return units;
}

function rewriteChartValues(xml, byIdx){
  let k = -1;
  V_SCAN.lastIndex = 0;
  return xml.replace(V_SCAN, whole => {
    k++;
    return Object.prototype.hasOwnProperty.call(byIdx, k) ? `<c:v>${esc(byIdx[k])}</c:v>` : whole;
  });
}

const isChart = name => name.startsWith('ppt/charts/');

/* ── pptx 열기 ── */
async function openPptx(buf){
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir).sort();
  return { zip, names };
}

/* 슬라이드 번호 순으로 정렬한다 (slide10 이 slide2 앞에 오지 않게) */
function sortTargets(names){
  const num = n => (n.match(/(\d+)\.xml$/) || [0, 0])[1] | 0;
  const kind = n => n.startsWith('ppt/slides/') ? 0 : n.startsWith('ppt/notesSlides/') ? 1
                  : n.startsWith('ppt/charts/') ? 2 : 3;
  return names.filter(n => TARGET.test(n)).sort((a, b) => kind(a) - kind(b) || num(a) - num(b));
}

/* 사람이 읽는 위치 이름 — 번역할 때 문맥 파악용 */
function whereOf(name){
  const n = (name.match(/(\d+)\.xml$/) || [])[1];
  if(name.startsWith('ppt/slides/'))      return `슬라이드 ${n}`;
  if(name.startsWith('ppt/notesSlides/')) return `노트 ${n}`;
  if(name.startsWith('ppt/charts/'))      return `차트 ${n}`;
  return `도해 ${n}`;
}

/* ── 앞뒤 공백은 원문 그대로 유지한다 ──
   PowerPoint 는 run 끝의 공백 하나로 단어를 띄우는 경우가 있다. 그걸 없애면 글자가 붙는다. */
function keepPad(original, translated){
  const lead  = (original.match(/^\s*/) || [''])[0];
  const trail = (original.match(/\s*$/) || [''])[0];
  return lead + String(translated).trim() + trail;
}

module.exports = { JSZip, TARGET, scanXml, rewriteXml, scanChartValues, rewriteChartValues,
                   isChart, openPptx, sortTargets, whereOf, keepPad, unesc, esc };

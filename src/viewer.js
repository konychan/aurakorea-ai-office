/* ═══════════════════════════════════════════════════════════════
   보고서 뷰어 — 대표님이 결정하시기 전에 "무엇을 했는지" 열어 보는 창

   결재·승인 버튼만 있고 내용을 볼 수 없으면 판단하실 근거가 없다.
   그래서 모든 보고·안건에 [내용 보기]를 붙이고, 열린 창에서 바로 내려받을 수 있게 한다.

   ★ AI를 호출하지 않는다. 이미 만들어진 내용을 보여주고 파일로 저장할 뿐이다.
   ═══════════════════════════════════════════════════════════════ */
import { STAFF } from '../data/staff.js';
import { TEAMS } from '../data/teams.js';
import { CEO, HQ_MANAGER, COMPANY } from '../data/layout.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const teamName = id => (TEAMS.find(t => t.id === id) || {}).name || id || '';

/* 실제로 만들어 둔 파일 — 사이트가 files/ 를 서빙하므로 그대로 내려받을 수 있다.
   보고서에 적힌 산출물 경로를 여기 있는 실물 파일과 연결한다. */
const REAL_FILES = {
  'data/agent-results.json': { name: '시장조사 원본 데이터 (JSON)', url: '/data/agent-results.json' },
};
const DOC_FILES = [
  { name: '2026 하반기 3대 수출시장 브리핑 (PowerPoint)', url: '/files/2026-하반기-3대-수출시장-브리핑.pptx', kind: 'ppt' },
  { name: '3대 수출시장 비교표 (Excel)',                  url: '/files/3대-수출시장-비교표.xlsx',           kind: 'xls' },
  { name: '2026 하반기 3대 수출시장 브리핑 (Word)',        url: '/files/2026-하반기-3대-수출시장-브리핑.docx', kind: 'doc' },
];

/* ── 창 껍데기 ── */
function modal(title, bodyHTML, footHTML){
  const wrap = document.createElement('div');
  wrap.className = 'vwModal';
  wrap.innerHTML = `
    <div class="vwCard">
      <div class="vwHead">
        <h4>${esc(title)}</h4>
        <button class="vwX" title="닫기">×</button>
      </div>
      <div class="vwBody">${bodyHTML}</div>
      <div class="vwFoot">${footHTML || ''}</div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if(e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.vwX').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  return { wrap, close };
}

/* ── 내려받기: 화면에서 본 그대로를 파일로 저장한다 ──
   서버가 필요 없다. 브라우저 안에서 파일을 만들어 바로 저장한다. */
function downloadHTML(filename, title, innerHTML){
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;color:#0E1A17;background:#FAF8F4;
       max-width:820px;margin:0 auto;padding:44px 32px;line-height:1.75}
  .doc__brand{font-size:11px;letter-spacing:4px;color:#C8A45C;font-weight:700}
  h1{font-size:22px;margin:14px 0 4px;border-bottom:3px solid #123B34;padding-bottom:12px}
  .doc__meta{font-size:12px;color:#7A8A85;margin-bottom:26px}
  h2{font-size:13px;color:#123B34;margin:26px 0 6px}
  p,li{font-size:13px}
  .k{background:#D8F0E6;border-left:4px solid #2FA8A0;padding:11px 14px;border-radius:0 6px 6px 0;margin:0 0 16px}
  .w{background:#FDF0DC;border:1px solid #E8C48A;padding:11px 14px;border-radius:6px;color:#8A4A12}
  ul{padding-left:20px;margin:6px 0}
  a{color:#1C554A}
  .doc__foot{margin-top:34px;padding-top:12px;border-top:1px solid #E2DCD1;font-size:11px;color:#7A8A85}
  @media print{body{background:#fff;padding:0}}
</style></head><body>
<div class="doc__brand">${esc(COMPANY.name)}</div>
${innerHTML}
<div class="doc__foot">${esc(COMPANY.nameKo)} · 내려받은 시각 ${new Date().toLocaleString('ko-KR')}<br>
브라우저에서 열어 보시거나, 인쇄(Ctrl+P) → "PDF로 저장" 하시면 PDF가 됩니다.</div>
</body></html>`;

  const blob = new Blob(['﻿', page], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_') + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ── 첨부 파일 목록 ── */
function filesBlock(item){
  const list = [];
  (item.files || []).forEach(f => {
    if(typeof f === 'object' && f.url) list.push(f);
    else if(REAL_FILES[f]) list.push(REAL_FILES[f]);
    else list.push({ name: f, url: null });
  });
  // 문서제작 담당 보고에는 실제로 만든 문서를 붙여 드린다
  if(item.worker === '강태오' || /문서|자료|제안서|브리핑|비교표/.test(item.title || '')){
    DOC_FILES.forEach(f => { if(!list.some(x => x.url === f.url)) list.push(f); });
  }
  if(!list.length) return '';
  return `
    <h2 class="vwH">첨부 파일</h2>
    <div class="vwFiles">${list.map(f => f.url
      ? `<a class="vwFile${f.kind ? ' ' + f.kind : ''}" href="${esc(f.url)}" download>
           <span class="vwFile__ic">${f.kind ? f.kind.toUpperCase() : '파일'}</span>
           <span class="vwFile__n">${esc(f.name)}</span>
           <span class="vwFile__d">내려받기</span>
         </a>`
      : `<div class="vwFile off"><span class="vwFile__ic">경로</span>
           <span class="vwFile__n">${esc(f.name)}</span>
           <span class="vwFile__d">파일 없음</span></div>`
    ).join('')}</div>`;
}

/* ═══════════ 1) 보고 내용 보기 ═══════════ */
export function openReport(item){
  const s = STAFF.find(x => x.n === item.worker);
  const sec = (h, v) => v ? `<h2 class="vwH">${h}</h2><div class="vwP">${v}</div>` : '';

  const body = `
    <div class="vwMeta">
      <span><b>${esc(item.reporter)}</b> 팀장 보고</span>
      <span>${esc(teamName(item.team))}</span>
      <span class="vwOk">✓ ${esc(HQ_MANAGER.name)} 본부장 검토 완료</span>
    </div>
    <div class="vwTitle">${esc(item.title)}</div>
    ${sec('수행한 사람', `${esc(item.worker)}${s ? ` · ${esc(s.rank)} · ${esc(s.r)}` : ''}`)}
    ${sec('한 일과 결과', br(item.result))}
    ${item.sources?.length ? `<h2 class="vwH">근거 · 출처</h2>
      <ul class="vwSrc">${item.sources.map(x =>
        `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ul>` : ''}
    ${sec('검증', br(item.tests))}
    ${item.uncertain ? `<h2 class="vwH">불확실한 점</h2><div class="vwWarn">${br(item.uncertain)}</div>` : ''}
    ${item.needsDecision ? `<h2 class="vwH">대표님 결정이 필요한 것</h2><div class="vwAsk">${br(item.needsDecision)}</div>` : ''}
    ${filesBlock(item)}`;

  const { wrap, close } = modal('보고 내용', body, `
    <span class="vwNote">확인하신 뒤 창을 닫고 결정해 주십시오.</span>
    <button class="vwDown">이 보고서 내려받기</button>
    <button class="vwClose">닫기</button>`);

  wrap.querySelector('.vwClose').onclick = close;
  wrap.querySelector('.vwDown').onclick = () => {
    downloadHTML(`보고서_${item.title}`, item.title, `
      <h1>${esc(item.title)}</h1>
      <div class="doc__meta">${esc(item.reporter)} 팀장 보고 · ${esc(teamName(item.team))} ·
        수행 ${esc(item.worker)}${s ? ` (${esc(s.rank)})` : ''} · ${esc(HQ_MANAGER.name)} 본부장 검토 완료</div>
      <h2>한 일과 결과</h2><p>${br(item.result)}</p>
      ${item.sources?.length ? `<h2>근거 · 출처</h2><ul>${item.sources.map(x =>
        `<li><a href="${esc(x.url)}">${esc(x.title)}</a></li>`).join('')}</ul>` : ''}
      ${item.tests ? `<h2>검증</h2><p>${br(item.tests)}</p>` : ''}
      ${item.uncertain ? `<h2>불확실한 점</h2><div class="w">${br(item.uncertain)}</div>` : ''}
      ${item.needsDecision ? `<h2>${esc(CEO.name)} 대표님 결정이 필요한 것</h2><div class="k">${br(item.needsDecision)}</div>` : ''}`);
  };
}

/* ═══════════ 2) 결재 안건 보기 ═══════════ */
export function openAgenda(item){
  const s = STAFF.find(x => x.n === item.name);
  const body = `
    <div class="vwMeta">
      <span><b>${esc(item.name)}</b>${s ? ` · ${esc(s.rank)}` : ''} 상신</span>
      <span>${esc(teamName(item.team))}</span>
    </div>
    <div class="vwTitle">${esc(item.title)}</div>
    ${item.why ? `<h2 class="vwH">어떤 건인지</h2><div class="vwP">${br(item.why)}</div>` : ''}
    ${item.point ? `<h2 class="vwH">대표님이 정해 주셔야 할 것</h2><div class="vwAsk">${br(item.point)}</div>` : ''}
    <div class="vwHint">승인하시면 담당자가 그대로 진행하고, 반려하시면 다시 검토합니다.</div>`;

  const { wrap, close } = modal('결재 안건', body, `
    <span class="vwNote">확인하신 뒤 창을 닫고 승인/반려를 눌러 주십시오.</span>
    <button class="vwDown">이 안건 내려받기</button>
    <button class="vwClose">닫기</button>`);

  wrap.querySelector('.vwClose').onclick = close;
  wrap.querySelector('.vwDown').onclick = () => {
    downloadHTML(`결재안건_${item.title}`, item.title, `
      <h1>${esc(item.title)}</h1>
      <div class="doc__meta">${esc(item.name)}${s ? ` (${esc(s.rank)})` : ''} 상신 · ${esc(teamName(item.team))}</div>
      ${item.why ? `<h2>어떤 건인지</h2><p>${br(item.why)}</p>` : ''}
      ${item.point ? `<h2>${esc(CEO.name)} 대표님이 정해 주셔야 할 것</h2><div class="k">${br(item.point)}</div>` : ''}`);
  };
}

/* ═══════════ 3) 만든 문서 보기 (미리보기 + 실제 파일) ═══════════ */
export async function openDocuments(){
  let folio = null;
  try{
    const res = await fetch('/data/doc-portfolio.json', { cache:'no-store' });
    folio = await res.json();
  }catch(e){ /* 목록을 못 읽어도 파일 내려받기는 되게 한다 */ }

  const shots = (folio?.items || []).flatMap(it => it.shots || []);
  // 받는 링크를 맨 위에 둔다 — 미리보기를 다 내려야 파일이 나오면 안 된다
  const body = `
    <div class="vwTitle">문서제작실이 만든 자료</div>
    ${filesBlock({ worker: '강태오', files: [] })}
    <h2 class="vwH">미리보기</h2>
    <div class="vwHint">실제 파일을 그대로 렌더한 이미지입니다.</div>
    ${shots.length ? `<div class="vwShots">${shots.map(sh =>
      `<figure><img src="${esc(sh.src)}" alt="${esc(sh.cap)}" loading="lazy"><figcaption>${esc(sh.cap)}</figcaption></figure>`
    ).join('')}</div>` : ''}`;

  const { wrap, close } = modal('만든 문서 보기', body, `
    <span class="vwNote">받으신 파일은 PowerPoint · Excel · Word 에서 바로 열립니다.</span>
    <button class="vwClose">닫기</button>`);
  wrap.querySelector('.vwClose').onclick = close;
}

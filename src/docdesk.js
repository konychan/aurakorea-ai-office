/* ═══════════════════════════════════════════════════════════════
   문서 제작 요청 — 대표님이 강태오에게 일을 시키는 창구

   왜 "요청서 폼"인가:
   브라우저는 진짜 .pptx / .xlsx / .docx 파일을 만들 수 없다. 실제 파일은
   본부장이 tools/docgen 툴체인을 돌려야 나온다. 그래서 이 화면이 하는 일은
   "대표님 머릿속의 요구를, 되묻지 않고 한 번에 만들 수 있는 작업지시서로 바꾸는 것"이다.
   되물을수록 토큰이 든다. 처음부터 빠짐없이 받는 게 곧 절약이다.

   ★ AI를 호출하지 않는다. 요청 접수·저장·표시 전부 화면 안에서 끝난다.
   ═══════════════════════════════════════════════════════════════ */
import { STAFF } from '../data/staff.js';
import { DOC_STUDIO, HQ_MANAGER } from '../data/layout.js';
import { $, state, paint, log, select } from './office.js';
import { getSimMin } from './sim.js';

const KEY = 'aurakorea.docRequests';
const OWNER = DOC_STUDIO.owner;

const TYPE_META = {
  PPT:   { cls:'ppt', tag:'PPT', label:'PowerPoint', hint:'발표·제안용. 한 장에 메시지 하나로 만듭니다.' },
  Excel: { cls:'xls', tag:'XLS', label:'Excel',      hint:'표·계산·비교용. 수식과 조건부서식까지 넣습니다.' },
  Word:  { cls:'doc', tag:'DOC', label:'Word',       hint:'문서·계약·소개서용. 인쇄해도 손색없게 조판합니다.' },
};

/* ── 저장 (대표님이 새로고침해도 요청이 남아 있어야 한다) ── */
function load(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; }
}
function save(list){
  try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch(e){ /* 저장 실패해도 화면은 돌아간다 */ }
}

let requests = load();

/* ── 도면 위 대기열 표시 ── */
export function renderDocQueue(){
  const box = $('docQueue');
  if(!box) return;
  const open = requests.filter(r => r.status === '대기');
  box.innerHTML = open.slice(0, 3).map(r =>
    `<div class="dsReq ${TYPE_META[r.type].cls}"><b>${TYPE_META[r.type].tag}</b>${esc(r.title).slice(0,14)}</div>`
  ).join('') + (open.length > 3 ? `<div class="dsReq"><b>+</b>${open.length - 3}건 더</div>` : '');

  const st = $('docState');
  if(st){
    st.textContent = open.length ? `요청 ${open.length}건` : '대기';
    st.className = 'roomState ' + (open.length ? 'busy' : 'idle');
  }
}

function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ── 작업지시서 만들기 ──
   본부장이 이것만 보고 되묻지 않고 바로 만들 수 있도록 항목을 고정한다. */
function workOrder(r){
  return [
    `[문서 제작 요청]`,
    `종류: ${TYPE_META[r.type].label}`,
    `제목: ${r.title}`,
    `용도: ${r.purpose || '(미기재)'}`,
    `받는 사람: ${r.audience || '(미기재)'}`,
    `분량: ${r.size || '(맡김)'}`,
    `기한: ${r.due || '(미기재)'}`,
    ``,
    `담을 내용:`,
    r.content || '(대표님이 별도로 전달)',
    ``,
    `참고: 아우라코리아 디자인 기준(tools/docgen/brand.js)을 따르고,`,
    `만든 뒤 렌더해서 눈으로 검수한 다음 올릴 것.`,
    `접수 ${r.at} · 담당 ${OWNER}`,
  ].join('\n');
}

/* ── 요청서 창 ── */
function openForm(type, presetTitle = ''){
  const m = TYPE_META[type];
  if(!m) return;
  const wrap = document.createElement('div');
  wrap.className = 'dsModal';
  wrap.innerHTML = `
    <div class="dsCard">
      <h4><span class="dsCard__tag ${m.cls}">${m.tag}</span>${m.label} 제작 요청
        <button class="dsX" title="닫기">×</button></h4>
      <p class="dsHint">${m.hint}</p>
      <label>제목 <span>*</span>
        <input id="dqTitle" value="${esc(presetTitle)}" placeholder="예) 스페인 바이어 제안서">
      </label>
      <label>어디에 쓰시나요
        <input id="dqPurpose" placeholder="예) 다음 주 화상미팅에서 화면 공유">
      </label>
      <div class="dsRow">
        <label>받는 사람
          <input id="dqAudience" placeholder="예) 스페인 유통사 구매담당">
        </label>
        <label>기한
          <input id="dqDue" placeholder="예) 이번 주 금요일">
        </label>
      </div>
      <label>분량
        <input id="dqSize" placeholder="예) 10장 내외 / 비우시면 제가 정합니다">
      </label>
      <label>담을 내용 · 자료
        <textarea id="dqContent" rows="4" placeholder="넣을 내용을 적어 주세요. 파일로 주실 거면 '파일 별도 전달'이라고만 적으셔도 됩니다."></textarea>
      </label>
      <div class="dsActions">
        <button class="dsCancel">취소</button>
        <button class="dsOk">요청하기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('.dsX').onclick = close;
  wrap.querySelector('.dsCancel').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  const title = wrap.querySelector('#dqTitle');
  title.focus();
  wrap.querySelector('.dsOk').onclick = () => {
    if(!title.value.trim()){ title.focus(); title.classList.add('need'); return; }
    submit({
      type,
      title:    title.value.trim(),
      purpose:  wrap.querySelector('#dqPurpose').value.trim(),
      audience: wrap.querySelector('#dqAudience').value.trim(),
      due:      wrap.querySelector('#dqDue').value.trim(),
      size:     wrap.querySelector('#dqSize').value.trim(),
      content:  wrap.querySelector('#dqContent').value.trim(),
    });
    close();
  };
  wrap.querySelector('.dsCard').onkeydown = e => { if(e.key === 'Escape') close(); };
}

/* ── 접수 ── */
function submit(data){
  const simMin = getSimMin();
  const r = {
    ...data,
    id: 'req' + Date.now(),
    status: '대기',
    at: new Date().toLocaleString('ko-KR'),
  };
  requests = [r, ...requests];
  save(requests);

  const st = state[OWNER];
  if(st){
    st.st = '처리중';
    st.bubble = `${TYPE_META[r.type].label} 제작 착수`;
    st.bt = simMin;
    st.done++;
  }
  log(simMin, `${HQ_MANAGER.name} 본부장`, `대표님 문서 제작 요청을 ${OWNER}에게 전달했습니다 — "${r.title}"`);
  log(simMin, OWNER, `${TYPE_META[r.type].label} "${r.title}" 제작을 시작합니다.`);
  renderDocQueue();
  paint(simMin);
  select(OWNER, simMin);

  // 접수 즉시 작업지시서를 보여 준다 — 대표님은 이걸 복사해 본부장에게 주시면 된다
  showOrder(r);
}

/* ── 작업지시서 표시 + 복사 ── */
function showOrder(r){
  const text = workOrder(r);
  const wrap = document.createElement('div');
  wrap.className = 'dsModal';
  wrap.innerHTML = `
    <div class="dsCard">
      <h4>작업지시서 <button class="dsX" title="닫기">×</button></h4>
      <p class="dsHint">아래 내용을 <b>복사해서 본부장(저)에게 붙여넣어 주시면</b> 실제 파일을 만들어 드립니다.
        브라우저는 진짜 파일을 만들 수 없어서, 파일 제작은 본부장이 직접 합니다.</p>
      <pre class="dsOrder" id="dsOrderText">${esc(text)}</pre>
      <div class="dsActions">
        <button class="dsCancel">닫기</button>
        <button class="dsOk" id="dsCopy">복사하기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('.dsX').onclick = close;
  wrap.querySelector('.dsCancel').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  wrap.querySelector('#dsCopy').onclick = async e => {
    try{
      await navigator.clipboard.writeText(text);
      e.target.textContent = '복사했습니다';
    }catch(err){
      // 클립보드 권한이 없으면 직접 고르실 수 있게 전체 선택만 해 드린다
      const range = document.createRange();
      range.selectNodeContents($('dsOrderText'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      e.target.textContent = '직접 복사해 주세요 (Ctrl+C)';
    }
  };
}

/* ── 상세 패널용: 요청 목록 ── */
export function requestListHTML(){
  if(!requests.length) return '';
  return `<div class="dsList">
    <b>대표님 제작 요청 <span>${requests.length}건</span></b>
    ${requests.slice(0, 6).map(r => `
      <div class="dsListItem">
        <span class="dsListTag ${TYPE_META[r.type].cls}">${TYPE_META[r.type].tag}</span>
        <div>
          <i>${esc(r.title)}</i>
          <em>${esc(r.at)}${r.due ? ' · 기한 ' + esc(r.due) : ''}</em>
        </div>
        <button class="dsListBtn" data-order="${r.id}">지시서</button>
      </div>`).join('')}
  </div>`;
}

// 상세 패널이 다시 그려질 때마다 "지시서" 버튼을 연결한다
export function bindRequestList(root){
  (root || document).querySelectorAll('[data-order]').forEach(b => {
    b.onclick = () => {
      const r = requests.find(x => x.id === b.dataset.order);
      if(r) showOrder(r);
    };
  });
}

/* 지시창에서 "@강태오 …" 로 들어온 요청 — 종류만 고르면 되도록 제목을 채워 띄운다 */
export function openRequestFor(text){
  const wrap = document.createElement('div');
  wrap.className = 'dsModal';
  wrap.innerHTML = `
    <div class="dsCard dsPick">
      <h4>어떤 형식으로 만들까요? <button class="dsX" title="닫기">×</button></h4>
      <p class="dsHint">${text ? `요청: <b>${esc(text)}</b>` : '형식을 고르시면 요청서가 열립니다.'}</p>
      <div class="dsPickRow">
        ${Object.entries(TYPE_META).map(([k, m]) => `
          <button class="dsPickBtn ${m.cls}" data-pick="${k}">
            <b>${m.tag}</b><i>${m.label}</i><em>${m.hint}</em>
          </button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('.dsX').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  wrap.querySelectorAll('[data-pick]').forEach(b => {
    b.onclick = () => { close(); openForm(b.dataset.pick, text); };
  });
}

export function initDocDesk(){
  document.querySelectorAll('.dsBtn').forEach(b => {
    b.onclick = () => openForm(b.dataset.doc);
  });
  renderDocQueue();
}

/* ═══════════════════════════════════════════════════════════════
   번역 의뢰 창구 — 대표님이 PPT 를 올려 번역팀에 일을 맡기시는 곳

   대표님 지시:
     "내가 한국어로 PPT 주면, 그 요청하는 언어로 완벽하게 번역해라.
      단, 번역만 하는 거지 그 이상은 수정하면 안 된다."

   그래서 이 화면이 하는 일은 딱 둘이다.
     ① 파일을 사무실 안(tools/translate/inbox/)으로 들여놓는다
     ② 어떤 언어로 옮길지, 지켜야 할 용어가 있는지를 받아 작업지시서로 만든다

   실제 번역은 번역팀이 `tools/translate` 도구로 수행한다.
   그 도구는 <a:t>(글자) 만 갈아 끼우므로 레이아웃·서식·이미지는 구조적으로 바뀌지 않는다.

   ★ AI를 호출하지 않는다. 접수·저장·표시 전부 화면 안에서 끝난다.
   ═══════════════════════════════════════════════════════════════ */
import { LANGS, langName } from '../data/langs.js';
import { HQ_MANAGER } from '../data/layout.js';
import { STAFF } from '../data/staff.js';
import { $, state, paint, log, select } from './office.js';
import { getSimMin } from './sim.js';

const KEY = 'aurakorea.transJobs';
const MAX_MB = 25;

// 실무 담당(과장)에게 접수되고, 검수는 팀장이 한다
const WORKER = (STAFF.find(s => s.t === 'trans' && s.rank === '과장') || {}).n || '송하린';
const LEADER = (STAFF.find(s => s.t === 'trans' && s.rank === '팀장') || {}).n || '차유진';

const load = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; } };
const save = l => { try{ localStorage.setItem(KEY, JSON.stringify(l.slice(0, 100))); }catch(e){} };

let jobs = load();

function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ── 도면 위 번역실 상태 ── */
export function renderTransState(){
  const el = $('transState');
  if(!el) return;
  const open = jobs.filter(j => j.status === '대기').length;
  el.textContent = open ? `번역 ${open}건` : '대기';
  el.classList.toggle('busy', open > 0);
}

/* ── 작업지시서 ──
   본부장이 이것만 보고 되묻지 않고 바로 돌릴 수 있도록 항목을 고정한다. */
function workOrder(j){
  return [
    `[PPT 번역 요청]`,
    `파일: ${j.file}${j.saved ? ` (사무실에 저장됨: tools/translate/inbox/${j.file})` : ' (파일은 대표님이 따로 전달)'}`,
    `크기: ${j.size}`,
    `번역할 언어: ${j.langs.map(c => `${langName(c)} [${c}]`).join(', ')}`,
    `지켜야 할 용어·주의: ${j.note || '(없음)'}`,
    ``,
    `절대 원칙 — 번역만 한다. 그 이상은 손대지 않는다.`,
    `· 내용을 더하거나 빼지 않는다. 어색해도 다듬지 않는다`,
    `· 슬라이드 장수·순서·레이아웃·글꼴·색·이미지를 바꾸지 않는다`,
    `· 브랜드명·인명·규정명(ANMAT, CPNP, GMP, CFS)·HS코드·단위·통화는 원문 그대로 둔다`,
    ``,
    `수행 방법 (스킬: ppt-translate)`,
    `  1) node tools/translate/extract.js "tools/translate/inbox/${j.file}"`,
    `  2) work/*.strings.json 의 각 unit.t 에 언어별 번역문을 채운다`,
    ...j.langs.map(c => `  3) node tools/translate/apply.js "tools/translate/inbox/${j.file}" <strings.json> --lang ${c}`),
    `  4) 렌더해서 눈으로 검수 → ${LEADER} 팀장 검수 → 본부장 검토 → 대표님 보고`,
    ``,
    `접수 ${j.at} · 담당 ${WORKER} · 검수 ${LEADER}`,
  ].join('\n');
}

/* ═══════════ 업로드 창 ═══════════ */
export function openUpload(preset = ''){
  const chosen = new Set(['es-AR']);        // 아르헨티나가 가장 자주 쓰인다 — 기본으로 켜 둔다
  const core = LANGS.filter(l => l.core);
  const rest = LANGS.filter(l => !l.core);

  const wrap = document.createElement('div');
  wrap.className = 'dsModal';
  wrap.innerHTML = `
    <div class="dsCard trCard">
      <h4><span class="dsCard__tag tr">번역</span>PPT 번역 맡기기
        <button class="dsX" title="닫기">×</button></h4>
      <p class="dsHint">파일을 올리시면 <b>번역만</b> 해서 돌려드립니다.
        내용·디자인·슬라이드 구성은 손대지 않습니다.</p>

      <label>번역할 파일 <span>*</span>
        <div class="trDrop" id="tqDrop">
          <input type="file" id="tqFile" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation">
          <span class="trDrop__hint">.pptx 파일을 고르거나 여기로 끌어다 놓으세요 (최대 ${MAX_MB}MB)</span>
        </div>
      </label>

      <label>어떤 언어로 옮길까요 <span>*</span></label>
      <div class="trLangs" id="tqLangs"></div>
      <div class="trAdd">
        <select id="tqMore">
          <option value="">+ 다른 언어 추가…</option>
          ${rest.map(l => `<option value="${l.code}">${l.ko}</option>`).join('')}
          <option value="__custom">직접 입력 (목록에 없는 언어)</option>
        </select>
      </div>

      <label>지켜야 할 용어 · 주의사항
        <textarea id="tqNote" rows="3" placeholder="예) 브랜드명은 그대로. 'Dr.SANTE'는 번역하지 마세요. 바이어 제안용입니다.">${esc(preset)}</textarea>
      </label>

      <div class="trWarn">번역만 합니다. 문장을 다듬거나 슬라이드를 고치지 않습니다.</div>
      <div class="dsActions">
        <button class="dsCancel">취소</button>
        <button class="dsOk" id="tqSend">번역 맡기기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.querySelector('.dsX').onclick = close;
  wrap.querySelector('.dsCancel').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  wrap.querySelector('.trCard').onkeydown = e => { if(e.key === 'Escape') close(); };

  /* 언어 칩 — 자주 쓰는 3개는 항상 보이고, 추가한 언어도 칩으로 붙는다 */
  const langBox = wrap.querySelector('#tqLangs');
  const drawLangs = () => {
    const extra = [...chosen].filter(c => !core.some(l => l.code === c));
    langBox.innerHTML = [
      ...core.map(l => ({ code: l.code, label: l.ko, core: true })),
      ...extra.map(c => ({ code: c, label: langName(c), core: false })),
    ].map(x => `<button type="button" class="trChip${chosen.has(x.code) ? ' on' : ''}${x.core ? ' core' : ''}"
                        data-lang="${esc(x.code)}">${esc(x.label)}<em>${esc(x.code)}</em></button>`).join('');
    langBox.querySelectorAll('[data-lang]').forEach(b => {
      b.onclick = () => {
        const c = b.dataset.lang;
        if(chosen.has(c)) chosen.delete(c); else chosen.add(c);
        drawLangs();
      };
    });
  };
  drawLangs();

  wrap.querySelector('#tqMore').onchange = e => {
    const v = e.target.value;
    e.target.value = '';
    if(!v) return;
    if(v === '__custom'){
      const code = prompt('언어 코드를 입력하세요 (예: sv, cs, he, uk)');
      if(code && code.trim()) chosen.add(code.trim());
    }else{
      chosen.add(v);
    }
    drawLangs();
  };

  /* 끌어다 놓기 */
  const drop = wrap.querySelector('#tqDrop');
  const fileEl = wrap.querySelector('#tqFile');
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if(f) fileEl.files = e.dataTransfer.files;
    if(f) drop.querySelector('.trDrop__hint').textContent = f.name;
  });
  fileEl.onchange = () => {
    const f = fileEl.files[0];
    if(f) drop.querySelector('.trDrop__hint').textContent = f.name;
  };

  const send = wrap.querySelector('#tqSend');
  send.onclick = async () => {
    const f = fileEl.files[0];
    if(!f){ drop.classList.add('need'); return; }
    if(!/\.pptx$/i.test(f.name)){
      drop.classList.add('need');
      drop.querySelector('.trDrop__hint').textContent = '.pptx 파일만 받습니다 (.ppt 는 PowerPoint에서 .pptx로 저장해 주세요)';
      return;
    }
    if(f.size > MAX_MB * 1024 * 1024){
      drop.classList.add('need');
      drop.querySelector('.trDrop__hint').textContent = `${MAX_MB}MB 를 넘습니다 — 파일을 나눠 주세요`;
      return;
    }
    if(!chosen.size){ langBox.classList.add('need'); return; }

    send.disabled = true;
    send.textContent = '올리는 중…';
    const note = wrap.querySelector('#tqNote').value.trim();
    await submit(f, [...chosen], note);
    close();
  };
}

/* ═══════════ 접수 ═══════════ */
async function submit(file, langs, note){
  const size = (file.size / 1024 / 1024).toFixed(1) + 'MB';
  const saved = await upload(file, langs, note);

  const j = {
    id: 'tr' + Date.now(),
    file: file.name,
    size,
    langs,
    note,
    saved,                       // true = 사무실 서버가 파일을 저장했다
    status: '대기',
    at: new Date().toLocaleString('ko-KR'),
  };
  jobs = [j, ...jobs];
  save(jobs);

  const simMin = getSimMin();
  const st = state[WORKER];
  if(st){
    st.st = '처리중';
    st.bubble = `${langName(langs[0])} 번역 착수`;
    st.bt = simMin;
    st.done++;
  }
  log(simMin, `${HQ_MANAGER.name} 본부장`,
      `대표님 번역 요청을 ${WORKER}에게 전달했습니다 — "${file.name}" → ${langs.map(langName).join(', ')}`);
  log(simMin, WORKER, `"${file.name}" 번역을 시작합니다. 원문은 손대지 않고 글자만 옮깁니다.`);
  renderTransState();
  paint(simMin);
  select(WORKER, simMin);

  showOrder(j);
}

/* 파일을 사무실 안으로 들여놓는다.
   로컬(사무실 서버가 켜진 상태)에서는 tools/translate/inbox/ 에 바로 저장된다.
   배포본(Vercel)에는 저장할 곳이 없으므로 false 를 돌려주고, 대표님은 지시서를 복사해 전달하신다. */
async function upload(file, langs, note){
  try{
    const b64 = await toBase64(file);
    const res = await fetch('/api/translate-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, langs, note, data: b64 }),
    });
    if(!res.ok) return false;
    const j = await res.json().catch(() => ({}));
    return j.ok === true;
  }catch(e){
    return false;      // 서버가 없으면 조용히 복사 전달 방식으로 넘어간다
  }
}

function toBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ═══════════ 작업지시서 표시 + 복사 ═══════════ */
function showOrder(j){
  const text = workOrder(j);
  const wrap = document.createElement('div');
  wrap.className = 'dsModal';
  wrap.innerHTML = `
    <div class="dsCard">
      <h4>번역 작업지시서 <button class="dsX" title="닫기">×</button></h4>
      <p class="dsHint">${j.saved
        ? `파일이 사무실에 저장됐습니다 (<b>tools/translate/inbox/${esc(j.file)}</b>).
           번역팀이 다음 작업 때 처리해 올립니다.`
        : `이 화면에서는 파일을 사무실에 저장할 수 없습니다.
           아래 지시서를 <b>복사해서 본부장(저)에게 파일과 함께</b> 주시면 번역해 드립니다.`}</p>
      <pre class="dsOrder" id="trOrderText">${esc(text)}</pre>
      <div class="dsActions">
        <button class="dsCancel">닫기</button>
        <button class="dsOk" id="trCopy">복사하기</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('.dsX').onclick = close;
  wrap.querySelector('.dsCancel').onclick = close;
  wrap.onclick = e => { if(e.target === wrap) close(); };
  wrap.querySelector('#trCopy').onclick = async e => {
    try{
      await navigator.clipboard.writeText(text);
      e.target.textContent = '복사했습니다';
    }catch(err){
      const range = document.createRange();
      range.selectNodeContents($('trOrderText'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      e.target.textContent = '직접 복사해 주세요 (Ctrl+C)';
    }
  };
}

/* ═══════════ 상세 패널용 목록 ═══════════ */
export function jobListHTML(){
  if(!jobs.length) return '';
  return `<div class="dsList">
    <b>대표님 번역 요청 <span>${jobs.length}건</span></b>
    ${jobs.slice(0, 6).map(j => `
      <div class="dsListItem">
        <span class="dsListTag tr">${esc(j.langs[0])}</span>
        <div>
          <i>${esc(j.file)}</i>
          <em>${esc(j.at)} · ${j.langs.map(c => esc(langName(c))).join(', ')}</em>
        </div>
        <button class="dsListBtn" data-trorder="${j.id}">지시서</button>
      </div>`).join('')}
  </div>`;
}

export function bindJobList(root){
  (root || document).querySelectorAll('[data-trorder]').forEach(b => {
    b.onclick = () => {
      const j = jobs.find(x => x.id === b.dataset.trorder);
      if(j) showOrder(j);
    };
  });
}

/* 지시창에서 "@송하린 …" 로 들어온 요청 — 주의사항을 채워 업로드 창을 띄운다 */
export function openTranslateFor(text){
  openUpload(text || '');
}

export function initTransDesk(){
  const btn = $('transUploadBtn');
  if(btn) btn.onclick = () => openUpload();
  renderTransState();
}

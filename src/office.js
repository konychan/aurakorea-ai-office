import { TEAMS } from '../data/teams.js';
import { STAFF } from '../data/staff.js';
import { CEO, CEO_ROOM, CEO_QUEUE, ENTRANCE, WORK_HOURS, SIM_WINDOW } from '../data/layout.js';

/* ===================== 공용 유틸 (시계 표기) ===================== */
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2,'0');
export const hhmm = m => pad(Math.floor(m/60)%24)+':'+pad(m%60);
export const toMin = t => (+t.slice(0,2))*60 + (+t.slice(3));

/* ===================== 런타임 상태 ===================== */
export const state = {};
STAFF.forEach(s=>{ state[s.n] = { st:'미출근', done:0, bubble:null, bt:0 }; });

export let selected = null;

/* ===================== 결재 큐 (직원 안건 → 대표 승인/반려) ===================== */
export const agendaQueue = [];
let agendaSeq = 1;

export function submitAgenda(name, title, simMin){
  const s = STAFF.find(x=>x.n===name);
  const item = { id: agendaSeq++, name, team: s.t, title, simMin };
  agendaQueue.push(item);
  state[name].st = '보고대기';
  state[name].bubble = title;
  state[name].bt = simMin;
  renderAgenda();
  return item;
}

export function resolveAgenda(id, approved, simMin){
  const idx = agendaQueue.findIndex(a=>a.id===id);
  if(idx<0) return;
  const item = agendaQueue[idx];
  agendaQueue.splice(idx,1);
  const st = state[item.name];
  st.st = '근무중'; st.bt = simMin;
  st.bubble = approved ? '승인 완료' : '반려됨';
  if(approved) st.done++;
  log(simMin, '대표', `"${item.title}" (${item.name}) ${approved?'승인':'반려'}.`);
  renderAgenda();
  paint(simMin);
}

function renderAgenda(){
  const el = $('agendaQueue');
  if(!el) return;
  $('agendaBadge').textContent = agendaQueue.length;
  el.innerHTML = agendaQueue.length
    ? agendaQueue.map(a=>`
      <div class="agenda">
        <div class="agenda__t"><b>${a.name}</b><span>${hhmm(a.simMin)}</span></div>
        <div class="agenda__m">${a.title}</div>
        <div class="agenda__btns">
          <button class="ok" data-act="approve" data-id="${a.id}">승인</button>
          <button class="no" data-act="reject" data-id="${a.id}">반려</button>
        </div>
      </div>`).join('')
    : `<div class="empty">대기 중인 결재 안건이 없습니다.</div>`;
}

/* ===================== 직원 아바타 ===================== */
function avatar(s){
  return `<svg class="av" width="26" height="26" viewBox="0 0 26 26">
    <ellipse cx="13" cy="21" rx="9" ry="4.5" fill="${s.top}"/>
    <circle cx="13" cy="12" r="6.5" fill="#F2D3B8"/>
    <path d="M6.5 11.5a6.5 6.5 0 0 1 13 0z" fill="${s.hair}"/>
    <circle cx="4.5" cy="19" r="2" fill="#F2D3B8"/>
    <circle cx="21.5" cy="19" r="2" fill="#F2D3B8"/>
  </svg>`;
}

/* ===================== 대표 전용 씬 (책상 + 의자 + 대표) ===================== */
function ceoScene(){
  return `<svg width="150" height="104" viewBox="0 0 150 104">
    <ellipse cx="75" cy="96" rx="58" ry="6" fill="rgba(0,0,0,.25)"/>
    <path d="M40 34 q35 -22 70 0 l0 30 q-35 16 -70 0 z" fill="${CEO.chair}" opacity=".9"/>
    <rect x="30" y="60" width="90" height="30" rx="4" fill="${CEO.desk}"/>
    <rect x="30" y="60" width="90" height="6" rx="3" fill="#E7C066"/>
    <rect x="40" y="72" width="18" height="12" rx="1" fill="#3E2E20"/>
    <rect x="64" y="72" width="18" height="12" rx="1" fill="#3E2E20"/>
    <rect x="88" y="70" width="24" height="16" rx="2" fill="#1E1A22"/>
    <rect x="90" y="72" width="20" height="11" rx="1" fill="#6BE3E0" opacity=".55"/>
    <ellipse cx="75" cy="68" rx="20" ry="9" fill="${CEO.suit}"/>
    <circle cx="63" cy="51" r="2" fill="#F2D3B8"/>
    <circle cx="87" cy="51" r="2" fill="#F2D3B8"/>
    <circle cx="75" cy="45" r="11" fill="#F2D3B8"/>
    <path d="M64 43a11 11 0 0 1 22 0c0 2 -1 3 -3 3h-16c-2 0-3 -1-3 -3z" fill="${CEO.hair}"/>
    <rect x="70" y="56" width="10" height="9" fill="#fff"/>
    <path d="M73 56 L75 63 L77 56 Z" fill="#B22234"/>
  </svg>`;
}

function ceoWindowSkyline(){
  const bars = [
    {l:6,w:12,h:26},{l:20,w:9,h:38},{l:31,w:13,h:20},
    {l:46,w:10,h:44},{l:58,w:14,h:30},{l:74,w:11,h:22},{l:87,w:15,h:34},
  ];
  return bars.map(b=>`<i style="left:${b.l}px;width:${b.w}px;height:${b.h}px"></i>`).join('');
}

function ceoBookshelf(){
  const palette = ['#E7C066','#8E6FBF','#7A1F3D','#2FBF8B','#6BE3E0','#E56A92'];
  let rows = '';
  for(let r=0;r<4;r++){
    const spans = Array.from({length:5},(_,i)=>`<span style="background:${palette[(r+i)%palette.length]}"></span>`).join('');
    rows += `<div class="row">${spans}</div>`;
  }
  return rows;
}

function ceoPlant(){
  return `<svg width="26" height="40" viewBox="0 0 26 40">
    <rect x="7" y="26" width="12" height="12" rx="2" fill="#8E6FBF"/>
    <path d="M13 26 q-10 -6 -10 -18 q10 2 10 12 q0 -12 12 -14 q0 12 -8 18 q6 -8 8 -4 q-2 8 -12 8z" fill="#2FBF8B"/>
  </svg>`;
}

/* ===================== 사무실 렌더링 ===================== */
export function buildFloor(){
  const teamHTML = TEAMS.map(t=>{
    const mem = STAFF.filter(s=>s.t===t.id);
    return `<div class="room" id="room-${t.id}" data-col="0" data-row="0">
      <h3><span class="dot"></span>${t.name}</h3>
      <div class="sub">${t.sub} · ${mem.length}명</div>
      <div class="desks">${mem.map(s=>`
        <div class="desk" data-n="${s.n}" data-st="미출근">
          <span class="led"></span>${avatar(s)}
          <div class="nm">${s.n}</div>
          <div class="rl">${s.r}</div>
        </div>`).join('')}</div>
    </div>`;
  }).join('');

  const queueHTML = CEO_QUEUE.map(q=>`<div class="qslot" data-slot="${q.slot}" data-col="${q.col}" data-row="${q.row}">${q.slot}</div>`).join('');

  $('floor').innerHTML = `
    <div class="ceoRoom" data-col="${CEO_ROOM.col}" data-row="${CEO_ROOM.row}" data-w="${CEO_ROOM.w}" data-h="${CEO_ROOM.h}">
      <div class="ceoRoom__label">
        <svg class="crown" viewBox="0 0 24 24"><path d="M2 8l4 3 6-7 6 7 4-3-2 11H4L2 8z" fill="#E7C066"/></svg>
        대표실 <span class="en">EXECUTIVE OFFICE</span>
        <span class="ceoRoom__present"><i></i>대표 재실중</span>
      </div>
      <div class="ceoRoom__scene">
        <div class="ceoRoom__shelf">${ceoBookshelf()}</div>
        <div class="ceoRoom__window">${ceoWindowSkyline()}</div>
        <div class="ceoRoom__plaque">AURAKOREA<br>1F · CEO</div>
        <div class="ceoRoom__rug"></div>
        <div class="ceoRoom__deskWrap">
          ${ceoScene()}
          <div class="ceoRoom__nameplate">${CEO.name} · ${CEO.title}</div>
        </div>
        <div class="ceoRoom__plant">${ceoPlant()}</div>
      </div>
    </div>
    <div class="queueRow"><span class="ql">보고 대기줄</span>${queueHTML}</div>
    <div class="corridor"></div>
    <div class="teamGrid">${teamHTML}</div>
    <div class="entranceMark" data-col="${ENTRANCE.col}" data-row="${ENTRANCE.row}"><i></i>${ENTRANCE.label}</div>
  `;

  $('staffCount').textContent = 'AI STAFF '+STAFF.length;
  document.querySelectorAll('.desk').forEach(d=>{
    d.onclick = ()=>select(d.dataset.n);
  });
}

/* ===================== 상태 요약 칩 ===================== */
function updateChips(){
  const count = { '근무중':0, '처리중':0, '보고대기':0, '미출근':0 };
  STAFF.forEach(s=>{ const st = state[s.n].st; if(count[st]!==undefined) count[st]++; });
  $('chipWork').textContent = count['근무중'];
  $('chipBusy').textContent = count['처리중'];
  $('chipWait').textContent = count['보고대기'];
  $('chipOff').textContent = count['미출근'];
}

/* ===================== 화면 갱신 ===================== */
export function paint(simMin){
  $('simClock').textContent = hhmm(simMin);
  STAFF.forEach(s=>{
    const d = document.querySelector(`.desk[data-n="${s.n}"]`);
    if(!d) return;
    d.dataset.st = state[s.n].st;
    d.classList.toggle('sel', selected===s.n);
    const old = d.querySelector('.bubble');
    if(old) old.remove();
    if(state[s.n].bubble){
      const b=document.createElement('div');
      b.className='bubble'; b.textContent=state[s.n].bubble;
      d.appendChild(b);
    }
  });
  TEAMS.forEach(t=>{
    const busy = STAFF.filter(s=>s.t===t.id).some(s=>['근무중','처리중','보고대기'].includes(state[s.n].st));
    $('room-'+t.id).classList.toggle('active', busy);
  });
  updateChips();
}

export function log(simMin, who, msg){
  const el=document.createElement('div');
  el.innerHTML = `<span class="t">${hhmm(simMin)}</span><b>${who}</b> ${msg}`;
  $('log').prepend(el);
  while($('log').childNodes.length>90) $('log').lastChild.remove();
}

export function select(name, simMin){
  selected = name;
  const s = STAFF.find(x=>x.n===name), st = state[name];
  $('detail').innerHTML = `
    <h4>${s.n} · ${s.r}</h4>
    <div class="kv"><span>소속</span><span>${TEAMS.find(t=>t.id===s.t).name}</span></div>
    <div class="kv"><span>출근시간</span><span>${hhmm(WORK_HOURS.start)}</span></div>
    <div class="kv"><span>현재 상태</span><span>${st.st}</span></div>
    <div class="kv"><span>오늘 처리</span><span>${st.done}건</span></div>
    <div class="duty">${s.duty}</div>
    <button class="go" id="goBtn">이 직원에게 직접 지시</button>`;
  $('goBtn').onclick = ()=>{ $('cmd').focus(); $('cmd').placeholder = `${s.n}에게 지시…`; };
  paint(simMin);
}

export function initOffice(){
  buildFloor();
  paint(SIM_WINDOW.open);
  renderAgenda();
}

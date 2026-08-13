import { TEAMS } from '../data/teams.js';
import { STAFF, RANKS, LEADER_OF } from '../data/staff.js';
import { CEO, HQ_MANAGER, CEO_ROOM, CEO_QUEUE, ENTRANCE, WORK_HOURS, SIM_WINDOW,
         COMPANY, MEETING_ROOM, LOUNGE } from '../data/layout.js';

/* ===================== 공용 유틸 (시계 표기) ===================== */
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2,'0');
export const hhmm = m => pad(Math.floor(m/60)%24)+':'+pad(m%60);
export const toMin = t => (+t.slice(0,2))*60 + (+t.slice(3));

/* ===================== 런타임 상태 ===================== */
export const state = {};
STAFF.forEach(s=>{ state[s.n] = { st:'미출근', done:0, bubble:null, bt:0, away:false, runningReal:false, lastReal:null }; });

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export let selected = null;

/* ===================== 캐릭터 이동 (출근·퇴근·대표실 앞 줄서기) ===================== */
function relPos(el){
  const floorRect = $('floor').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - floorRect.left + r.width/2, y: r.top - floorRect.top + r.height/2 };
}

function spawnWalker(s){
  const w = document.createElement('div');
  w.className = 'walker';
  w.innerHTML = avatar(s);
  $('walkers').appendChild(w);
  return w;
}

function walkPath(w, points, msPerLeg=550){
  return new Promise(resolve=>{
    const anim = w.animate(
      points.map(p=>({ left:p.x+'px', top:p.y+'px' })),
      { duration: msPerLeg*(points.length-1), easing:'ease-in-out', fill:'forwards' }
    );
    anim.onfinish = resolve;
    anim.oncancel = resolve;
  });
}

// 대표실 앞 보고 대기줄 5칸 점유 현황
const queueOccupancy = new Array(CEO_QUEUE.length).fill(null);
function claimSlot(name){
  const i = queueOccupancy.findIndex(v=>v===null);
  if(i>=0) queueOccupancy[i] = name;
  return i;
}
function releaseSlot(name){
  const i = queueOccupancy.indexOf(name);
  if(i>=0) queueOccupancy[i] = null;
  return i;
}
function slotEl(i){ return document.querySelector(`.qslot[data-slot="${i+1}"]`); }
function occupySlotView(i, s){
  const el = slotEl(i); if(!el) return;
  el.innerHTML = avatar(s);
  el.classList.add('occ');
  el.title = s.n;
}
function freeSlotView(i){
  const el = slotEl(i); if(!el) return;
  el.textContent = String(i+1);
  el.classList.remove('occ');
  el.removeAttribute('title');
}

/* 정문 개폐 — 캐릭터가 드나드는 동안만 열린다.
   동시에 여러 명이 드나들 수 있으므로 참조 카운트로 관리한다. */
let doorHolders = 0;
function openFrontDoor(){
  doorHolders++;
  const d = $('frontDoor');
  if(d) d.classList.add('open');
}
function closeFrontDoor(){
  doorHolders = Math.max(0, doorHolders - 1);
  if(doorHolders === 0){
    const d = $('frontDoor');
    if(d) d.classList.remove('open');
  }
}

// 같은 직원의 이동 동작(출근/퇴근/보고/복귀)이 겹치지 않도록 순서대로 실행한다.
// (예: 대표 지시 응답이 즉시 실패해도 '대표실 도착' 전에 '복귀'가 끼어들지 않게 막는다)
const walkLocks = {};
function withWalkLock(name, fn){
  const prev = walkLocks[name] || Promise.resolve();
  const run = prev.then(fn, fn);
  walkLocks[name] = run.catch(()=>{});
  return run;
}

export function arriveWalk(name, simMin){ return withWalkLock(name, ()=>_arriveWalk(name, simMin)); }
export function leaveWalk(name, simMin){ return withWalkLock(name, ()=>_leaveWalk(name, simMin)); }
export function goReport(name, simMin){ return withWalkLock(name, ()=>_goReport(name, simMin)); }
export function returnFromReport(name, simMin){ return withWalkLock(name, ()=>_returnFromReport(name, simMin)); }

async function _arriveWalk(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  const entranceEl = $('entrance');
  if(!deskEl || !entranceEl) return;
  state[name].away = true;
  paint(simMin);
  // 정문을 열고 들어온다 — 캐릭터가 갑자기 생기지 않는다
  openFrontDoor();
  await new Promise(r=>setTimeout(r, 320));
  const w = spawnWalker(s);
  const from = relPos(entranceEl), to = relPos(deskEl);
  // 정문 → 통로(세로) → 자기 자리(가로) 순으로 걷는다
  await walkPath(w, [from, {x:from.x,y:to.y}, to]);
  closeFrontDoor();
  w.remove();
  state[name].away = false;
  paint(simMin);
}

async function _leaveWalk(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  const entranceEl = $('entrance');
  if(!deskEl || !entranceEl) return;
  state[name].away = true;
  paint(simMin);
  const w = spawnWalker(s);
  const from = relPos(deskEl), to = relPos(entranceEl);
  // 자리 → 통로 → 정문. 문 앞에 도착할 즈음 문이 열린다
  const walk = walkPath(w, [from, {x:from.x,y:to.y}, to]);
  setTimeout(openFrontDoor, 700);
  await walk;
  w.remove();
  closeFrontDoor();
  state[name].away = false;
}

async function _goReport(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  if(!deskEl) return;
  state[name].away = true;
  paint(simMin);
  const w = spawnWalker(s);
  const from = relPos(deskEl);
  const corridorY = relPos($('corridor')).y;
  const i = claimSlot(name);
  if(i>=0){
    const to = relPos(slotEl(i));
    await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
    w.remove();
    occupySlotView(i, s);
  } else {
    await walkPath(w, [from, {x:from.x,y:corridorY}]);
    w.remove();
  }
}

async function _returnFromReport(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  if(!deskEl) return;
  const i = releaseSlot(name);
  const corridorY = relPos($('corridor')).y;
  const w = spawnWalker(s);
  const to = relPos(deskEl);
  if(i>=0){
    const from = relPos(slotEl(i));
    freeSlotView(i);
    await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
  } else {
    await walkPath(w, [{x:to.x,y:corridorY}, to]);
  }
  w.remove();
  state[name].away = false;
  paint(simMin);
}

/* ===================== 직원 간 소통 (5단계) =====================
   무한 루프 방지 3중 장치:
   1) "질문 → 미리 정한 답변" 1회로 끝나는 단방향 대화만 존재한다. 답변이 새 질문을 만들지 않으므로
      데이터 구조상 대화가 스스로를 다시 트리거할 수 없다 (data/staff.js CHATS 참고).
   2) chatActive 로 사무실 전체에서 동시에 진행되는 대화를 1건으로 제한한다.
   3) 발신자별 쿨다운(sim.js의 nextChatAt)으로 같은 직원이 연달아 대화를 시작하지 못하게 막는다.   */
let chatActive = false;
export function chatWith(fromName, toName, ask, reply, simMin){
  if(chatActive) return Promise.resolve();
  const target = state[toName];
  if(!target || (target.st !== '근무중' && target.st !== '처리중')) return Promise.resolve();
  chatActive = true;
  return withWalkLock(fromName, ()=>_chatWith(fromName, toName, ask, reply, simMin))
    .finally(()=>{ chatActive = false; });
}

async function _chatWith(fromName, toName, ask, reply, simMin){
  const sFrom = STAFF.find(x=>x.n===fromName);
  const fromDesk = document.querySelector(`.desk[data-n="${fromName}"]`);
  const toDesk = document.querySelector(`.desk[data-n="${toName}"]`);
  if(!fromDesk || !toDesk) return;

  state[fromName].away = true;
  paint(simMin);
  const w = spawnWalker(sFrom);
  const fromPos = relPos(fromDesk), deskPos = relPos(toDesk);
  const toPos = { x: deskPos.x - 24, y: deskPos.y }; // 말풍선이 겹치지 않도록 상대 옆에 선다
  await walkPath(w, [fromPos, {x:toPos.x,y:fromPos.y}, toPos]);
  log(simMin, fromName, `${toName} 자리로 가서 물었습니다: "${ask}"`);

  const askBubble = document.createElement('div');
  askBubble.className = 'bubble';
  askBubble.textContent = ask;
  w.appendChild(askBubble);
  state[toName].bubble = reply;
  state[toName].bt = simMin;
  paint(simMin);

  await new Promise(r=>setTimeout(r, 1300));
  log(simMin, toName, `${fromName}에게 답했습니다: "${reply}"`);
  askBubble.remove();

  await walkPath(w, [toPos, {x:fromPos.x,y:toPos.y}, fromPos]);
  w.remove();
  state[fromName].away = false;
  paint(simMin);
}

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
  goReport(name, simMin);
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
  returnFromReport(item.name, simMin);
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

/* ===================== 본부장 전용 씬 (작은 집무실) ===================== */
function hqScene(){
  return `<svg width="110" height="84" viewBox="0 0 110 84">
    <ellipse cx="55" cy="78" rx="40" ry="5" fill="rgba(0,0,0,.22)"/>
    <path d="M32 28 q23 -16 46 0 l0 22 q-23 12 -46 0 z" fill="${HQ_MANAGER.chair}" opacity=".9"/>
    <rect x="22" y="48" width="66" height="24" rx="3" fill="${HQ_MANAGER.desk}"/>
    <rect x="22" y="48" width="66" height="5" rx="2" fill="#9C8AAE"/>
    <rect x="30" y="57" width="14" height="10" rx="1" fill="#33281F"/>
    <rect x="62" y="56" width="20" height="13" rx="2" fill="#1E1A22"/>
    <rect x="64" y="58" width="16" height="9" rx="1" fill="#6BE3E0" opacity=".55"/>
    <ellipse cx="55" cy="55" rx="16" ry="7" fill="${HQ_MANAGER.suit}"/>
    <circle cx="45" cy="42" r="1.8" fill="#F2D3B8"/>
    <circle cx="65" cy="42" r="1.8" fill="#F2D3B8"/>
    <circle cx="55" cy="37" r="9" fill="#F2D3B8"/>
    <path d="M46 35a9 9 0 0 1 18 0c0 1.6 -.8 2.4 -2.4 2.4h-13.2c-1.6 0-2.4 -.8-2.4 -2.4z" fill="${HQ_MANAGER.hair}"/>
    <rect x="51" y="46" width="8" height="7" fill="#fff"/>
    <path d="M53.5 46 L55 51.5 L56.5 46 Z" fill="${HQ_MANAGER.tie}"/>
  </svg>`;
}

/* ===================== 공용 공간 렌더링 (B 국면) ===================== */

// 미팅룸 — 대표 상석, 본부장석, 팀장 지정석. F 국면 회의에서 이 좌석에 앉는다.
function meetingRoomHTML(){
  const leaders = STAFF.filter(s=>s.rank==='팀장');
  const half = Math.ceil(leaders.length/2);
  const seatChip = (name, role, cls) =>
    `<div class="seat ${cls}" data-seat="${name}"><span class="seat__plate">${name}</span><span class="seat__role">${role}</span></div>`;

  return `<div class="room2 meetingRoom" id="meetingRoom">
    <div class="room2__label">
      <svg class="ico" viewBox="0 0 24 24"><path d="M3 5h18v12H3z" fill="none" stroke="#6BE3E0" stroke-width="2"/><path d="M8 19h8" stroke="#6BE3E0" stroke-width="2"/></svg>
      ${MEETING_ROOM.name} <span class="en">${MEETING_ROOM.nameEn}</span>
      <span class="roomState idle" id="meetingState">사용 가능</span>
    </div>
    <div class="meeting__body">
      <div class="projector">
        <div class="projector__screen" id="projectorScreen">
          <div class="projector__idle">회의 안건이 없습니다</div>
        </div>
        <div class="projector__stand"></div>
      </div>
      <div class="meeting__table">
        <div class="seatRow top">${leaders.slice(0,half).map(s=>seatChip(s.n,'팀장','leader')).join('')}</div>
        <div class="tableTop">
          ${seatChip(CEO.name,'대표','head')}
          <div class="tableSurface"><span>회의 테이블</span></div>
          ${seatChip(HQ_MANAGER.name,'본부장','hq')}
        </div>
        <div class="seatRow bottom">${leaders.slice(half).map(s=>seatChip(s.n,'팀장','leader')).join('')}</div>
      </div>
      <div class="whiteboard"><span>화이트보드</span></div>
    </div>
    <div class="glassDoor" title="미팅룸 유리문"><i></i><i></i></div>
  </div>`;
}

// 휴게 공간 — 커피머신·정수기·냉장고·간식·테이블
function loungeHTML(){
  return `<div class="room2 lounge" id="lounge">
    <div class="room2__label">
      <svg class="ico" viewBox="0 0 24 24"><path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="none" stroke="#E9B93F" stroke-width="2"/><path d="M16 10h3a2 2 0 0 1 0 4h-3" fill="none" stroke="#E9B93F" stroke-width="2"/></svg>
      ${LOUNGE.name} <span class="en">${LOUNGE.nameEn}</span>
    </div>
    <div class="lounge__body">
      <div class="fixture coffee" title="커피머신">
        <div class="machine"><div class="machine__screen"></div><div class="machine__spout"></div><div class="cup"></div></div>
        <span>커피머신</span>
      </div>
      <div class="fixture water" title="정수기">
        <div class="dispenser"><div class="dispenser__tank"></div><div class="dispenser__body"></div></div>
        <span>정수기</span>
      </div>
      <div class="fixture fridge" title="냉장고">
        <div class="fridgeBox"><i></i><i></i></div>
        <span>냉장고</span>
      </div>
      <div class="fixture snack" title="간식 진열대">
        <div class="shelf"><span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span></div>
        <span>간식</span>
      </div>
      <div class="fixture loungeTable" title="휴게 테이블">
        <div class="ltable"><div class="ltable__top"></div><div class="ltable__leg"></div></div>
        <span>휴게 테이블</span>
      </div>
      <div class="fixture bin" title="쓰레기통">
        <div class="binBox"></div>
        <span>정리대</span>
      </div>
    </div>
  </div>`;
}

// 업무 현황판
function statusBoardHTML(){
  return `<div class="room2 board" id="statusBoard">
    <div class="room2__label">
      <svg class="ico" viewBox="0 0 24 24"><path d="M4 4h16v14H4z" fill="none" stroke="#2FBF8B" stroke-width="2"/><path d="M7 14v-3M12 14V8M17 14v-5" stroke="#2FBF8B" stroke-width="2"/></svg>
      업무 현황판 <span class="en">STATUS BOARD</span>
    </div>
    <div class="board__body" id="boardBody"></div>
  </div>`;
}

// 정문 + 좌우 유리벽 + 안내 데스크
function entranceHTML(){
  return `<div class="frontZone">
    <div class="glassWall left">
      <div class="reception">
        <div class="reception__desk"></div>
        <div class="reception__sign">안내</div>
      </div>
    </div>

    <div class="frontDoor" id="frontDoor">
      <div class="doorHeader">
        <span class="logo">${COMPANY.name}</span>
        <span class="floorTag">${COMPANY.floor}</span>
      </div>
      <div class="doorFrame" id="entrance" data-col="${ENTRANCE.col}" data-row="${ENTRANCE.row}">
        <div class="doorLeaf l"><i></i></div>
        <div class="doorLeaf r"><i></i></div>
      </div>
      <div class="doorLabel">${ENTRANCE.label} · ${COMPANY.tagline}</div>
    </div>

    <div class="glassWall right">
      <div class="wallLogo">${COMPANY.nameKo}</div>
    </div>
  </div>`;
}

/* ===================== 사무실 렌더링 ===================== */
export function buildFloor(){
  // 팀장이 항상 맨 앞에 오도록 정렬한다 (팀장 → 과장 → 대리 → 사원)
  const byRank = (a,b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);

  const roomHTML = t => {
    const mem = STAFF.filter(s=>s.t===t.id).sort(byRank);
    const leader = mem.find(s=>s.rank==='팀장');
    return `<div class="room ${t.kind}" id="room-${t.id}" data-col="0" data-row="0" style="--accent:${t.accent}">
      <h3><span class="dot"></span>${t.name}<span class="kindTag">${t.kind==='region'?'지역':'기능'}</span></h3>
      <div class="sub">${t.sub} · ${mem.length}명${leader?` · 팀장 ${leader.n}`:''}</div>
      <div class="desks">${mem.map(s=>`
        <div class="desk${s.rank==='팀장'?' leader':''}" data-n="${s.n}" data-st="미출근">
          <span class="led"></span>${avatar(s)}
          <div class="nm">${s.n}<span class="rank">${s.rank}</span></div>
          <div class="rl">${s.r}</div>
        </div>`).join('')}</div>
    </div>`;
  };

  const regionHTML = TEAMS.filter(t=>t.kind==='region').map(roomHTML).join('');
  const functionHTML = TEAMS.filter(t=>t.kind==='function').map(roomHTML).join('');

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

    <div class="hqRoom" id="hqRoom">
      <div class="hqRoom__label">
        본부장실 <span class="en">HQ OFFICE</span>
        <span class="hqRoom__present"><i></i>재실중</span>
      </div>
      <div class="hqRoom__scene">
        <div class="hqRoom__deskWrap">
          ${hqScene()}
          <div class="hqRoom__nameplate">${HQ_MANAGER.name} · ${HQ_MANAGER.title}</div>
        </div>
        <div class="hqRoom__chain">
          <b>보고 경로</b>
          <span>팀원</span><i>→</i><span>팀장</span><i>→</i><span class="me">본부장</span><i>→</i><span class="ceo">대표</span>
        </div>
      </div>
    </div>

    <div class="queueRow"><span class="ql">보고 대기줄</span>${queueHTML}</div>
    <div class="corridor" id="corridor"></div>
    <div class="zoneLabel">지역본부</div>
    <div class="teamGrid region">${regionHTML}</div>
    <div class="zoneLabel">기능팀</div>
    <div class="teamGrid">${functionHTML}</div>

    <div class="corridor" id="corridor2"></div>
    <div class="zoneLabel">공용 공간</div>
    <div class="commonGrid">
      ${meetingRoomHTML()}
      ${loungeHTML()}
      ${statusBoardHTML()}
    </div>

    ${entranceHTML()}
    <div id="walkers"></div>
  `;

  $('staffCount').textContent = 'AI STAFF '+STAFF.length;
  document.querySelectorAll('.desk').forEach(d=>{
    d.onclick = ()=>select(d.dataset.n);
  });
}

/* ===================== 업무 현황판 =====================
   각 팀의 인원과 현재 활동 상태를 한눈에 보여준다. 토큰을 쓰지 않는 로컬 표시다. */
function updateBoard(){
  const el = $('boardBody');
  if(!el) return;
  el.innerHTML = TEAMS.map(t=>{
    const mem = STAFF.filter(s=>s.t===t.id);
    const active = mem.filter(s=>['근무중','처리중','보고대기'].includes(state[s.n].st)).length;
    const busy   = mem.filter(s=>state[s.n].st==='처리중').length;
    const wait   = mem.filter(s=>state[s.n].st==='보고대기').length;
    const done   = mem.reduce((n,s)=>n+state[s.n].done, 0);
    const pct    = mem.length ? Math.round(active/mem.length*100) : 0;
    return `<div class="boardRow">
      <span class="bt" style="--accent:${t.accent}">${t.name}</span>
      <span class="bar"><i style="width:${pct}%;background:${t.accent}"></i></span>
      <span class="bn">${active}/${mem.length}</span>
      <span class="bs">${busy?`처리 ${busy}`:''}${wait?` · 대기 ${wait}`:''}</span>
      <span class="bd">${done}건</span>
    </div>`;
  }).join('');
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
let lastSimMin = 0;
export function paint(simMin){
  lastSimMin = simMin;
  $('simClock').textContent = hhmm(simMin);
  STAFF.forEach(s=>{
    const d = document.querySelector(`.desk[data-n="${s.n}"]`);
    if(!d) return;
    d.dataset.st = state[s.n].st;
    d.classList.toggle('sel', selected===s.n);
    d.classList.toggle('away', !!state[s.n].away);
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
  updateBoard();
}

export function log(simMin, who, msg){
  const el=document.createElement('div');
  el.innerHTML = `<span class="t">${hhmm(simMin)}</span><b>${who}</b> ${msg}`;
  $('log').prepend(el);
  while($('log').childNodes.length>90) $('log').lastChild.remove();
}

export function select(name, simMin = lastSimMin){
  selected = name;
  const s = STAFF.find(x=>x.n===name), st = state[name];
  const realBlock = st.lastReal ? `
    <div class="realResult">
      <b>실시간 리서치 결과 <span>${new Date(st.lastReal.at).toLocaleString('ko-KR')}</span></b>
      <div>${escapeHtml(st.lastReal.text).replace(/\n/g,'<br>')}</div>
      ${st.lastReal.sources && st.lastReal.sources.length ? `<ul class="sources">${st.lastReal.sources.map(src=>`<li><a href="${escapeHtml(src.url)}" target="_blank" rel="noopener">${escapeHtml(src.title)}</a></li>`).join('')}</ul>` : ''}
      ${st.lastReal.note ? `<div class="note">${escapeHtml(st.lastReal.note)}</div>` : ''}
    </div>` : '';
  const leaderName = LEADER_OF[s.t];
  // 보고 경로: 팀원이면 팀장을 거치고, 팀장이면 바로 본부장에게 보고한다.
  const chain = s.rank === '팀장'
    ? `${s.n} → ${HQ_MANAGER.name} 본부장 → ${CEO.name} 대표님`
    : `${s.n} → ${leaderName} 팀장 → ${HQ_MANAGER.name} 본부장 → ${CEO.name} 대표님`;
  $('detail').innerHTML = `
    <h4>${s.n} <span class="rankTag${s.rank==='팀장'?' lead':''}">${s.rank}</span></h4>
    <div class="kv"><span>담당</span><span>${s.r}</span></div>
    <div class="kv"><span>소속</span><span>${TEAMS.find(t=>t.id===s.t).name}</span></div>
    ${s.rank!=='팀장' ? `<div class="kv"><span>직속 팀장</span><span>${leaderName}</span></div>` : ''}
    <div class="kv"><span>출근시간</span><span>${hhmm(WORK_HOURS.start)}</span></div>
    <div class="kv"><span>현재 상태</span><span>${st.st}</span></div>
    <div class="kv"><span>오늘 처리</span><span>${st.done}건</span></div>
    <div class="duty">${s.duty}</div>
    <div class="chainBox"><b>보고 경로</b>${chain}</div>
    <button class="go" id="goBtn">이 직원에게 직접 지시</button>
    ${realBlock}`;
  $('goBtn').onclick = ()=>{ $('cmd').focus(); $('cmd').placeholder = `${s.n}에게 지시…`; };
  paint(simMin);
}

export function initOffice(){
  buildFloor();
  paint(SIM_WINDOW.open);
  renderAgenda();
}

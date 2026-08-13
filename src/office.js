import { TEAMS } from '../data/teams.js';
import { STAFF, RANKS, LEADER_OF } from '../data/staff.js';
import { CEO, HQ_MANAGER, CEO_ROOM, CEO_QUEUE, ENTRANCE, WORK_HOURS, SIM_WINDOW,
         COMPANY, MEETING_ROOM, LOUNGE } from '../data/layout.js';
import { character, vipCharacter } from './character.js';
import { workDesk, nameplate, officeChair, MONITOR_STATE } from './furniture.js';

/* ===================== 공용 유틸 (시계 표기) ===================== */
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2,'0');
export const hhmm = m => pad(Math.floor(m/60)%24)+':'+pad(m%60);
export const toMin = t => (+t.slice(0,2))*60 + (+t.slice(3));

/* ===================== 런타임 상태 ===================== */
export const state = {};
STAFF.forEach(s=>{ state[s.n] = { st:'미출근', done:0, bubble:null, bt:0, away:false, runningReal:false, lastReal:null }; });

export function escapeHtml(str){
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
  w.innerHTML = character(s, { pose:'walk' });   // 걷는 전신 캐릭터
  $('walkers').appendChild(w);
  return w;
}

/* 경로를 따라 걷는다. 구간마다 진행 방향을 보고 캐릭터를 좌우로 뒤집어
   실제로 가는 쪽을 바라보게 한다 (헌장 11항: 몸 돌리기). */
function walkPath(w, points, msPerLeg=550){
  return new Promise(resolve=>{
    // 각 구간이 시작될 때 방향을 갱신한다
    const faceFor = i => {
      const dx = points[i+1].x - points[i].x;
      if(Math.abs(dx) < 2) return;              // 세로 이동은 방향 유지
      w.classList.toggle('flip', dx < 0);        // 왼쪽으로 가면 반전
    };
    faceFor(0);
    for(let i=1;i<points.length-1;i++){
      setTimeout(()=>faceFor(i), msPerLeg*i);
    }
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
  // 줄 서서 대기하는 모습 — 서 있되 걷지는 않는다 (char--idle)
  el.innerHTML = character(s, { pose:'walk', className:'char--idle' });
  el.classList.add('occ');
  el.title = `${s.n} · 보고 대기`;
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

/* 여러 명이 동시에 이동할 때 서로 겹치지 않게 하는 장치 (헌장 11항)
   - 출근 순서를 조금씩 어긋나게 한다
   - 통로에서 각자 다른 레인을 쓴다 */
const staffIndex = name => STAFF.findIndex(x => x.n === name);
const laneOffset = name => ((staffIndex(name) % 5) - 2) * 16;

async function _arriveWalk(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  const entranceEl = $('entrance');
  if(!deskEl || !entranceEl) return;
  state[name].away = true;
  paint(simMin);
  // 한 명씩 차례로 들어온다 — 문 앞에서 뭉치지 않는다
  await new Promise(r=>setTimeout(r, staffIndex(name) * 220));
  // 정문을 열고 들어온다 — 캐릭터가 갑자기 생기지 않는다
  openFrontDoor();
  await new Promise(r=>setTimeout(r, 320));
  const w = spawnWalker(s);
  const from = relPos(entranceEl), to = relPos(deskEl);
  const lane = laneOffset(name);
  // 정문 → 통로(세로, 개인별 레인) → 자기 자리(가로) 순으로 걷는다
  await walkPath(w, [from, {x:from.x+lane,y:to.y}, to]);
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
  // 퇴근도 한 명씩 차례로 — 정문 앞에서 뭉치지 않는다
  await new Promise(r=>setTimeout(r, staffIndex(name) * 200));
  const w = spawnWalker(s);
  const from = relPos(deskEl), to = relPos(entranceEl);
  const lane = laneOffset(name);
  // 자리 → 통로(개인별 레인) → 정문. 문 앞에 도착할 즈음 문이 열린다
  const walk = walkPath(w, [from, {x:from.x+lane,y:to.y}, {x:to.x+lane,y:to.y}, to]);
  setTimeout(openFrontDoor, 900);
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

/* ═══════════ 회의 참석 이동 (F 국면 · 헌장 16항) ═══════════
   참석자가 자기 자리에서 일어나 통로를 따라 미팅룸까지 걸어가 지정 좌석에 앉는다. */
const seatEl = name => document.querySelector(`.mseat[data-seat="${name}"]`);

function sitAtSeat(name, charHtml){
  const el = seatEl(name);
  if(!el) return;
  const slot = el.querySelector('.mseat__char');
  if(slot) slot.innerHTML = charHtml;
  el.classList.add('seated');
}
function leaveSeat(name){
  const el = seatEl(name);
  if(!el) return;
  const slot = el.querySelector('.mseat__char');
  if(slot) slot.innerHTML = '';
  el.classList.remove('seated', 'speaking');
}

/* 직원(팀장)이 미팅룸으로 이동해 착석한다 */
export async function walkToMeeting(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  const seat = seatEl(name);
  if(!s || !deskEl || !seat) return;

  return withWalkLock(name, async () => {
    state[name].away = true;
    state[name].bubble = '회의 참석';
    paint(simMin);
    const w = spawnWalker(s);
    const from = relPos(deskEl), to = relPos(seat);
    const corridorY = relPos($('corridor2') || $('corridor')).y;
    // 자리 → 통로 → 미팅룸 유리문 → 지정 좌석
    await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
    w.remove();
    sitAtSeat(name, character(s, { pose:'sit', className:'char--mini' }));
    paint(simMin);
  });
}

/* 회의가 끝나면 자기 자리로 걸어서 복귀한다 */
export async function walkFromMeeting(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const deskEl = document.querySelector(`.desk[data-n="${name}"]`);
  const seat = seatEl(name);
  if(!s || !deskEl || !seat) return;

  return withWalkLock(name, async () => {
    const from = relPos(seat);
    leaveSeat(name);
    const w = spawnWalker(s);
    const to = relPos(deskEl);
    const corridorY = relPos($('corridor2') || $('corridor')).y;
    await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
    w.remove();
    state[name].away = false;
    state[name].bubble = null;
    paint(simMin);
  });
}

/* 대표·본부장은 직원이 아니므로 별도로 이동시킨다 */
export async function walkVipToMeeting(who, vipDef){
  const seat = seatEl(vipDef.name);
  const roomEl = who === 'ceo' ? document.querySelector('.ceoRoom') : $('hqRoom');
  if(!seat || !roomEl) return;

  if(who === 'ceo') document.querySelector('.ceoRoom').classList.add('vacant');
  else setHqPresent(false);

  const w = document.createElement('div');
  w.className = 'walker walker--hq';
  w.innerHTML = vipCharacter(vipDef, 'walk');
  $('walkers').appendChild(w);

  const from = relPos(roomEl), to = relPos(seat);
  const corridorY = relPos($('corridor2') || $('corridor')).y;
  await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
  w.remove();
  sitAtSeat(vipDef.name, vipCharacter(vipDef).replace('class="char', 'class="char char--mini'));
}

export async function walkVipFromMeeting(who, vipDef){
  const seat = seatEl(vipDef.name);
  const roomEl = who === 'ceo' ? document.querySelector('.ceoRoom') : $('hqRoom');
  if(!seat || !roomEl) return;

  const from = relPos(seat);
  leaveSeat(vipDef.name);
  const w = document.createElement('div');
  w.className = 'walker walker--hq';
  w.innerHTML = vipCharacter(vipDef, 'walk');
  $('walkers').appendChild(w);

  const to = relPos(roomEl);
  const corridorY = relPos($('corridor2') || $('corridor')).y;
  await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, to]);
  w.remove();
  if(who === 'ceo') document.querySelector('.ceoRoom').classList.remove('vacant');
  else setHqPresent(true);
}

/* 발언자 표시 — 한 번에 한 사람만 발언한다 (헌장 16항) */
export function setSpeaker(name){
  document.querySelectorAll('.mseat.speaking').forEach(el => el.classList.remove('speaking'));
  if(name){
    const el = seatEl(name);
    if(el) el.classList.add('speaking');
  }
}

export function setMeetingState(busy, label){
  const text = label || (busy ? '회의 중' : '사용 가능');
  const st = $('meetingState');
  if(st){
    st.textContent = text;
    st.classList.toggle('busy', !!busy);
  }
  // 사이드 패널 배지도 같이 맞춘다
  const badge = $('mtBadge');
  if(badge){
    badge.textContent = text;
    badge.classList.toggle('on', !!busy);
  }
  const room = $('meetingRoom');
  if(room) room.classList.toggle('inSession', !!busy);
}

export function setProjector(html){
  const el = $('projectorScreen');
  if(el) el.innerHTML = html || `<div class="projector__idle">회의 안건이 없습니다</div>`;
}

/* ═══════════ 본부장 이동 (E 국면 · 헌장 12항) ═══════════
   본부장은 평상시 본부장실 의자에 앉아 대기하다가, 지시가 오면 일어나
   담당 팀장 자리까지 직접 걸어가 지시를 전달하고 본부장실로 복귀한다. */
export const hqState = { busy:false, at:'본부장실' };

function spawnHqWalker(){
  const w = document.createElement('div');
  w.className = 'walker walker--hq';
  w.innerHTML = vipCharacter(HQ_MANAGER, 'walk');
  $('walkers').appendChild(w);
  return w;
}

function setHqPresent(present){
  const room = $('hqRoom');
  if(room) room.classList.toggle('vacant', !present);
}

/* 본부장이 대상 자리로 걸어가 지시를 전달하고 돌아온다.
   onArrive: 도착했을 때 실행할 동작 (지시 전달 연출 등) */
export async function hqVisit(targetName, { onArrive, stayMs = 1400 } = {}){
  const targetEl = document.querySelector(`.desk[data-n="${targetName}"]`);
  const hqEl = $('hqRoom');
  if(!targetEl || !hqEl || hqState.busy) return false;

  hqState.busy = true;
  hqState.at = '이동 중';
  setHqPresent(false);

  const w = spawnHqWalker();
  const from = relPos(hqEl);
  const to = relPos(targetEl);
  const corridorY = relPos($('corridor')).y;

  // 본부장실 → 복도 → 담당자 자리 앞
  await walkPath(w, [from, {x:from.x,y:corridorY}, {x:to.x,y:corridorY}, {x:to.x, y:to.y - 6}]);

  // 담당자가 하던 일을 멈추고 본부장을 바라본다
  targetEl.classList.add('attending');
  hqState.at = targetName;
  if(onArrive) await onArrive(w);
  await new Promise(r=>setTimeout(r, stayMs));
  targetEl.classList.remove('attending');

  // 본부장실로 복귀
  await walkPath(w, [{x:to.x, y:to.y - 6}, {x:to.x,y:corridorY}, {x:from.x,y:corridorY}, from]);
  w.remove();
  hqState.busy = false;
  hqState.at = '본부장실';
  setHqPresent(true);
  return true;
}

/* 본부장 머리 위 말풍선 (지시 전달 연출) */
export function hqSay(walkerEl, text){
  const b = document.createElement('div');
  b.className = 'bubble bubble--hq';
  b.textContent = text;
  walkerEl.appendChild(b);
  return () => b.remove();
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
// 자리에 앉은 모습 (C 국면: 전신 캐릭터)
function avatar(s){
  return character(s, { pose:'sit' });
}

/* ===================== 대표 전용 씬 (의자 + 대표 캐릭터 + 책상) =====================
   헌장 10항에 맞춰 대표도 전신 캐릭터 규격을 쓴다. 책상을 캐릭터 앞에 겹쳐 그려
   "책상 앞에 앉아 있는" 구도를 만든다. */
function ceoScene(){
  return `<div class="vipScene vipScene--ceo">
    <div class="vipChair" style="--chair:${CEO.chair}"></div>
    <div class="vipPerson">${vipCharacter(CEO)}</div>
    <div class="vipDesk" style="--desk:${CEO.desk}">
      <svg viewBox="0 0 120 40" width="150" height="50">
        <rect x="4" y="8" width="112" height="26" rx="3" fill="var(--desk)"/>
        <rect x="4" y="8" width="112" height="6" rx="3" fill="#E7C066"/>
        <rect x="14" y="19" width="20" height="13" rx="1" fill="#3E2E20"/>
        <rect x="40" y="19" width="20" height="13" rx="1" fill="#3E2E20"/>
        <rect x="70" y="16" width="26" height="17" rx="2" fill="#1E1A22"/>
        <rect x="72" y="18" width="22" height="12" rx="1" fill="#6BE3E0" opacity=".55"/>
        <rect x="8" y="34" width="6" height="6" fill="#4A3524"/>
        <rect x="106" y="34" width="6" height="6" fill="#4A3524"/>
      </svg>
    </div>
  </div>`;
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
  return `<div class="vipScene vipScene--hq">
    <div class="vipChair" style="--chair:${HQ_MANAGER.chair}"></div>
    <div class="vipPerson">${vipCharacter(HQ_MANAGER)}</div>
    <div class="vipDesk" style="--desk:${HQ_MANAGER.desk}">
      <svg viewBox="0 0 100 34" width="112" height="38">
        <rect x="3" y="6" width="94" height="22" rx="3" fill="var(--desk)"/>
        <rect x="3" y="6" width="94" height="5" rx="2" fill="#9C8AAE"/>
        <rect x="12" y="15" width="16" height="11" rx="1" fill="#33281F"/>
        <rect x="58" y="13" width="22" height="14" rx="2" fill="#1E1A22"/>
        <rect x="60" y="15" width="18" height="10" rx="1" fill="#6BE3E0" opacity=".55"/>
        <rect x="6" y="28" width="5" height="6" fill="#33281F"/>
        <rect x="89" y="28" width="5" height="6" fill="#33281F"/>
      </svg>
    </div>
  </div>`;
}

/* ===================== 공용 공간 렌더링 (B 국면) ===================== */

// 미팅룸 — 대표 상석, 본부장석, 팀장 지정석. F 국면 회의에서 이 좌석에 앉는다.
function meetingRoomHTML(){
  const leaders = STAFF.filter(s=>s.rank==='팀장');
  const half = Math.ceil(leaders.length/2);
  // 클래스명 앞에 m(meeting)을 붙여 직원 자리(.seat)와 이름이 겹치지 않게 한다
  // .mseat__char 는 F 국면에서 참석자가 착석하면 캐릭터가 들어가는 자리다
  const seatChip = (name, role, cls) =>
    `<div class="mseat ${cls}" data-seat="${name}">
       <div class="mseat__char"></div>
       <span class="mseat__plate">${name}</span>
       <span class="mseat__role">${role}</span>
     </div>`;

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
          <span class="led"></span>
          <div class="seat">
            <div class="seat__chair">${officeChair(s.rank==='팀장')}</div>
            <div class="seat__person">${avatar(s)}</div>
            <div class="seat__desk">${workDesk(s.t, { isLeader: s.rank==='팀장' })}</div>
          </div>
          ${nameplate(s)}
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
        <div class="hqRoom__info">
          <div class="hqRoom__chain">
            <b>보고 경로</b>
            <span>팀원</span><i>→</i><span>팀장</span><i>→</i><span class="me">본부장</span><i>→</i><span class="ceo">대표</span>
          </div>
          <div class="hqRoom__status">현재 <b id="hqStatus">대표님 지시 대기</b></div>
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
    const st = state[s.n];
    d.dataset.st = st.st;
    d.classList.toggle('sel', selected===s.n);
    d.classList.toggle('away', !!st.away);

    // 모니터 화면에 담당자의 현재 업무 상태를 표시한다 (헌장 9-7)
    const mon = MONITOR_STATE[st.away ? '미출근' : st.st] || MONITOR_STATE['미출근'];
    const scr = d.querySelector('.monScreen');
    const txt = d.querySelector('.monText');
    if(scr) scr.setAttribute('fill', mon.bg);
    if(txt){ txt.textContent = st.away ? '자리비움' : mon.text; txt.setAttribute('fill', mon.fg); }

    // 머리 위 상태 표시 (헌장 10항)
    let tag = d.querySelector('.statusTag');
    const label = st.away ? '이동 중' : st.st;
    if(label && label !== '미출근' && label !== '퇴근'){
      if(!tag){
        tag = document.createElement('div');
        tag.className = 'statusTag';
        d.appendChild(tag);
      }
      tag.textContent = label;
      tag.className = 'statusTag ' + (
        st.away ? 'move' :
        st.st === '처리중' ? 'busy' :
        st.st === '보고대기' ? 'wait' : 'work');
    } else if(tag){
      tag.remove();
    }

    const old = d.querySelector('.bubble');
    if(old) old.remove();
    if(st.bubble){
      const b=document.createElement('div');
      b.className='bubble'; b.textContent=st.bubble;
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

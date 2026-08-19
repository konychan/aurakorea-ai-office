import { TEAMS } from '../data/teams.js';
import { STAFF, RANKS, LEADER_OF } from '../data/staff.js';
import { CEO, HQ_MANAGER, CEO_ROOM, HQ_ROOM, CEO_QUEUE, ENTRANCE, WORK_HOURS, SIM_WINDOW,
         COMPANY, MEETING_ROOM, LOUNGE, RESTROOM, RECEPTION, DOC_STUDIO, TRANS_ROOM,
         GRID, CORRIDOR, ROW_CORRIDORS, layoutTeamRooms, deskSlots, buildPath,
         IDLE_ACTIVITIES, IDLE_MAX_CONCURRENT } from '../data/layout.js';
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

/* ═══════════════════════════════════════════════════════════════
   캐릭터 이동 — 타일 좌표 + 복도 경로 + transform

   · 위치는 전부 타일 좌표(col,row)로 다루고, 화면에 그릴 때만 px로 바꾼다.
   · 이동은 data/layout.js 의 buildPath() 가 만든 복도 웨이포인트만 따라간다.
     (방·벽을 통과하지 않는다. 길찾기 알고리즘은 쓰지 않는다.)
   · 애니메이션은 transform(translate3d)만 쓴다 — left/top 금지.
   ═══════════════════════════════════════════════════════════════ */
const T = GRID.tile;
export const toPx = p => ({ x: p.col * T, y: p.row * T });

// 접근성: 모션 최소화 설정이면 애니메이션 없이 즉시 이동한다
const reduceMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 배속을 이동 속도에 반영한다 (sim.js 가 갱신한다)
let walkSpeed = 1;
export function setWalkSpeed(v){ walkSpeed = Math.max(1, v || 1); }

/* 직원의 자리 좌표 — 방 좌표 + 방 안 책상 슬롯 */
const deskPos = {};    // 이름 → {col,row,door}
export function deskPosOf(name){ return deskPos[name]; }

function spawnWalker(s){
  const w = document.createElement('div');
  w.className = 'walker';
  w.innerHTML = character(s, { pose:'walk' });
  $('walkers').appendChild(w);
  return w;
}

function placeAt(el, p){
  el.style.transform = `translate3d(${p.col * T}px, ${p.row * T}px, 0)`;
}

/* 웨이포인트를 순서대로 걸어간다.
   구간 길이에 비례해 시간을 배분하므로 걷는 속도가 일정하게 보인다. */
function walkAlong(w, points, pxPerSec = 120){
  return new Promise(resolve => {
    if(points.length < 2){ placeAt(w, points[0] || {col:0,row:0}); return resolve(); }

    // 모션 최소화면 마지막 지점으로 즉시 이동
    if(reduceMotion()){
      placeAt(w, points[points.length - 1]);
      return resolve();
    }

    const px = points.map(p => ({ x: p.col * T, y: p.row * T }));
    const segLen = [];
    let total = 0;
    for(let i = 0; i < px.length - 1; i++){
      const d = Math.hypot(px[i+1].x - px[i].x, px[i+1].y - px[i].y);
      segLen.push(d); total += d;
    }
    if(total < 1){ placeAt(w, points[points.length - 1]); return resolve(); }

    const duration = Math.max(280, (total / (pxPerSec * walkSpeed)) * 1000);
    // 구간 경계를 offset 으로 지정해 등속으로 걷게 한다
    let acc = 0;
    const frames = px.map((p, i) => {
      if(i > 0) acc += segLen[i-1];
      return { transform:`translate3d(${p.x}px, ${p.y}px, 0)`, offset: total ? acc/total : 1 };
    });

    // 진행 방향에 따라 몸을 돌린다
    const faceAt = i => {
      const dx = px[i+1].x - px[i].x;
      if(Math.abs(dx) > 2) w.classList.toggle('flip', dx < 0);
    };
    faceAt(0);
    let t = 0;
    for(let i = 1; i < px.length - 1; i++){
      t += (segLen[i-1] / total) * duration;
      setTimeout(() => faceAt(i), t);
    }

    const anim = w.animate(frames, { duration, easing:'linear', fill:'forwards' });
    anim.onfinish = resolve;
    anim.oncancel = resolve;
  });
}

/* 어떤 지점에서 어떤 지점으로 — 복도를 거쳐 걷는다 */
function walkBetween(w, from, to, pxPerSec){
  return walkAlong(w, buildPath(from, to), pxPerSec);
}

/* ═══════════ 대표실 앞 보고 대기줄 ═══════════
   바닥에 발자국 표시가 그려져 있고, 대기자는 순서대로 세로로 줄을 선다.
   머리 위에 순번이 표시된다. */
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
function slotMark(i){ return document.querySelector(`.qmark[data-slot="${i+1}"]`); }

/* 대기줄에 선 사람은 대기줄 레이어에 캐릭터로 남는다 (walker 가 아니라 고정 표시) */
function standInQueue(i, s){
  const layer = $('queueLayer');
  if(!layer) return;
  const el = document.createElement('div');
  el.className = 'queuer';
  el.dataset.n = s.n;
  el.innerHTML = `<span class="queuer__no">${i+1}</span>${character(s, { pose:'walk', className:'char--idle' })}`;
  placeAt(el, CEO_QUEUE[i]);
  layer.appendChild(el);
  const mk = slotMark(i);
  if(mk) mk.classList.add('occ');
}
function leaveQueue(name, i){
  const el = document.querySelector(`.queuer[data-n="${name}"]`);
  if(el) el.remove();
  const mk = slotMark(i);
  if(mk) mk.classList.remove('occ');
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

/* 여러 명이 동시에 움직일 때 정문 앞에서 뭉치지 않도록 출입 순서를 어긋나게 한다 */
const staffIndex = name => STAFF.findIndex(x => x.n === name);

// 정문 밖(도면 아래) — 출근 전·퇴근 후 캐릭터가 머무는 곳
const OUTSIDE = { col: ENTRANCE.col, row: GRID.rows + 1 };
const DOORWAY = { col: ENTRANCE.col, row: ENTRANCE.row - 0.5 };

async function _arriveWalk(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  if(!s || !desk) return;
  state[name].away = true;
  paint(simMin);

  await new Promise(r=>setTimeout(r, staffIndex(name) * 200));
  openFrontDoor();
  await new Promise(r=>setTimeout(r, 300));

  const w = spawnWalker(s);
  placeAt(w, OUTSIDE);
  // 정문 밖 → 문 안쪽 → 복도 → 자기 방 문 → 자리
  await walkAlong(w, [OUTSIDE, DOORWAY]);
  closeFrontDoor();
  await walkBetween(w, DOORWAY, desk);
  w.remove();

  state[name].away = false;
  paint(simMin);
}

async function _leaveWalk(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  if(!s || !desk) return;
  state[name].away = true;
  paint(simMin);

  await new Promise(r=>setTimeout(r, staffIndex(name) * 180));
  const w = spawnWalker(s);
  placeAt(w, desk);
  // 자리 → 방 문 → 복도 → 정문
  await walkBetween(w, desk, DOORWAY);
  openFrontDoor();
  await walkAlong(w, [DOORWAY, OUTSIDE]);
  closeFrontDoor();
  w.remove();
  state[name].away = false;
}

async function _goReport(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  if(!s || !desk) return;
  state[name].away = true;
  paint(simMin);

  const i = claimSlot(name);
  const w = spawnWalker(s);
  placeAt(w, desk);
  // 자리 → 방 문 → 복도 → 대표실 앞 대기줄
  const target = i >= 0 ? CEO_QUEUE[i] : { col: CORRIDOR.cx, row: CEO_ROOM.row + CEO_ROOM.h + 2 };
  await walkBetween(w, desk, target);
  w.remove();
  if(i >= 0) standInQueue(i, s);
}

async function _returnFromReport(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  if(!s || !desk) return;
  const i = releaseSlot(name);
  const from = i >= 0 ? CEO_QUEUE[i] : { col: CORRIDOR.cx, row: CEO_ROOM.row + CEO_ROOM.h + 2 };
  if(i >= 0) leaveQueue(name, i);

  const w = spawnWalker(s);
  placeAt(w, from);
  await walkBetween(w, from, desk);
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

/* 미팅룸 좌석의 타일 좌표 — 회의 테이블 주위에 둘러앉는다 */
const meetingSeatPos = {};   // 이름 → {col,row}
export function registerMeetingSeat(name, pos){ meetingSeatPos[name] = pos; }
const MEETING_DOOR = { col: MEETING_ROOM.col + MEETING_ROOM.w / 2, row: MEETING_ROOM.row + MEETING_ROOM.h };

/* 직원(팀장)이 미팅룸으로 이동해 착석한다 */
export async function walkToMeeting(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  const seatP = meetingSeatPos[name];
  if(!s || !desk || !seatP) return;

  return withWalkLock(name, async () => {
    state[name].away = true;
    state[name].bubble = '회의 참석';
    paint(simMin);
    const w = spawnWalker(s);
    placeAt(w, desk);
    // 자리 → 방 문 → 복도 → 미팅룸 문 → 지정 좌석
    await walkBetween(w, desk, { ...seatP, door: MEETING_DOOR });
    w.remove();
    sitAtSeat(name, character(s, { pose:'sit', className:'char--mini' }));
    paint(simMin);
  });
}

/* 회의가 끝나면 자기 자리로 걸어서 복귀한다 */
export async function walkFromMeeting(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const desk = deskPos[name];
  const seatP = meetingSeatPos[name];
  if(!s || !desk || !seatP) return;

  return withWalkLock(name, async () => {
    leaveSeat(name);
    const w = spawnWalker(s);
    placeAt(w, seatP);
    await walkBetween(w, { ...seatP, door: MEETING_DOOR }, desk);
    w.remove();
    state[name].away = false;
    state[name].bubble = null;
    paint(simMin);
  });
}

/* 대표·본부장은 직원이 아니므로 별도로 이동시킨다.
   대표는 회의 때만 대표실을 나선다 (평소에는 움직이지 않는다). */
const vipHome = {
  ceo: { col: CEO_ROOM.col + CEO_ROOM.w/2, row: CEO_ROOM.row + CEO_ROOM.h - 2,
         door: { col: CEO_ROOM.col + CEO_ROOM.w/2, row: CEO_ROOM.row + CEO_ROOM.h } },
  hq:  { col: HQ_ROOM.col + HQ_ROOM.w/2,  row: HQ_ROOM.row + HQ_ROOM.h - 2,
         door: { col: HQ_ROOM.col + HQ_ROOM.w/2,  row: HQ_ROOM.row + HQ_ROOM.h } },
};
export function vipHomeOf(who){ return vipHome[who]; }

function spawnVipWalker(vipDef){
  const w = document.createElement('div');
  w.className = 'walker walker--hq';
  w.innerHTML = vipCharacter(vipDef, 'walk');
  $('walkers').appendChild(w);
  return w;
}
function setVipPresent(who, present){
  if(who === 'ceo'){
    const el = document.querySelector('.ceoRoom');
    if(el) el.classList.toggle('vacant', !present);
  } else setHqPresent(present);
}

export async function walkVipToMeeting(who, vipDef){
  const seatP = meetingSeatPos[vipDef.name];
  const home = vipHome[who];
  if(!seatP || !home) return;
  setVipPresent(who, false);
  const w = spawnVipWalker(vipDef);
  placeAt(w, home);
  await walkBetween(w, home, { ...seatP, door: MEETING_DOOR });
  w.remove();
  sitAtSeat(vipDef.name, vipCharacter(vipDef).replace('class="char', 'class="char char--mini'));
}

export async function walkVipFromMeeting(who, vipDef){
  const seatP = meetingSeatPos[vipDef.name];
  const home = vipHome[who];
  if(!seatP || !home) return;
  leaveSeat(vipDef.name);
  const w = spawnVipWalker(vipDef);
  placeAt(w, seatP);
  await walkBetween(w, { ...seatP, door: MEETING_DOOR }, home);
  w.remove();
  setVipPresent(who, true);
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
   본부장이 움직이는 상황: 대표 지시 / 팀 업무 점검 / 업무 하달 / 회의 소집
   onArrive: 도착했을 때 실행할 동작 (지시 전달 연출 등) */
export async function hqVisit(targetName, { onArrive, stayMs = 1400 } = {}){
  const targetEl = document.querySelector(`.desk[data-n="${targetName}"]`);
  const target = deskPos[targetName];
  const home = vipHome.hq;
  if(!targetEl || !target || hqState.busy) return false;

  hqState.busy = true;
  hqState.at = '이동 중';
  setHqPresent(false);

  const w = spawnHqWalker();
  placeAt(w, home);
  // 본부장실 → 복도 → 담당자 방 문 → 자리 앞 (복도로만 이동한다)
  const standBy = { col: target.col, row: target.row + 1, door: target.door };
  await walkBetween(w, home, standBy);

  // 담당자가 하던 일을 멈추고 본부장을 바라본다
  targetEl.classList.add('attending');
  hqState.at = targetName;
  if(onArrive) await onArrive(w);
  await new Promise(r=>setTimeout(r, stayMs));
  targetEl.classList.remove('attending');

  // 본부장실로 복귀
  await walkBetween(w, standBy, home);
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
  const from = deskPos[fromName], toDesk = deskPos[toName];
  if(!sFrom || !from || !toDesk) return;

  state[fromName].away = true;
  paint(simMin);
  const w = spawnWalker(sFrom);
  placeAt(w, from);
  // 상대 자리 옆에 선다 (말풍선이 겹치지 않게 살짝 옆으로)
  const standBy = { col: toDesk.col - 1.2, row: toDesk.row + 0.6, door: toDesk.door };
  await walkBetween(w, from, standBy);
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

  await walkBetween(w, standBy, from);
  w.remove();
  state[fromName].away = false;
  paint(simMin);
}

/* ===================== 결재 큐 (직원 안건 → 대표 승인/반려) ===================== */
export const agendaQueue = [];
let agendaSeq = 1;

export function submitAgenda(name, agenda, simMin){
  const s = STAFF.find(x=>x.n===name);
  // 문자열로 넘어오던 예전 호출도 계속 동작하게 받아 준다
  const a = typeof agenda === 'string' ? { t: agenda } : agenda;
  const item = { id: agendaSeq++, name, team: s.t, title: a.t, why: a.why || '', point: a.point || '', simMin };
  agendaQueue.push(item);
  state[name].st = '보고대기';
  state[name].bubble = a.t;
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
          <button class="see" data-act="see" data-id="${a.id}">내용 보기</button>
          <button class="ok" data-act="approve" data-id="${a.id}">승인</button>
          <button class="no" data-act="reject" data-id="${a.id}">반려</button>
        </div>
      </div>`).join('')
    : `<div class="empty">대기 중인 결재 안건이 없습니다.</div>`;

  // 결재 전에 무슨 건인지 열어 보실 수 있게 한다
  el.querySelectorAll('[data-act="see"]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      const item = agendaQueue.find(a => String(a.id) === b.dataset.id);
      if(!item) return;
      const { openAgenda } = await import('./viewer.js');
      openAgenda(item);
    };
  });
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

  return `<div class="room2 meetingRoom room--fixed" id="meetingRoom" style="${box(MEETING_ROOM)}"
               data-col="${MEETING_ROOM.col}" data-row="${MEETING_ROOM.row}">
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
    <div class="room__doorB" title="미팅룸 유리문"></div>
  </div>

  <!-- 미팅룸 아래 회의 소집 버튼 -->
  <div class="mtButtons" style="left:${MEETING_ROOM.col*T}px;top:${(MEETING_ROOM.row + MEETING_ROOM.h + 0.4)*T}px;width:${MEETING_ROOM.w*T}px">
    <button class="mtBtnFloor" data-mtf="call-region">지역팀장 소집</button>
    <button class="mtBtnFloor" data-mtf="call-all">전체팀장 소집</button>
    <button class="mtBtnFloor end" data-mtf="end">회의 종료</button>
  </div>`;
}

// 휴게 공간 — 커피머신·정수기·냉장고·간식·테이블
function loungeHTML(){
  return `<div class="room2 lounge room--fixed" id="lounge" style="${box(LOUNGE)}"
               data-col="${LOUNGE.col}" data-row="${LOUNGE.row}">
    <div class="room__doorT"></div>
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

/* 문서제작실 — Excel · PPT · Word 전담자의 단독 작업실.
   팀 룸과 확실히 다르게 보여야 한다: 보라색 계열, 큰 작업용 모니터 2대, 프린터,
   벽에 붙은 문서 견본 3종(PPT/XLS/DOC), 색 견본. 이름표를 크게 달아 누구인지 바로 보이게 한다. */
function docStudioHTML(){
  const s = STAFF.find(x => x.n === DOC_STUDIO.owner);
  if(!s) return '';
  return `<div class="room2 docStudio room--fixed" id="docStudio" style="${box(DOC_STUDIO)}"
               data-col="${DOC_STUDIO.col}" data-row="${DOC_STUDIO.row}">
    <div class="room__doorB" title="문서제작실 문"></div>
    <div class="room2__label">
      <svg class="ico" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="#B69CE8" stroke-width="2"/><path d="M14 3v4h4" fill="none" stroke="#B69CE8" stroke-width="2"/><path d="M9 12h6M9 16h6" stroke="#B69CE8" stroke-width="2"/></svg>
      ${DOC_STUDIO.name} <span class="en">${DOC_STUDIO.nameEn}</span>
      <span class="roomState idle" id="docState">대기</span>
    </div>

    <div class="ds__body">
      <!-- 벽면: 만든 문서 견본 3종 + 색 견본 -->
      <div class="ds__wall">
        <div class="ds__spec ppt"><i>PPT</i></div>
        <div class="ds__spec xls"><i>XLS</i></div>
        <div class="ds__spec doc"><i>DOC</i></div>
        <div class="ds__swatch"><b style="background:#123B34"></b><b style="background:#2FA8A0"></b><b style="background:#C8A45C"></b><b style="background:#FAF8F4"></b></div>
      </div>

      <!-- 작업 자리: 듀얼 모니터 책상 + 캐릭터 -->
      <div class="desk docDesk" data-n="${s.n}" data-st="미출근">
        <span class="led"></span>
        <div class="seat">
          <div class="seat__chair">${officeChair(true)}</div>
          <div class="seat__person">${avatar(s)}</div>
          <!-- 다른 자리와 좌표계(112×62)를 똑같이 맞춘다. 어긋나면 캐릭터가 책상 위에 뜬다.
               구분은 '듀얼 모니터 + 색 견본 + 태블릿'으로 준다 — 디자인 작업 자리답게. -->
          <div class="seat__desk">
            <svg class="deskSvg" viewBox="0 0 112 62" width="112" height="62">
              <ellipse cx="56" cy="58" rx="46" ry="4" fill="rgba(0,0,0,.18)"/>
              <!-- 듀얼 모니터 -->
              <g class="monitor">
                <rect x="6" y="-1" width="30" height="21" rx="2" fill="#2A2430"/>
                <rect x="8" y="1" width="26" height="17" rx="1" fill="#8E7CC8" opacity=".9"/>
                <path d="M11 5h20M11 8h14M11 11h17" stroke="#F3EDFB" stroke-width="1.1" opacity=".8"/>
                <rect x="18" y="20" width="6" height="3" fill="#3A3444"/>
                <rect x="40" y="1" width="30" height="19" rx="2" fill="#2A2430"/>
                <rect x="42" y="3" width="26" height="15" rx="1" fill="#123B34"/>
                <rect x="44" y="5" width="10" height="11" fill="#2FA8A0" opacity=".85"/>
                <rect x="56" y="9" width="10" height="7" fill="#C8A45C" opacity=".8"/>
                <rect x="52" y="20" width="6" height="3" fill="#3A3444"/>
              </g>
              <!-- 색 견본 카드 -->
              <g class="papers">
                <rect x="76" y="6" width="13" height="14" rx=".8" fill="#FDFCFA" transform="rotate(-5 82 13)"/>
                <rect x="78" y="8" width="3" height="10" fill="#123B34" transform="rotate(-5 82 13)"/>
                <rect x="82" y="8" width="3" height="10" fill="#2FA8A0" transform="rotate(-5 82 13)"/>
                <rect x="86" y="8" width="2.6" height="10" fill="#C8A45C" transform="rotate(-5 82 13)"/>
              </g>
              <!-- 상판 -->
              <path d="M10 20h92l6 10H4z" fill="#7D6690"/>
              <path d="M4 30h104v5H4z" fill="#4A3A55"/>
              <path d="M4 35h104v1.6H4z" fill="#33283C" opacity=".5"/>
              <!-- 상판 위: 키보드 + 펜 태블릿 -->
              <g class="keyboard">
                <path d="M28 22h34l3 6H25z" fill="#E4DEEA"/>
                <path d="M29.4 23.6h31l1.4 3H28z" fill="#F7F4F9"/>
              </g>
              <g class="memo">
                <rect x="72" y="22" width="17" height="7" rx="1" fill="#EDE4F8"/>
                <rect x="74" y="23.4" width="13" height="4.2" rx=".6" fill="#fff"/>
                <path d="M92 22.6l4 5.4" stroke="#5B3D8C" stroke-width="1.4" stroke-linecap="round"/>
              </g>
              <!-- 다리 -->
              <rect x="10" y="36" width="5" height="18" fill="#33283C"/>
              <rect x="97" y="36" width="5" height="18" fill="#33283C"/>
            </svg>
          </div>
        </div>
        <div class="ds__plate"><b>${s.n}</b><span>${s.rank} · ${s.r}</span></div>
      </div>

      <!-- 프린터 + 출력물 -->
      <div class="ds__printer" title="프린터">
        <div class="pr__body"></div>
        <div class="pr__paper"></div>
        <span>프린터</span>
      </div>
    </div>

    <!-- 대기 중인 제작 요청 -->
    <div class="ds__queue" id="docQueue"></div>
  </div>

  <!-- 문서제작실 아래: 대표님이 바로 누르는 요청 버튼 -->
  <div class="dsButtons" style="left:${DOC_STUDIO.col*T}px;top:${(DOC_STUDIO.row + DOC_STUDIO.h + 0.35)*T}px;width:${DOC_STUDIO.w*T}px">
    <button class="dsBtn" data-doc="PPT">PPT 요청</button>
    <button class="dsBtn" data-doc="Excel">Excel 요청</button>
    <button class="dsBtn" data-doc="Word">Word 요청</button>
  </div>`;
}

/* 번역실 — 대표실 바로 옆 단독 부서방 (대표님 지시: "내 옆에다가").
   팀 룸과 똑같은 방식(책상·의자·명패·모니터 상태)으로 그리되 좌표만 layout.js 에 고정해 둔다.
   좌우 팀 룸 격자는 8칸이 정원이라 여기에 끼워 넣을 수 없어서다.
   방 아래에는 대표님이 바로 누르시는 "PPT 올려서 번역 맡기기" 버튼이 붙는다. */
function transRoomHTML(){
  const t = TEAMS.find(x => x.id === TRANS_ROOM.team);
  const mem = STAFF.filter(s => s.t === TRANS_ROOM.team)
                   .sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
  if(!t || !mem.length) return '';

  const slots = deskSlots(mem.length, TRANS_ROOM.w);
  const leader = mem.find(s => s.rank === '팀장');

  const desks = mem.map((s, i) => {
    const sl = slots[i];
    // 이 직원의 절대 좌표를 기억해둔다 (이동 목적지로 쓴다)
    deskPos[s.n] = { col: TRANS_ROOM.col + sl.col, row: TRANS_ROOM.row + sl.row, door: TRANS_ROOM.door, team: t.id };
    return `<div class="desk${s.rank==='팀장'?' leader':''}" data-n="${s.n}" data-st="미출근"
                 style="left:${sl.col*T}px;top:${sl.row*T}px">
        <span class="led"></span>
        <div class="seat">
          <div class="seat__chair">${officeChair(s.rank==='팀장')}</div>
          <div class="seat__person">${avatar(s)}</div>
          <div class="seat__desk">${workDesk(s.t, { isLeader: s.rank==='팀장' })}</div>
        </div>
        ${nameplate(s)}
      </div>`;
  }).join('');

  return `<div class="room function transRoom" id="room-${t.id}"
               style="${box(TRANS_ROOM)};--accent:${t.accent}"
               data-col="${TRANS_ROOM.col}" data-row="${TRANS_ROOM.row}">
    <div class="room__doorB" title="번역실 문"></div>
    <h3><span class="dot"></span>${TRANS_ROOM.name}<span class="kindTag" id="transState">대기</span></h3>
    <div class="sub">${t.sub} · ${mem.length}명${leader ? ` · 팀장 ${leader.n}` : ''}</div>
    <div class="desks">${desks}</div>
  </div>

  <!-- 번역실 아래: 대표님이 파일을 올려 바로 일을 시키시는 버튼 -->
  <div class="dsButtons trButtons"
       style="left:${TRANS_ROOM.col*T}px;top:${(TRANS_ROOM.row + TRANS_ROOM.h + 0.35)*T}px;width:${TRANS_ROOM.w*T}px">
    <button class="dsBtn trBtn" id="transUploadBtn">PPT 올려서 번역 맡기기</button>
  </div>`;
}

// 화장실 (맨 오른쪽, 휴게공간 아래)
function restroomHTML(){
  return `<div class="room2 restroom room--fixed" id="restroom" style="${box(RESTROOM)}"
               data-col="${RESTROOM.col}" data-row="${RESTROOM.row}">
    <div class="room__doorT"></div>
    <div class="room2__label">
      <svg class="ico" viewBox="0 0 24 24"><circle cx="8" cy="4.5" r="2" fill="#8FBFC6"/><path d="M5.5 9h5l1 6h-2v5h-3v-5h-2z" fill="#8FBFC6"/><circle cx="16.5" cy="4.5" r="2" fill="#C9A9D8"/><path d="M13.5 9h6l-1.5 6h-1v5h-2v-5h-1z" fill="#C9A9D8"/></svg>
      ${RESTROOM.name} <span class="en">${RESTROOM.nameEn}</span>
    </div>
    <div class="restroom__body">
      <div class="stall"><i></i></div>
      <div class="stall"><i></i></div>
      <div class="sink"><span></span><span></span></div>
    </div>
  </div>`;
}

// 정문 + 좌우 유리벽 + 안내 데스크 (도면 하단)
function entranceHTML(){
  const e = ENTRANCE;
  const wallH = 2.2;
  // 유리벽은 정문 좌우 짧은 구간에만 둔다 (팀 룸 위를 가로지르지 않게)
  const wallSpan = 4;   // 5 이면 왼쪽 벽이 안쪽 팀 룸(col 24까지)을 1칸 파고든다
  return `
    <!-- 유리벽에 회사명을 넣었더니 벽이 짧아 글자가 잘려 나갔다.
         정문 간판에 이미 AURAKOREA 가 크게 있으므로 벽은 유리만 둔다. -->
    <div class="glassWall left"  style="left:${(e.col-e.w/2-wallSpan)*T}px;top:${(e.row-0.4)*T}px;width:${wallSpan*T}px;height:${wallH*T}px"></div>
    <div class="glassWall right" style="left:${(e.col+e.w/2)*T}px;top:${(e.row-0.4)*T}px;width:${wallSpan*T}px;height:${wallH*T}px"></div>

    <div class="reception" style="${box(RECEPTION)}">
      <div class="reception__desk"></div>
      <div class="reception__sign">안내</div>
    </div>

    <div class="frontDoor" id="frontDoor"
         style="left:${(e.col-e.w/2)*T}px;top:${(e.row-1.4)*T}px;width:${e.w*T}px">
      <div class="doorHeader">
        <span class="logo">${COMPANY.name}</span>
        <span class="floorTag">${COMPANY.floor}</span>
      </div>
      <div class="doorFrame" id="entrance" data-col="${e.col}" data-row="${e.row}">
        <div class="doorLeaf l"><i></i></div>
        <div class="doorLeaf r"><i></i></div>
      </div>
      <div class="doorLabel">${e.label} · ${COMPANY.tagline}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   사무실 렌더링 — 절대 좌표 도면

   방을 CSS 그리드로 흘리지 않고 data/layout.js 의 타일 좌표에 그대로 놓는다.
   그래야 캐릭터가 복도를 따라 실제 위치로 걸어갈 수 있다.
   ═══════════════════════════════════════════════════════════════ */
const box = r => `left:${r.col*T}px;top:${r.row*T}px;width:${r.w*T}px;height:${r.h*T}px`;

export function buildFloor(){
  const byRank = (a,b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
  // 방 높이를 인원수에 맞춰 잡는다 (도면 세로를 줄여 한 화면에 들어오게 한다)
  // 단독 작업실을 쓰는 직원(강태오)은 팀 룸 자리 계산에서 뺀다 — 소속은 그대로다
  const inRoom = t => STAFF.filter(s => s.t === t && !s.solo);
  // room 이 지정된 팀(번역팀)은 자기 방을 쓰므로 좌우 격자에서 뺀다 — 격자는 8칸이 정원이다
  const gridTeams = TEAMS.filter(t => !t.room);
  const roomPos = layoutTeamRooms(
    gridTeams.map(t => ({ id: t.id, count: inRoom(t.id).length }))
  );

  /* ── 팀 룸 ── */
  const teamRooms = gridTeams.map(t => {
    const mem = inRoom(t.id).sort(byRank);
    const away = STAFF.filter(s => s.t === t.id && s.solo);
    const rp = roomPos[t.id];
    const slots = deskSlots(mem.length, rp.w);
    const leader = mem.find(s => s.rank === '팀장');

    const desks = mem.map((s, i) => {
      const sl = slots[i];
      // 이 직원의 절대 좌표를 기억해둔다 (이동 목적지로 쓴다)
      deskPos[s.n] = { col: rp.col + sl.col, row: rp.row + sl.row, door: rp.door, team: t.id };
      return `<div class="desk${s.rank==='팀장'?' leader':''}" data-n="${s.n}" data-st="미출근"
                   style="left:${sl.col*T}px;top:${sl.row*T}px">
          <span class="led"></span>
          <div class="seat">
            <div class="seat__chair">${officeChair(s.rank==='팀장')}</div>
            <div class="seat__person">${avatar(s)}</div>
            <div class="seat__desk">${workDesk(s.t, { isLeader: s.rank==='팀장' })}</div>
          </div>
          ${nameplate(s)}
        </div>`;
    }).join('');

    return `<div class="room ${t.kind} side-${rp.side}" id="room-${t.id}"
                 style="${box(rp)};--accent:${t.accent}"
                 data-col="${rp.col}" data-row="${rp.row}">
      <div class="room__doorT"></div>
      <h3><span class="dot"></span>${t.name}<span class="kindTag">${t.kind==='region'?'지역':'기능'}</span></h3>
      <div class="sub">${t.sub} · ${mem.length + away.length}명${leader?` · 팀장 ${leader.n}`:''}${
        away.length ? `<em class="soloNote">${away.map(a=>a.n).join('·')} 문서제작실 상주</em>` : ''}</div>
      <div class="desks">${desks}</div>
    </div>`;
  }).join('');

  /* ── 단독 작업실 자리 좌표 ──
     문서제작실 자리는 CSS 흐름으로 그려지므로, 이동 목적지로 쓸 절대 좌표는 여기서 정한다. */
  STAFF.filter(s => s.solo === 'docstudio').forEach(s => {
    deskPos[s.n] = {
      col: DOC_STUDIO.col + DOC_STUDIO.w / 2,
      row: DOC_STUDIO.row + DOC_STUDIO.h - 2.6,
      door: DOC_STUDIO.door,
      team: s.t,
    };
  });

  /* ── 보고 대기줄: 바닥 발자국 표시 ── */
  const queueMarks = CEO_QUEUE.map(q => `
    <div class="qmark" data-slot="${q.slot}" style="left:${q.col*T}px;top:${q.row*T}px">
      <svg viewBox="0 0 24 16" width="24" height="16">
        <ellipse cx="7" cy="8" rx="3.4" ry="5" fill="currentColor" opacity=".5"/>
        <ellipse cx="17" cy="9" rx="3.4" ry="5" fill="currentColor" opacity=".35"/>
      </svg>
      <span>${q.slot}</span>
    </div>`).join('');

  $('floor').innerHTML = `
    <div class="plan" style="width:${GRID.cols*T}px;height:${GRID.rows*T}px">

      <!-- 중앙 세로 복도 + 각 방 앞 가로 통로 -->
      <div class="corridorV" id="corridor"
           style="left:${CORRIDOR.x*T}px;top:${CORRIDOR.top*T}px;
                  width:${CORRIDOR.w*T}px;height:${(CORRIDOR.bottom-CORRIDOR.top)*T}px"></div>
      <!-- 각 팀 행 위를 가로지르는 통로 — 바깥쪽 열 방도 여기로 나와 복도까지 간다 -->
      ${ROW_CORRIDORS.map(r =>
        `<div class="corridorH" style="left:0;top:${(r-0.9)*T}px;width:${GRID.cols*T}px;height:${1.8*T}px"></div>`
      ).join('')}

      <!-- 대표실 -->
      <div class="ceoRoom room--fixed" style="${box(CEO_ROOM)}" data-col="${CEO_ROOM.col}" data-row="${CEO_ROOM.row}">
        <div class="ceoRoom__label">
          <svg class="crown" viewBox="0 0 24 24"><path d="M2 8l4 3 6-7 6 7 4-3-2 11H4L2 8z" fill="#E7C066"/></svg>
          대표실 <span class="en">EXECUTIVE OFFICE</span>
          <span class="ceoRoom__present"><i></i>재실중</span>
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
        <div class="room__doorB"></div>
      </div>

      <!-- 대표실 앞 보고 대기줄 (바닥 발자국) -->
      <div class="queueMarks">${queueMarks}</div>
      <div class="queueLabel" style="left:${(CORRIDOR.cx+2.2)*T}px;top:${(CEO_ROOM.row+CEO_ROOM.h+0.4)*T}px">보고 대기줄</div>
      <div id="queueLayer" class="queueLayer"></div>

      <!-- 본부장실 -->
      <div class="hqRoom room--fixed" id="hqRoom" style="${box(HQ_ROOM)}" data-col="${HQ_ROOM.col}" data-row="${HQ_ROOM.row}">
        <div class="hqRoom__label">
          본부장실 <span class="en">HQ OFFICE</span>
          <span class="hqRoom__present"><i></i>재실중</span>
        </div>
        <div class="hqRoom__scene">
          <div class="hqRoom__deskWrap">
            ${hqScene()}
            <div class="hqRoom__nameplate">${HQ_MANAGER.name} · ${HQ_MANAGER.title}</div>
          </div>
          <div class="hqRoom__status">현재 <b id="hqStatus">대표님 지시 대기</b></div>
        </div>
        <div class="room__doorB"></div>
      </div>

      <!-- 미팅룸 (본부장실 바로 아래) + 소집 버튼 -->
      ${meetingRoomHTML()}

      <!-- 팀 룸 -->
      ${teamRooms}

      <!-- 왼쪽 위: 문서제작실 (Excel · PPT · Word 전담) -->
      ${docStudioHTML()}

      <!-- 대표실 오른쪽: 번역실 (PPT 원문보존 번역) -->
      ${transRoomHTML()}

      <!-- 맨 오른쪽: 휴게공간 · 화장실 -->
      ${loungeHTML()}
      ${restroomHTML()}

      <!-- 정문 -->
      ${entranceHTML()}

      <div id="walkers" class="walkers"></div>
    </div>
  `;

  $('staffCount').textContent = 'AI STAFF ' + STAFF.length;
  document.querySelectorAll('.desk').forEach(d => {
    d.onclick = () => select(d.dataset.n);
  });
  fitPlan();
  registerMeetingSeatPositions();
}

/* ═══════════ 도면을 한 화면에 맞춘다 ═══════════
   도면 원본은 타일 좌표 그대로 두고, 보이는 크기만 축소한다.
   좌표 계산은 원본 기준이므로 이동 로직은 그대로 동작한다. */
let planScale = 1;
export function getPlanScale(){ return planScale; }

export function fitPlan(){
  const plan = document.querySelector('.plan');
  const floor = $('floor');
  if(!plan || !floor) return;

  // 도면 영역이 실제로 쓸 수 있는 공간을 그대로 쓴다 (창 높이가 아니라 영역 높이)
  const padding = 22;
  const availW = floor.clientWidth  - padding;
  const availH = floor.clientHeight - padding;

  const w = GRID.cols * T, h = GRID.rows * T;
  planScale = Math.min(availW / w, availH / h, 1);

  plan.style.transformOrigin = 'top left';
  plan.style.transform = `scale(${planScale})`;
  // 축소된 만큼만 자리를 차지하게 하고, 남는 가로 여백은 좌우로 나눠 가운데 놓는다
  const gapX = Math.max(0, availW - w * planScale);
  plan.style.marginLeft   = `${gapX / 2}px`;
  plan.style.marginRight  = `${-(w - w * planScale) + gapX / 2}px`;
  plan.style.marginBottom = `${-(h - h * planScale)}px`;
}

// 창 크기가 바뀌면 다시 맞춘다
let fitTimer = null;
if(typeof window !== 'undefined'){
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { fitPlan(); registerMeetingSeatPositions(); }, 150);
  });
}

/* 미팅룸 좌석의 절대 좌표를 등록한다 (회의 참석자가 여기로 걸어간다).
   화면이 축소돼 있으면 getBoundingClientRect 값도 축소돼 있으므로 배율로 되돌린다. */
function registerMeetingSeatPositions(){
  const planEl = document.querySelector('.plan');
  if(!planEl) return;
  const pr = planEl.getBoundingClientRect();
  const s = planScale || 1;
  document.querySelectorAll('.mseat').forEach(el => {
    const r = el.getBoundingClientRect();
    registerMeetingSeat(el.dataset.seat, {
      col: ((r.left - pr.left + r.width/2)  / s) / T,
      row: ((r.top  - pr.top  + r.height/2) / s) / T,
    });
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
  const R = st.lastReal;
  const realBlock = R ? `
    <div class="realResult">
      <b>시장조사 보고 <span>${new Date(R.at).toLocaleString('ko-KR')}</span></b>
      ${R.headline ? `<div class="rrHead">${escapeHtml(R.headline)}</div>` : ''}
      ${R.keyPoints?.length ? `<div class="rrKey"><i>핵심 포인트</i><ul>${
        R.keyPoints.map(k=>`<li>${escapeHtml(k)}</li>`).join('')}</ul></div>` : ''}
      <div>${escapeHtml(R.text).replace(/\n/g,'<br>')}</div>
      ${R.watchOut ? `<div class="rrWarn"><i>주의</i>${escapeHtml(R.watchOut)}</div>` : ''}
      ${R.sources?.length ? `<ul class="sources">${R.sources.map(src=>`<li><a href="${escapeHtml(src.url)}" target="_blank" rel="noopener">${escapeHtml(src.title)}</a></li>`).join('')}</ul>` : ''}
      ${R.note ? `<div class="note">${escapeHtml(R.note)}</div>` : ''}
    </div>` : '';
  const leaderName = LEADER_OF[s.t];
  $('detail').innerHTML = `
    <h4>${s.n} <span class="rankTag${s.rank==='팀장'?' lead':''}">${s.rank}</span></h4>
    <div class="kv"><span>담당</span><span>${s.r}</span></div>
    <div class="kv"><span>소속</span><span>${TEAMS.find(t=>t.id===s.t).name}</span></div>
    ${s.rank!=='팀장' ? `<div class="kv"><span>직속 팀장</span><span>${leaderName}</span></div>` : ''}
    <div class="kv"><span>출근시간</span><span>${hhmm(WORK_HOURS.start)}</span></div>
    <div class="kv"><span>현재 상태</span><span>${st.st}</span></div>
    <div class="kv"><span>오늘 처리</span><span>${st.done}건</span></div>
    <div class="duty">${s.duty}</div>
    <button class="go" id="goBtn">이 직원에게 직접 지시</button>
    ${realBlock}
    ${s.docPro ? `<div id="docReq"></div><div id="folio"></div>` : ''}
    ${s.t === 'trans' ? `<div id="transReq"></div>` : ''}`;
  // 지시창에 @이름을 미리 넣어 둔다 — 누구에게 시키는지 헷갈리지 않게 한다
  $('goBtn').onclick = ()=>{
    const cmd = $('cmd');
    cmd.value = `@${s.n} `;
    cmd.focus();
    cmd.placeholder = `${s.n}에게 지시…`;
  };
  if(s.docPro) renderDocPanel();
  if(s.t === 'trans') renderTransPanel();
  paint(simMin);
}

/* 번역팀 전용 패널 — 대표님이 맡기신 번역 건 목록 */
async function renderTransPanel(){
  const box = $('transReq');
  if(!box) return;
  const { jobListHTML, bindJobList, openUpload } = await import('./transdesk.js');
  box.innerHTML = `<button class="seeDocs" id="newTrans">PPT 올려서 번역 맡기기</button>` + jobListHTML();
  bindJobList(box);
  const btn = $('newTrans');
  if(btn) btn.onclick = () => openUpload();
}

/* 문서 제작 담당 전용 패널 — 대표님 요청 목록 + 지금까지 만든 문서 */
async function renderDocPanel(){
  const { requestListHTML, bindRequestList } = await import('./docdesk.js');
  const box = $('docReq');
  if(box){
    box.innerHTML = `<button class="seeDocs" id="seeDocs">만든 문서 열어 보기 · 파일 받기</button>`
                  + requestListHTML();
    bindRequestList(box);
    const btn = $('seeDocs');
    if(btn) btn.onclick = async () => {
      const { openDocuments } = await import('./viewer.js');
      openDocuments();
    };
  }
  renderPortfolio();
}

/* 문서 제작 담당의 실제 산출물. 만든 문서를 그대로 렌더한 미리보기를 보여준다.
   AI를 호출하지 않는다 — 이미 만들어 둔 파일 목록을 읽어올 뿐이다. */
let folioCache = null;
async function renderPortfolio(){
  const box = $('folio');
  if(!box) return;
  if(!folioCache){
    try{
      const res = await fetch('/data/doc-portfolio.json', { cache:'no-store' });
      folioCache = await res.json();
    }catch(e){ return; }
  }
  if(!$('folio')) return;   // 그 사이 다른 직원을 클릭했으면 그리지 않는다
  const f = folioCache;
  $('folio').innerHTML = `
    <div class="folio">
      <b>제작한 문서 <span>${f.items.length}건</span></b>
      ${f.items.map(it=>`
        <div class="folioItem">
          <div class="fiHead"><span class="fiType t${it.type}">${it.type}</span>${escapeHtml(it.title)}<i>${escapeHtml(it.pages)}</i></div>
          <div class="fiSum">${escapeHtml(it.summary)}</div>
          ${it.shots.length ? `<div class="fiShots">${it.shots.map(sh=>`
            <figure><img src="${escapeHtml(sh.src)}" alt="${escapeHtml(sh.cap)}" loading="lazy"><figcaption>${escapeHtml(sh.cap)}</figcaption></figure>`).join('')}</div>` : ''}
          <div class="fiPath">${escapeHtml(it.file)}</div>
        </div>`).join('')}
      <div class="note">${escapeHtml(f.note)}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   평상시 자동 움직임 — 순수 화면 연출

   ★ AI를 호출하지 않는다. API 요청이 단 한 번도 발생하지 않는다.
   ★ 이동 사유는 data/layout.js 의 IDLE_ACTIVITIES 에서 무작위로 고른다 (생성하지 않는다).
   ★ 동시에 자리를 비우는 인원은 IDLE_MAX_CONCURRENT(3명)로 제한한다.
   ★ 업무 로그를 더럽히지 않는다 — "사내 활동" 로그로 따로 남긴다.
   ═══════════════════════════════════════════════════════════════ */
let idleActive = 0;
export function idleCount(){ return idleActive; }

/* 목적지 좌표를 고른다 (휴게공간 / 화장실 / 다른 팀 / 복도) */
function idleTarget(activity, me){
  if(activity.to === 'lounge')
    return { col: LOUNGE.col + 3, row: LOUNGE.row + 6, door: LOUNGE.door };
  if(activity.to === 'restroom')
    return { col: RESTROOM.col + 4, row: RESTROOM.row + 4, door: RESTROOM.door };
  if(activity.to === 'team'){
    const others = STAFF.filter(x => x.t !== me.t && deskPos[x.n]);
    if(!others.length) return null;
    const other = others[Math.floor(Math.random() * others.length)];
    const d = deskPos[other.n];
    return { col: d.col - 1.2, row: d.row + 0.8, door: d.door, who: other.n };
  }
  // 복도를 그냥 지나간다
  return { col: CORRIDOR.cx, row: CORRIDOR.top + 4 + Math.random() * (CORRIDOR.bottom - CORRIDOR.top - 8) };
}

/* 한 명을 잠깐 자리에서 내보냈다가 반드시 자기 자리로 복귀시킨다 */
export function idleWander(name, activity, simMin, onLog){
  if(idleActive >= IDLE_MAX_CONCURRENT) return Promise.resolve(false);
  const s = STAFF.find(x => x.n === name);
  const desk = deskPos[name];
  if(!s || !desk || state[name].away) return Promise.resolve(false);

  const target = idleTarget(activity, s);
  if(!target) return Promise.resolve(false);

  idleActive++;
  return withWalkLock(name, async () => {
    state[name].away = true;
    if(activity.say) state[name].bubble = activity.say;
    paint(simMin);
    if(onLog) onLog(`${name} — ${activity.label}`);

    const w = spawnWalker(s);
    placeAt(w, desk);
    await walkBetween(w, desk, target);
    await new Promise(r => setTimeout(r, activity.stayMs / walkSpeed));
    await walkBetween(w, target, desk);   // 반드시 자기 자리로 복귀
    w.remove();

    state[name].away = false;
    state[name].bubble = null;
    paint(simMin);
    return true;
  }).finally(() => { idleActive--; });
}

export function initOffice(){
  buildFloor();
  paint(SIM_WINDOW.open);
  renderAgenda();
}

/* 도면 위 회의 소집 버튼을 meeting.js 의 동작에 연결한다 */
export function bindFloorMeetingButtons(handlers){
  document.querySelectorAll('[data-mtf]').forEach(b => {
    b.onclick = () => handlers[b.dataset.mtf] && handlers[b.dataset.mtf]();
  });
}

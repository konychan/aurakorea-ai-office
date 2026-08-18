import { STAFF, TASKS, AGENDAS, CHATS } from '../data/staff.js';
import { WORK_HOURS, SIM_WINDOW, IDLE_ACTIVITIES, IDLE_MAX_CONCURRENT } from '../data/layout.js';
import { $, state, paint, log, select, selected, submitAgenda, resolveAgenda,
         arriveWalk, leaveWalk, chatWith, setWalkSpeed, idleWander, idleCount } from './office.js';
import { runRealAgent } from './agent.js';
import { submitForReview } from './orchestrator.js';
import { meeting } from './meeting.js';

const CHAT_BY_SENDER = {};
CHATS.forEach(c => { (CHAT_BY_SENDER[c.from] ||= []).push(c); });

let simMin = SIM_WINDOW.open;
let running = false;
let speed = 1;
let track = true;

export function getSimMin(){ return simMin; }

/* ═══════════ 사내 활동 로그 — 업무 로그와 완전히 분리한다 ═══════════ */
function idleLog(simMin, msg){
  const el = $('idleLog');
  if(!el) return;
  const d = document.createElement('div');
  d.innerHTML = `<span class="t">${String(Math.floor(simMin/60)%24).padStart(2,'0')}:${String(simMin%60).padStart(2,'0')}</span>${msg}`;
  el.prepend(d);
  while(el.childNodes.length > 40) el.lastChild.remove();
}

/* ═══════════ 평상시 자동 움직임 ═══════════
   ★ AI를 호출하지 않는다. 미리 정의된 목록에서 무작위로 고르는 순수 연출이다.
   ★ 동시에 자리를 비우는 인원은 최대 3명(IDLE_MAX_CONCURRENT). */
let nextIdleAt = 0;
function maybeIdleWander(){
  if(!running) return;
  if(meeting.active) return;                       // 회의 중에는 돌아다니지 않는다
  if(simMin < WORK_HOURS.start || simMin >= WORK_HOURS.end) return;
  if(simMin < nextIdleAt) return;
  if(idleCount() >= IDLE_MAX_CONCURRENT) return;

  // 지금 자리에서 일하고 있는 사람 중에서만 고른다
  const pool = STAFF.filter(s => {
    const st = state[s.n];
    return !st.away && (st.st === '근무중' || st.st === '처리중');
  });
  if(!pool.length) return;

  const s = pool[Math.floor(Math.random() * pool.length)];
  const act = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)];
  nextIdleAt = simMin + 20 + Math.floor(Math.random() * 40);   // 사내 시각 기준 간격

  idleWander(s.n, act, simMin, msg => idleLog(simMin, msg));
}

let trackTimer = null;
function focusRoom(tid){
  document.querySelectorAll('.room').forEach(r=>r.classList.remove('track'));
  $('room-'+tid).classList.add('track');
  clearTimeout(trackTimer);
  trackTimer = setTimeout(()=>$('room-'+tid).classList.remove('track'), 2000);
}

function tick(){
  if(!running) return;
  simMin += 5*speed;
  if(simMin >= SIM_WINDOW.close){
    simMin = SIM_WINDOW.close; running=false;
    log(simMin, '시스템','전 직원 퇴근. 하루 업무를 마감하고 대표님께 종합 보고드립니다.');
  }

  STAFF.forEach(s=>{
    const st = state[s.n];
    if(st.bubble && simMin - st.bt > 40) st.bubble = null;
    if(st.st==='보고대기') return;
    if(st.st==='회의 참석 중') return;      // 회의 중인 사람은 업무를 새로 시작하지 않는다

    if(simMin < WORK_HOURS.start) st.st='미출근';
    else if(simMin >= WORK_HOURS.end){
      if(st.st !== '퇴근'){
        st.st='퇴근';
        log(simMin, s.n, '퇴근. 정문으로 이동합니다.');
        leaveWalk(s.n, simMin);
      }
    } else if(st.st==='미출근' || st.st==='퇴근'){
      st.st='근무중';
      log(simMin, s.n, `출근. ${s.r} 업무 시작.`);
      arriveWalk(s.n, simMin);
    } else if(Math.random() < 0.02*speed){
      const ag = AGENDAS[s.t][Math.floor(Math.random()*AGENDAS[s.t].length)];
      submitAgenda(s.n, ag, simMin);
      log(simMin, s.n, `"${ag.t}" 결재 상신. 대표님 결재를 기다립니다.`);
      if(track) focusRoom(s.t);
    } else if(CHAT_BY_SENDER[s.n] && simMin >= (st.nextChatAt||0) && Math.random() < 0.03*speed){
      const options = CHAT_BY_SENDER[s.n];
      const c = options[Math.floor(Math.random()*options.length)];
      const reply = c.replies[Math.floor(Math.random()*c.replies.length)];
      st.nextChatAt = simMin + 45; // 같은 직원이 연달아 대화를 시작하지 못하도록 쿨다운
      chatWith(s.n, c.to, c.ask, reply, simMin);
      if(track) focusRoom(s.t);
    } else if(s.real){
      // 1호 실제 에이전트: 가짜 업무 목록 대신, 쿨다운이 지나면 실제 웹 검색을 수행한다
      if(!st.runningReal && simMin >= (st.nextRealAt||0) && Math.random() < 0.15*speed){
        st.nextRealAt = simMin + 60; // 사내 시각 기준 1시간에 한 번꼴로 제한 (실제 API 비용 발생)
        runRealAgent(s.n, simMin);
        if(track) focusRoom(s.t);
      }
    } else if(Math.random() < 0.13*speed){
      const task = TASKS[s.t][Math.floor(Math.random()*TASKS[s.t].length)];
      st.st='처리중'; st.done++; st.bubble=task; st.bt=simMin;
      log(simMin, s.n, task+' 완료.');
      setTimeout(()=>{ if(state[s.n].st==='처리중') state[s.n].st='근무중'; paint(simMin); }, 1600);
      if(track) focusRoom(s.t);

      // 완료한 업무 중 일부는 팀장 검증 → 본부장 검토를 거쳐 대표 보고 대기열에 오른다 (헌장 14항)
      if(Math.random() < 0.25){
        submitForReview({
          name: s.n,
          title: task,
          result: `${task} 처리를 마쳤습니다. 담당 범위 내 이슈는 없었습니다.`,
          tests: '내부 대조 확인 완료',
          uncertain: '',
        }, simMin);
      }
    }
  });
  maybeIdleWander();          // 평상시 자동 움직임 (AI 호출 없음)
  paint(simMin);
  if(selected) select(selected, simMin);
}

export function initSim(){
  $('startBtn').onclick = ()=>{ running=true; log(simMin, '시스템','업무 시작. 자동화 운영 ON.'); };
  $('pauseBtn').onclick = ()=>{ running=false; log(simMin, '시스템','일시정지.'); };
  $('speedSeg').onclick = e=>{
    const b=e.target.closest('button'); if(!b) return;
    speed=+b.dataset.sp;
    setWalkSpeed(speed);      // 배속을 걷는 속도에 반영한다
    [...$('speedSeg').children].forEach(x=>x.classList.toggle('on',x===b));
  };
  $('trackBtn').onclick = e=>{
    track=!track;
    e.target.classList.toggle('on',track);
    e.target.textContent = '자동 추적 '+(track?'ON':'OFF');
  };
  $('agendaQueue').onclick = e=>{
    const b = e.target.closest('button[data-act]'); if(!b) return;
    // "내용 보기"는 결재가 아니다. 여기서 걸러내지 않으면 열어 보려다 반려되어 버린다.
    if(b.dataset.act === 'see') return;
    resolveAgenda(+b.dataset.id, b.dataset.act==='approve', simMin);
  };
  setInterval(tick, 1000);
}

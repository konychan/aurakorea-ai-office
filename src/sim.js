import { STAFF, TASKS, AGENDAS } from '../data/staff.js';
import { WORK_HOURS, SIM_WINDOW } from '../data/layout.js';
import { $, state, paint, log, select, selected, submitAgenda, resolveAgenda } from './office.js';

let simMin = SIM_WINDOW.open;
let running = false;
let speed = 1;
let track = true;

export function getSimMin(){ return simMin; }

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

    if(simMin < WORK_HOURS.start) st.st='미출근';
    else if(simMin >= WORK_HOURS.end) st.st='퇴근';
    else if(st.st==='미출근' || st.st==='퇴근'){
      st.st='근무중';
      log(simMin, s.n, `출근. ${s.r} 업무 시작.`);
    } else if(Math.random() < 0.02*speed){
      const title = AGENDAS[s.t][Math.floor(Math.random()*AGENDAS[s.t].length)];
      submitAgenda(s.n, title, simMin);
      log(simMin, s.n, `"${title}" 결재 상신. 대표님 결재를 기다립니다.`);
      if(track) focusRoom(s.t);
    } else if(Math.random() < 0.13*speed){
      const task = TASKS[s.t][Math.floor(Math.random()*TASKS[s.t].length)];
      st.st='처리중'; st.done++; st.bubble=task; st.bt=simMin;
      log(simMin, s.n, task+' 완료.');
      setTimeout(()=>{ if(state[s.n].st==='처리중') state[s.n].st='근무중'; paint(simMin); }, 1600);
      if(track) focusRoom(s.t);
    }
  });
  paint(simMin);
  if(selected) select(selected, simMin);
}

export function initSim(){
  $('startBtn').onclick = ()=>{ running=true; log(simMin, '시스템','업무 시작. 자동화 운영 ON.'); };
  $('pauseBtn').onclick = ()=>{ running=false; log(simMin, '시스템','일시정지.'); };
  $('speedSeg').onclick = e=>{
    const b=e.target.closest('button'); if(!b) return;
    speed=+b.dataset.sp;
    [...$('speedSeg').children].forEach(x=>x.classList.toggle('on',x===b));
  };
  $('trackBtn').onclick = e=>{
    track=!track;
    e.target.classList.toggle('on',track);
    e.target.textContent = '자동 추적 '+(track?'ON':'OFF');
  };
  $('agendaQueue').onclick = e=>{
    const b = e.target.closest('button[data-act]'); if(!b) return;
    resolveAgenda(+b.dataset.id, b.dataset.act==='approve', simMin);
  };
  setInterval(tick, 1000);
}

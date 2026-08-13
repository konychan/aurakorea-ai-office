import { STAFF } from '../data/staff.js';
import { TEAMS } from '../data/teams.js';
import { CEO, HQ_MANAGER, MEETING_ROOM } from '../data/layout.js';
import { $, state, paint, log, hhmm, escapeHtml,
         walkToMeeting, walkFromMeeting, walkVipToMeeting, walkVipFromMeeting,
         setSpeaker, setMeetingState, setProjector } from './office.js';

/* ═══════════════════════════════════════════════════════════════
   회의 시스템 (F 국면 · 헌장 15~17항)

   대표님의 회의 명령이 없으면 임의로 소집하지 않는다.
   소집 → 참석자 이동·착석 → 대표 입장 → 발언 진행(한 번에 한 명) → 종료·복귀.
   캐릭터 이동과 자료 표시는 전부 로컬 처리라 토큰을 쓰지 않는다.
   ═══════════════════════════════════════════════════════════════ */

export const meeting = {
  active: false,
  phase: 'idle',        // idle | gathering | ready | running | closed
  title: '',
  attendees: [],        // 팀장 이름 배열
  speakerIdx: -1,
  decisions: [],        // { who, team, decision, note }
  followUps: [],
};

const teamName = id => (TEAMS.find(t => t.id === id) || {}).name || id;
const leaderOfTeam = id => STAFF.find(s => s.t === id && s.rank === '팀장');

/* 대표님의 회의 소집 명령을 알아듣는다 (헌장 16항) */
const CALL_PATTERNS = [
  { re: /지역\s*팀장|지역팀장들|지역본부/, scope: 'region', title: '지역팀장 회의' },
  { re: /팀장\s*회의|전체\s*회의|다\s*모여/, scope: 'all',    title: '전체 팀장 회의' },
  { re: /미팅룸에?\s*모이|회의\s*소집|회의\s*시작하?자|모이자/, scope: 'all', title: '팀장 회의' },
];

export function detectMeetingCall(text){
  for(const p of CALL_PATTERNS){
    if(p.re.test(text)) return { scope: p.scope, title: p.title };
  }
  return null;
}

/* ═══════════ 1) 소집 ═══════════ */
export async function callMeeting({ scope = 'all', title = '팀장 회의' } = {}, simMin){
  if(meeting.active) return false;   // 이미 회의 중이면 새로 소집하지 않는다

  const teams = scope === 'region'
    ? TEAMS.filter(t => t.kind === 'region')
    : TEAMS;
  const leaders = teams.map(t => leaderOfTeam(t.id)).filter(Boolean);

  meeting.active = true;
  meeting.phase = 'gathering';
  meeting.title = title;
  meeting.attendees = leaders.map(s => s.n);
  meeting.speakerIdx = -1;
  meeting.decisions = [];
  meeting.followUps = [];

  setMeetingState(true, '소집 중');
  const prev = $('meetingResult');
  if(prev) prev.innerHTML = '';   // 지난 회의 결과는 지운다
  setProjector(`<div class="pj"><b>${escapeHtml(title)}</b><span>참석자 이동 중…</span></div>`);
  log(simMin, `${CEO.name} 대표`, `"${title}" 소집.`);
  log(simMin, `${HQ_MANAGER.name} 본부장`, `참석자 ${leaders.length}명에게 소집을 전달했습니다.`);
  renderMeetingPanel();

  // 참석자 이동 — 통로에서 뭉치지 않도록 조금씩 시차를 둔다
  const walks = leaders.map((s, i) =>
    new Promise(r => setTimeout(r, i * 260)).then(() => {
      state[s.n].st = '회의 참석 중';
      return walkToMeeting(s.n, simMin);
    })
  );
  // 본부장이 먼저 들어가 참석자를 확인한다
  walks.push(walkVipToMeeting('hq', HQ_MANAGER));
  await Promise.all(walks);

  log(simMin, `${HQ_MANAGER.name} 본부장`, '참석자 착석을 확인했습니다. 대표님을 모시겠습니다.');
  // 대표님도 대표실에서 일어나 미팅룸까지 직접 이동한다 (헌장 16항)
  await walkVipToMeeting('ceo', CEO);

  meeting.phase = 'ready';
  setMeetingState(true, '개회 대기');
  setProjector(`<div class="pj"><b>${escapeHtml(title)}</b><span>전원 착석 · 대표님 개회를 기다립니다</span></div>`);
  log(simMin, `${CEO.name} 대표`, '미팅룸 상석에 착석. 회의 시작을 기다립니다.');
  renderMeetingPanel();
  paint(simMin);
  return true;
}

/* ═══════════ 2) 회의 시작 / 발언 진행 ═══════════ */
export function startMeeting(simMin){
  if(meeting.phase !== 'ready') return;
  meeting.phase = 'running';
  setMeetingState(true, '회의 중');
  log(simMin, `${CEO.name} 대표`, '회의를 시작합니다.');
  nextSpeaker(simMin);
}

export function nextSpeaker(simMin){
  if(meeting.phase !== 'running') return;
  meeting.speakerIdx++;
  if(meeting.speakerIdx >= meeting.attendees.length){
    meeting.speakerIdx = meeting.attendees.length - 1;
    setProjector(`<div class="pj"><b>${escapeHtml(meeting.title)}</b><span>모든 팀 보고가 끝났습니다. 회의를 종료해 주세요.</span></div>`);
    renderMeetingPanel();
    return;
  }
  speakBy(meeting.attendees[meeting.speakerIdx], simMin);
}

export function pickSpeaker(name, simMin){
  const i = meeting.attendees.indexOf(name);
  if(i < 0) return;
  meeting.speakerIdx = i;
  speakBy(name, simMin);
}

function speakBy(name, simMin){
  const s = STAFF.find(x => x.n === name);
  if(!s) return;
  setSpeaker(name);

  // 프로젝터에 현재 발언자의 팀 현황을 띄운다 (이미 있는 데이터라 토큰을 쓰지 않는다)
  const mem = STAFF.filter(x => x.t === s.t);
  const done = mem.reduce((n, x) => n + state[x.n].done, 0);
  const busy = mem.filter(x => state[x.n].st === '처리중').length;
  setProjector(`
    <div class="pj pj--report">
      <b>${escapeHtml(teamName(s.t))}</b>
      <div class="pj__who">발언 · ${escapeHtml(name)} 팀장</div>
      <div class="pj__kv"><span>팀 인원</span><i>${mem.length}명</i></div>
      <div class="pj__kv"><span>오늘 처리</span><i>${done}건</i></div>
      <div class="pj__kv"><span>진행 중</span><i>${busy}건</i></div>
    </div>`);
  log(simMin, `${name} 팀장`, `${teamName(s.t)} 진행 상황을 보고합니다.`);
  state[name].bubble = '보고 중';
  renderMeetingPanel();
}

/* ═══════════ 3) 대표님 결정 ═══════════ */
export function meetingDecision(kind, simMin){
  if(meeting.phase !== 'running') return;
  const name = meeting.attendees[meeting.speakerIdx];
  if(!name) return;
  const s = STAFF.find(x => x.n === name);
  const label = { approve:'승인', hold:'보류', reject:'반려', revise:'보완 지시' }[kind] || kind;

  meeting.decisions.push({ who:name, team:s.t, decision:label });
  if(kind === 'revise' || kind === 'reject'){
    meeting.followUps.push({ who:name, team:s.t, task:`${teamName(s.t)} 보완 후 재보고` });
  }
  log(simMin, `${CEO.name} 대표`, `${name} 팀장 보고 ${label}.`);
  state[name].bubble = label;
  renderMeetingPanel();
}

/* 회의에서 추가 조사·후속 업무를 지정한다.
   실제 조사 실행은 대표님 승인 범위를 넘을 수 있으므로 여기서는 후속 과제로만 등록한다. */
export function addFollowUp(text, simMin){
  const name = meeting.attendees[meeting.speakerIdx];
  const s = STAFF.find(x => x.n === name);
  if(!s || !text.trim()) return;
  meeting.followUps.push({ who:name, team:s.t, task:text.trim() });
  log(simMin, `${CEO.name} 대표`, `후속 업무 지정 → ${name} 팀장: "${text.trim()}"`);
  renderMeetingPanel();
}

/* ═══════════ 4) 종료 ═══════════ */
export async function endMeeting(simMin){
  if(!meeting.active) return;
  meeting.phase = 'closed';
  setSpeaker(null);
  setMeetingState(true, '정리 중');
  log(simMin, `${HQ_MANAGER.name} 본부장`, '결정 사항과 후속 업무를 정리했습니다.');

  renderMeetingResult(simMin);
  setProjector(`<div class="pj"><b>${escapeHtml(meeting.title)} 종료</b><span>결정 ${meeting.decisions.length}건 · 후속 ${meeting.followUps.length}건</span></div>`);

  // 참석자 복귀
  await walkVipFromMeeting('ceo', CEO);
  const backs = meeting.attendees.map((n, i) =>
    new Promise(r => setTimeout(r, i * 240)).then(() => {
      state[n].st = '근무중';
      state[n].bubble = null;
      return walkFromMeeting(n, simMin);
    })
  );
  backs.push(walkVipFromMeeting('hq', HQ_MANAGER));
  await Promise.all(backs);

  log(simMin, '시스템', '전원 자리 복귀. 회의를 종료합니다.');
  meeting.active = false;
  meeting.phase = 'idle';
  setMeetingState(false);
  setProjector(null);
  renderMeetingPanel();
  paint(simMin);
}

/* ═══════════ 화면 ═══════════ */
export function renderMeetingPanel(){
  const el = $('meetingPanel');
  if(!el) return;
  const p = meeting.phase;

  if(!meeting.active){
    el.innerHTML = `
      <div class="mtCall">
        <div class="empty">회의가 없습니다. 대표님이 소집하시면 팀장들이 미팅룸으로 모입니다.</div>
        <div class="mtCall__btns">
          <button data-mt="call-region">지역팀장 소집</button>
          <button data-mt="call-all" class="primary">전체 팀장 소집</button>
        </div>
      </div>`;
    return;
  }

  const speaker = meeting.attendees[meeting.speakerIdx];
  const list = meeting.attendees.map(n => {
    const dec = meeting.decisions.find(d => d.who === n);
    return `<button class="mtWho${n===speaker?' on':''}" data-mt="pick" data-who="${escapeHtml(n)}">
      ${escapeHtml(n)}${dec?`<i>${escapeHtml(dec.decision)}</i>`:''}
    </button>`;
  }).join('');

  el.innerHTML = `
    <div class="mtHead">
      <b>${escapeHtml(meeting.title)}</b>
      <span class="mtPhase">${{gathering:'소집 중',ready:'개회 대기',running:'진행 중',closed:'정리 중'}[p]||''}</span>
    </div>
    <div class="mtWhos">${list}</div>
    ${p==='ready' ? `<button class="mtBtn primary" data-mt="start">회의 시작</button>` : ''}
    ${p==='running' ? `
      <div class="mtDec">
        <button data-mt="dec-approve" class="ok">승인</button>
        <button data-mt="dec-revise" class="warn">보완 지시</button>
        <button data-mt="dec-hold">보류</button>
        <button data-mt="dec-reject" class="no">반려</button>
      </div>
      <div class="mtRow">
        <input id="mtFollow" placeholder="후속 업무 지정 (선택)">
        <button data-mt="follow">지정</button>
      </div>
      <div class="mtDec2">
        <button data-mt="next">다음 발표자</button>
        <button data-mt="end" class="end">회의 종료</button>
      </div>` : ''}
    ${p==='gathering' ? `<div class="empty">참석자들이 미팅룸으로 이동하고 있습니다…</div>` : ''}
  `;
}

function renderMeetingResult(simMin){
  const el = $('meetingResult');
  if(!el) return;
  const row = (k,v) => `<div class="mrRow"><span>${k}</span><div>${v}</div></div>`;
  const decs = meeting.decisions.length
    ? meeting.decisions.map(d => `${escapeHtml(d.who)} 팀장 — ${escapeHtml(d.decision)}`).join('<br>')
    : '기록된 결정 없음';
  const fups = meeting.followUps.length
    ? meeting.followUps.map(f => `${escapeHtml(f.who)} 팀장 · ${escapeHtml(teamName(f.team))} — ${escapeHtml(f.task)}`).join('<br>')
    : '없음';

  el.innerHTML = `
    <div class="mr">
      <div class="mr__head">${escapeHtml(meeting.title)} <i>${hhmm(simMin)} 종료</i></div>
      ${row('참석자', meeting.attendees.map(escapeHtml).join(', ') + `, ${HQ_MANAGER.name} 본부장, ${CEO.name} 대표`)}
      ${row('대표님 결정', decs)}
      ${row('후속 업무', fups)}
      ${row('담당', meeting.followUps.length ? '각 팀장 책임 하에 진행' : '해당 없음')}
      ${row('다음 보고', meeting.followUps.length ? '보완 완료 시 본부장 검토 후 보고 대기열 등록' : '정기 보고 시')}
      ${row('추가 승인 필요', '조사 범위를 넘는 후속 업무는 대표님 승인 후 착수')}
    </div>`;
}

export function initMeeting(getSimMin){
  const panel = $('meetingPanel');
  if(panel) panel.onclick = e => {
    const b = e.target.closest('button[data-mt]');
    if(!b) return;
    const simMin = getSimMin();
    const a = b.dataset.mt;
    if(a === 'call-all')       callMeeting({ scope:'all',    title:'전체 팀장 회의' }, simMin);
    else if(a === 'call-region') callMeeting({ scope:'region', title:'지역팀장 회의' }, simMin);
    else if(a === 'start')     startMeeting(simMin);
    else if(a === 'next')      nextSpeaker(simMin);
    else if(a === 'pick')      pickSpeaker(b.dataset.who, simMin);
    else if(a === 'end')       endMeeting(simMin);
    else if(a === 'follow'){
      const inp = $('mtFollow');
      if(inp){ addFollowUp(inp.value, simMin); inp.value = ''; }
    }
    else if(a.startsWith('dec-')) meetingDecision(a.slice(4), simMin);
  };
  renderMeetingPanel();
}

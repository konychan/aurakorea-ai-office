import { STAFF, LEADER_OF } from '../data/staff.js';
import { TEAMS } from '../data/teams.js';
import { CEO, HQ_MANAGER } from '../data/layout.js';
import { $, state, paint, log, hhmm, hqVisit, hqSay, hqState,
         goReport, returnFromReport, escapeHtml } from './office.js';

/* ═══════════════════════════════════════════════════════════════
   본부장 오케스트레이션 + 대표 보고 대기열 (E 국면)

   헌장 12항 — 본부장은 지시를 받으면 자리에서 일어나 담당 팀장에게 직접 걸어가
                지시를 전달하고, 담당자가 메모하고 확인하는 모습을 거쳐 업무가 시작된다.
   헌장 14항 — 실무자는 대표님께 즉시 보고하지 않는다. 팀장 검증 → 본부장 검토를 거쳐
                통과한 결과만 대표 보고 대기열에 오르고, 대표님이 한 명씩 입장시킨다.
   ═══════════════════════════════════════════════════════════════ */

/* ── 대표 보고 대기열 ── */
export const reportQueue = [];
let reportSeq = 1;
let currentReport = null;   // 지금 대표실에서 보고 중인 건

const teamName = id => (TEAMS.find(t => t.id === id) || {}).name || id;

/* ═══════════ 1) 지시 하달 — 본부장이 팀장에게 직접 걸어가 전달 ═══════════ */
export async function hqDispatch(text, assigneeName, simMin){
  const s = STAFF.find(x => x.n === assigneeName);
  if(!s) return;
  const leader = LEADER_OF[s.t];

  log(simMin, `${CEO.name} 대표`, `"${text}" 지시.`);
  setHqStatus('업무 분석 중');
  log(simMin, `${HQ_MANAGER.name} 본부장`, `지시 접수. 담당 팀을 정하고 있습니다.`);
  await new Promise(r => setTimeout(r, 700));

  // 본부장은 팀장을 먼저 만난다 (팀장이 중간 검증 계층)
  setHqStatus(`${leader} 팀장에게 이동 중`);
  const delivered = await hqVisit(leader, {
    onArrive: async (walkerEl) => {
      const clear = hqSay(walkerEl, `${leader} 팀장, ${text}`);
      log(simMin, `${HQ_MANAGER.name} 본부장`, `${leader} 팀장에게 직접 지시를 전달했습니다.`);
      state[leader].bubble = '네, 확인했습니다';
      state[leader].bt = simMin;
      paint(simMin);
      await new Promise(r => setTimeout(r, 900));
      clear();
    },
  });

  if(!delivered){
    // 본부장이 이미 다른 팀에 가 있으면 팀장에게 바로 전달만 기록한다
    log(simMin, `${HQ_MANAGER.name} 본부장`, `${leader} 팀장에게 지시 전달 (이동 생략).`);
  }

  // 팀장이 담당자에게 배정한다
  if(leader !== assigneeName){
    log(simMin, `${leader} 팀장`, `확인 후 ${assigneeName}에게 배정했습니다.`);
    state[assigneeName].bubble = '지시 접수';
    state[assigneeName].bt = simMin;
  }
  setHqStatus('진행 상황 관리 중');
  paint(simMin);
  return leader;
}

/* ═══════════ 2) 결과 검토 — 팀장 검증 → 본부장 검토 → 대기열 등록 ═══════════ */
export function submitForReview(payload, simMin){
  const { name, title, result, sources = [], files = [], tests = '',
          uncertain = '', needsDecision = '' } = payload;
  const s = STAFF.find(x => x.n === name);
  if(!s) return;
  const leader = LEADER_OF[s.t];

  // 팀원 → 팀장 검증
  if(leader !== name){
    log(simMin, name, `${leader} 팀장에게 결과를 제출했습니다.`);
    log(simMin, `${leader} 팀장`, `검증 완료. ${HQ_MANAGER.name} 본부장에게 보고합니다.`);
  } else {
    log(simMin, `${name} 팀장`, `${HQ_MANAGER.name} 본부장에게 보고합니다.`);
  }

  // 본부장 검토
  log(simMin, `${HQ_MANAGER.name} 본부장`, '결과와 근거를 검토했습니다. 대표님 보고 대기열에 올립니다.');

  const item = {
    id: reportSeq++,
    reporter: leader,          // 대표님께는 팀장이 보고한다
    worker: name,              // 실제 수행자
    team: s.t,
    title, result, sources, files, tests, uncertain, needsDecision,
    hqApproved: true,
    at: simMin,
  };
  reportQueue.push(item);
  renderReportQueue();
  return item;
}

/* ═══════════ 3) 대표님이 보고자를 한 명씩 입장시킨다 ═══════════ */
export async function admitNextReporter(simMin){
  if(currentReport || reportQueue.length === 0) return;
  const item = reportQueue.shift();
  currentReport = item;
  renderReportQueue();
  renderReportDetail(item);

  log(simMin, `${item.reporter} 팀장`, '대표실에 입장해 보고를 시작합니다.');
  state[item.reporter].st = '보고대기';
  state[item.reporter].bubble = '보고 드리겠습니다';
  state[item.reporter].bt = simMin;
  paint(simMin);
  await goReport(item.reporter, simMin);
}

/* ═══════════ 4) 대표님 결정 ═══════════ */
export async function decideReport(decision, simMin){
  if(!currentReport) return;
  const item = currentReport;
  const label = {
    approve:'승인', confirm:'보고 확인', revise:'보완 지시',
    hold:'보류', reject:'본부장에게 반려',
  }[decision] || decision;

  log(simMin, `${CEO.name} 대표`, `"${item.title}" ${label}.`);

  if(decision === 'revise' || decision === 'reject'){
    // 본부장이 다시 담당자에게 재작업을 지시한다 (헌장 12항 후반)
    log(simMin, `${HQ_MANAGER.name} 본부장`, `${item.worker}에게 재작업을 지시하겠습니다.`);
    setHqStatus('재작업 지시 중');
    hqVisit(item.worker, {
      onArrive: async (w) => {
        const clear = hqSay(w, '보완이 필요합니다');
        state[item.worker].bubble = '재작업하겠습니다';
        state[item.worker].bt = simMin;
        paint(simMin);
        await new Promise(r => setTimeout(r, 900));
        clear();
      },
    }).then(() => setHqStatus('진행 상황 관리 중'));
  } else if(decision === 'approve'){
    state[item.worker].done++;
  }

  state[item.reporter].bubble = label;
  state[item.reporter].bt = simMin;
  state[item.reporter].st = '근무중';
  currentReport = null;
  renderReportDetail(null);
  renderReportQueue();
  paint(simMin);
  await returnFromReport(item.reporter, simMin);
}

/* ═══════════ 화면 ═══════════ */
function setHqStatus(text){
  const el = $('hqStatus');
  if(el) el.textContent = text;
}

export function renderReportQueue(){
  const el = $('reportQueue');
  if(!el) return;
  const badge = $('reportBadge');
  if(badge) badge.textContent = reportQueue.length;

  const btn = $('admitBtn');
  if(btn) btn.disabled = !!currentReport || reportQueue.length === 0;

  el.innerHTML = reportQueue.length
    ? reportQueue.map((r, i) => `
      <div class="rq">
        <span class="rq__no">${i + 1}</span>
        <span class="rq__who"><b>${escapeHtml(r.reporter)}</b> 팀장<br><i>${escapeHtml(teamName(r.team))}</i></span>
        <span class="rq__t">${escapeHtml(r.title)}</span>
        <button class="rq__see" data-see="${r.id}">내용 보기</button>
      </div>`).join('')
    : `<div class="empty">대기 중인 보고가 없습니다.</div>`;

  // 입장 전에도 미리 열어 보실 수 있게 한다
  el.querySelectorAll('[data-see]').forEach(b => {
    b.onclick = async () => {
      const item = reportQueue.find(x => String(x.id) === b.dataset.see);
      if(!item) return;
      const { openReport } = await import('./viewer.js');
      openReport(item);
    };
  });
}

function renderReportDetail(item){
  const el = $('reportDetail');
  if(!el) return;
  if(!item){
    el.innerHTML = `<div class="empty">보고자가 입장하면 상세 내용이 표시됩니다.</div>`;
    return;
  }
  const s = STAFF.find(x => x.n === item.worker);
  const row = (k, v) => v ? `<div class="rd__row"><span>${k}</span><div>${v}</div></div>` : '';
  el.innerHTML = `
    <div class="rd">
      <div class="rd__head">
        <b>${escapeHtml(item.reporter)}</b> 팀장
        <span>${escapeHtml(teamName(item.team))}</span>
        <i>${hhmm(item.at)}</i>
      </div>
      ${row('맡은 업무', escapeHtml(item.title))}
      ${row('수행', `${escapeHtml(item.worker)}${s ? ` (${escapeHtml(s.rank)} · ${escapeHtml(s.r)})` : ''}`)}
      ${row('완료 결과', escapeHtml(item.result).replace(/\n/g, '<br>'))}
      ${item.sources.length ? row('핵심 근거', `<ul class="rd__src">${item.sources.map(x =>
        `<li><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.title)}</a></li>`).join('')}</ul>`) : ''}
      ${item.files.length ? row('산출물', item.files.map(escapeHtml).join(', ')) : ''}
      ${row('검증', escapeHtml(item.tests))}
      ${row('불확실', escapeHtml(item.uncertain))}
      ${row('대표님 결정 필요', escapeHtml(item.needsDecision))}
      <div class="rd__hq">✓ ${HQ_MANAGER.name} 본부장 검토 완료</div>
      <!-- 결정하시기 전에 전체 내용을 열어 보고, 필요하면 파일로 받으실 수 있게 한다 -->
      <button class="rd__see" id="rdSee">전체 내용 보기 · 파일 받기</button>
      <div class="rd__btns">
        <button data-dec="approve" class="ok">승인</button>
        <button data-dec="confirm">보고 확인</button>
        <button data-dec="revise" class="warn">보완 지시</button>
        <button data-dec="hold">보류</button>
        <button data-dec="reject" class="no">본부장 반려</button>
      </div>
    </div>`;

  const see = $('rdSee');
  if(see) see.onclick = async () => {
    const { openReport } = await import('./viewer.js');
    openReport(item);
  };
}

export function initOrchestrator(getSimMin){
  const admit = $('admitBtn');
  if(admit) admit.onclick = () => admitNextReporter(getSimMin());
  const detail = $('reportDetail');
  if(detail) detail.onclick = e => {
    const b = e.target.closest('button[data-dec]');
    if(b) decideReport(b.dataset.dec, getSimMin());
  };
  renderReportQueue();
  renderReportDetail(null);
}

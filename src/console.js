import { STAFF, LEADER_OF } from '../data/staff.js';
import { $, state, paint, select, selected } from './office.js';
import { hqDispatch, submitForReview } from './orchestrator.js';
import { detectMeetingCall, callMeeting, meeting } from './meeting.js';
import { HQ_MANAGER } from '../data/layout.js';
import { getSimMin } from './sim.js';

/* ===================== 담당자 라우팅 =====================
   본부장이 지시를 받으면 담당자를 정한다. 대표님이 특정 직원을 지목하지 않은 경우
   키워드로 담당자를 찾고, 못 찾으면 해당 지역/기능 팀장에게 보낸다. */
const ROUTE = [
  [/아르헨|부에노스|ANMAT/i,'나윤호'],
  [/스페인|EU|유럽|CPNP|전시회/i,'진세아'],
  [/두바이|사우디|GCC|중동|할랄/i,'하람'],
  [/견적|단가|가격|FOB|CIF/i,'배시현'],
  [/소싱|신규 ?브랜드|발굴|후보/i,'유래인'],
  [/심사|MOQ|독점/i,'천도윤'],
  [/계약/i,'서나린'],
  [/CFS|GMP|판매증명/i,'강윤슬'],
  [/성분|INCI|전성분/i,'노윤재'],
  [/등록|인증/i,'임하경'],
  [/라벨|표기/i,'백가온'],
  [/선적|부킹|출항|스케줄/i,'조태민'],
  [/적입|컨테이너|파레트/i,'구민아'],
  [/통관|관세|HS/i,'황시온'],
  [/환율|입금|송금|L\/C/i,'정하율'],
  [/마진|원가|수익/i,'남우리'],
  [/정산|세무|영세율/i,'권이도'],
  [/카탈로그|소개서/i,'표이랑'],
  [/콘텐츠|SNS|마케팅/i,'어름'],
];
/* @이름 태그 — 대표님이 특정 직원을 콕 집어 지시하실 때 쓴다.
   키워드 추측보다 확실하다. "@강태오 스페인 제안서 만들어줘" 처럼 쓰신다. */
export function parseTag(text){
  const m = text.match(/^\s*@([가-힣]{2,4})\s*/);
  if(!m) return null;
  const who = STAFF.find(s => s.n === m[1]);
  if(!who) return null;
  return { name: who.n, rest: text.slice(m[0].length).trim() };
}

function route(text){
  const tag = parseTag(text);
  if(tag) return tag.name;              // 태그가 최우선 — 선택된 직원보다도 앞선다
  if(selected) return selected;
  for(const [re,n] of ROUTE) if(re.test(text)) return n;
  return LEADER_OF['ar']; // 담당이 불분명하면 아르헨티나 지역 팀장이 1차로 받는다
}

/* ═══════════ 대표 지시 → 본부장 오케스트레이션 → 담당자 수행 ═══════════
   헌장 12항: 본부장이 자리에서 일어나 담당 팀장에게 직접 걸어가 지시를 전달한다.
   헌장 14항: 결과는 대표님께 바로 가지 않고 팀장 검증 → 본부장 검토 → 보고 대기열을 거친다. */
async function dispatch(text){
  if(!text.trim()) return;

  // 대표님의 회의 소집 명령이면 업무 지시가 아니라 회의를 연다 (헌장 16항)
  const call = detectMeetingCall(text);
  if(call){
    if(meeting.active){
      $('out').innerHTML = `<span class="who">${HQ_MANAGER.name} 본부장</span>\n이미 "${meeting.title}"가 진행 중입니다. 종료 후 다시 소집해 주십시오.`;
      return;
    }
    $('out').innerHTML = `<span class="who">${HQ_MANAGER.name} 본부장</span>\n${call.title} 소집합니다. 팀장들이 미팅룸으로 이동합니다.`;
    callMeeting(call, getSimMin());
    return;
  }

  const name = route(text);
  const s = STAFF.find(x=>x.n===name);
  const st = state[name];
  const simMin = getSimMin();

  // 태그를 떼고 실제 지시 내용만 남긴다 ("@강태오 제안서" → "제안서")
  const tag = parseTag(text);
  if(tag) text = tag.rest || text;

  // 문서 제작 담당에게 온 지시는 요청서 창으로 넘긴다.
  // 브라우저는 진짜 파일을 못 만들기 때문에, 여기서 받아야 할 건 "답변"이 아니라 "제작 사양"이다.
  if(s.docPro){
    const { openRequestFor } = await import('./docdesk.js');
    $('out').innerHTML = `<span class="who">${name} · ${s.r}</span>\n어떤 형식으로 만들어 드릴까요? 요청서를 띄웠습니다.`;
    openRequestFor(text);
    return;
  }

  /* 1) 본부장이 팀장에게 걸어가 전달한다 — 기다리지 않는다.
     왕복 도보가 16초라 await 하면 그동안 화면이 죽은 것처럼 보인다. 연출은 뒤에서 돌린다. */
  hqDispatch(text, name, simMin);

  /* 2) 접수 처리.
     예전에는 여기서 브라우저가 api.anthropic.com 을 직접 불렀다.
     그건 CORS 로 구조적으로 막혀 있어 한 번도 성공한 적이 없고, 매번 "호출 실패"만 떴다.
     지시는 접수해서 보고 대기열에 올리고, 실제 답은 본부장이 처리한다 (문서 요청과 같은 방식).
     ★ AI를 호출하지 않는다 — 실패할 일이 없다. */
  st.bubble = '지시 접수'; st.bt = simMin;
  submitForReview({
    name,
    title: text,
    result: `대표님 지시를 접수해 ${LEADER_OF[s.t]} 팀장 검증을 거쳤습니다.\n`
          + `담당: ${name} (${s.rank} · ${s.r})\n\n`
          + `이 건은 실제 조사·판단이 필요해 본부장이 직접 처리합니다.\n`
          + `보고를 열어 "이 보고서 내려받기"로 지시서를 받으시거나, 아래 내용을 본부장에게 그대로 주시면 됩니다.`,
    tests: '접수·배정 확인 완료',
    uncertain: '아직 조사 전입니다. 결과는 본부장 처리 후 올라옵니다.',
    needsDecision: '급한 건이면 본부장에게 바로 말씀해 주십시오.',
  }, getSimMin());

  // 3) 본부장 숙제로 접수한다 — 대표님이 옮겨 적지 않으셔도 되게
  const { fileHomework } = await import('./homework.js');
  const where = await fileHomework({ title: text, assignee: name, team: s.t });

  $('out').innerHTML = `<span class="who">${name} · ${s.r}</span>\n`
    + `지시를 접수했습니다. ${LEADER_OF[s.t]} 팀장 검증 후 보고 대기열에 올렸습니다.\n`
    + (where === 'server'
        ? `본부장 숙제로 접수했습니다. 다음 작업 때 처리해 올리겠습니다.`
        : `<span class="hwCopy">본부장 숙제로 쌓아 뒀습니다. <button id="hwBtn">숙제 복사</button> 눌러 본부장에게 주십시오.</span>`);
  const hw = $('hwBtn');
  if(hw) hw.onclick = async () => {
    const { copyAll } = await import('./homework.js');
    hw.textContent = await copyAll() ? '복사했습니다' : '복사 실패 — 직접 선택해 주십시오';
  };
  const now = getSimMin();
  st.st='근무중'; st.bt=now;
  paint(now); if(selected) select(selected, now);
}

/* ═══════════ @ 자동완성 ═══════════
   26명 이름을 외우실 필요가 없게, @ 를 치면 목록이 뜨고 이름·담당업무로 걸러진다.
   ★ AI를 부르지 않는다. 직원 명단에서 고르는 화면 기능이다. */
function initMention(){
  const cmd = $('cmd');
  const box = document.createElement('div');
  box.className = 'mention';
  box.style.display = 'none';
  cmd.parentElement.style.position = 'relative';
  cmd.parentElement.appendChild(box);

  let hits = [], cur = 0;

  const hide = () => { box.style.display = 'none'; hits = []; };

  const draw = () => {
    if(!hits.length) return hide();
    box.innerHTML = hits.map((s, i) => `
      <div class="mItem${i===cur?' on':''}" data-n="${s.n}">
        <b>${s.n}</b><span>${s.rank} · ${s.r}</span>
        ${s.docPro ? '<em class="mTag">문서제작실</em>' : ''}
      </div>`).join('');
    box.style.display = '';
    box.querySelectorAll('.mItem').forEach(el => {
      el.onmousedown = e => { e.preventDefault(); pick(el.dataset.n); };
    });
  };

  const pick = name => {
    cmd.value = cmd.value.replace(/@[가-힣]*\s*$/, `@${name} `);
    hide();
    cmd.focus();
  };

  const refresh = () => {
    const m = cmd.value.match(/@([가-힣]*)$/);   // 커서 끝의 @질의만 본다
    if(!m) return hide();
    const q = m[1];
    hits = STAFF.filter(s => !q || s.n.includes(q) || s.r.includes(q)).slice(0, 6);
    cur = 0;
    draw();
  };

  cmd.addEventListener('input', refresh);
  cmd.addEventListener('blur', () => setTimeout(hide, 120));
  cmd.addEventListener('keydown', e => {
    if(box.style.display === 'none' || !hits.length) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); cur = (cur+1) % hits.length; draw(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); cur = (cur-1+hits.length) % hits.length; draw(); }
    else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); pick(hits[cur].n); }
    else if(e.key === 'Escape'){ hide(); }
  });
}

export function initConsole(){
  const send = () => {
    const v = $('cmd').value;
    $('cmd').value = '';
    $('cmd').placeholder = '대표 지시를 입력하세요 (@를 치면 직원을 고를 수 있습니다)';
    dispatch(v);
  };
  $('sendBtn').onclick = send;
  // 자동완성 목록이 열려 있을 때의 Enter 는 initMention 이 먼저 가로챈다
  $('cmd').addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.defaultPrevented) send(); });
  document.querySelectorAll('.quick button').forEach(b=>{
    b.onclick = ()=>{ dispatch(b.dataset.q); };
  });
  initMention();
}

import { STAFF, LEADER_OF } from '../data/staff.js';
import { $, state, paint, log, select, selected, goReport, returnFromReport } from './office.js';
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
function route(text){
  if(selected) return selected;
  for(const [re,n] of ROUTE) if(re.test(text)) return n;
  return LEADER_OF['ar']; // 담당이 불분명하면 아르헨티나 지역 팀장이 1차로 받는다
}

/* ===================== 대표 지시 → AI 직원 호출 (기존 로직 유지) ===================== */
async function dispatch(text){
  if(!text.trim()) return;
  const name = route(text);
  const s = STAFF.find(x=>x.n===name);
  const st = state[name];
  const simMin = getSimMin();
  st.st='보고대기'; st.bubble='대표님 지시 처리 중…'; st.bt=simMin;
  paint(simMin);
  // 지시 전달 경로를 로그에 남긴다: 대표 → 본부장 → (팀장) → 담당자
  const leader = LEADER_OF[s.t];
  log(simMin, '대표', `"${text}" 지시.`);
  if(leader && leader !== name){
    log(simMin, `${HQ_MANAGER.name} 본부장`, `${leader} 팀장에게 전달 → ${name} 배정.`);
  } else {
    log(simMin, `${HQ_MANAGER.name} 본부장`, `${name} 팀장에게 직접 배정.`);
  }
  goReport(name, simMin);
  $('out').innerHTML = `<span class="who">${name} · ${s.r}</span>\n작성 중…`;

  try{
    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-6", max_tokens:1000,
        system: s.p + " 아우라코리아는 한국 화장품 수출 무역회사이며 아르헨티나·스페인·GCC가 주요 시장이다. 답변은 한국어로, 400자 이내로, 실무 담당자가 대표에게 보고하듯 간결하게 작성한다. 불확실한 수치는 확인 필요라고 명시한다.",
        messages:[{role:"user", content:text}]
      })
    });
    const data = await res.json();
    const reply = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n") || "(응답 없음)";
    $('out').innerHTML = `<span class="who">${name} · ${s.r}</span>\n${reply}`;
    st.done++; st.bubble='보고 완료';
    // 보고 경로: 담당자 → 팀장 검증 → 본부장 → 대표
    if(leader && leader !== name){
      log(getSimMin(), name, `${leader} 팀장에게 결과 제출.`);
      log(getSimMin(), `${leader} 팀장`, `검증 완료. ${HQ_MANAGER.name} 본부장에게 보고.`);
    } else {
      log(getSimMin(), `${name} 팀장`, `${HQ_MANAGER.name} 본부장에게 보고.`);
    }
    log(getSimMin(), `${HQ_MANAGER.name} 본부장`, '검토 완료. 대표님께 보고드립니다.');
  }catch(e){
    $('out').innerHTML = `<span class="err">호출 실패 — 이 사무실은 클로드 앱 안에서 열어야 직원이 응답합니다.\n파일을 브라우저에서 직접 열면 UI만 동작합니다.</span>`;
    st.bubble='연결 실패';
  }
  const now = getSimMin();
  st.st='근무중'; st.bt=now;
  paint(now); if(selected) select(selected, now);
  returnFromReport(name, now);
}

export function initConsole(){
  $('sendBtn').onclick = ()=>{ dispatch($('cmd').value); $('cmd').value=''; };
  $('cmd').onkeydown = e=>{ if(e.key==='Enter'){ dispatch($('cmd').value); $('cmd').value=''; } };
  document.querySelectorAll('.quick button').forEach(b=>{
    b.onclick = ()=>{ $('cmd').value=b.dataset.q; dispatch(b.dataset.q); $('cmd').value=''; };
  });
}

import { STAFF } from '../data/staff.js';
import { state, paint, log } from './office.js';

// 1호 실제 에이전트 실행: 서버(server.js)의 /api/agent/:name 을 호출해 진짜 웹 검색 기반 업무를 수행한다.
export async function runRealAgent(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const st = state[name];
  if(!s || !st || st.runningReal) return;

  st.runningReal = true;
  st.st = '처리중';
  st.bubble = '실시간 브랜드 리서치 중…';
  st.bt = simMin;
  paint(simMin);
  log(simMin, name, '실제 웹 검색으로 브랜드 후보 조사를 시작합니다.');

  try{
    const res = await fetch('/api/agent/' + encodeURIComponent(name), { method:'POST' });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || '알 수 없는 오류');
    st.lastReal = { text: data.text, at: simMin };
    st.bubble = '실시간 리서치 완료';
    st.done++;
    log(simMin, name, '실시간 브랜드 후보 조사 완료. 자리를 클릭하면 결과를 볼 수 있습니다.');
  }catch(e){
    st.bubble = '리서치 실패';
    log(simMin, name, `실시간 리서치 실패 (${e.message}).`);
  }

  st.runningReal = false;
  st.st = '근무중';
  st.bt = simMin;
  paint(simMin);
}

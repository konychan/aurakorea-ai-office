import { STAFF } from '../data/staff.js';
import { state, paint, log } from './office.js';
import { submitForReview } from './orchestrator.js';

// 1호 실제 에이전트 실행: data/agent-results.json 에 저장된 실제 웹 검색 결과를 확인해 보고한다.
// (이 파일은 Claude Code가 대표님 기존 플랜으로 직접 검색해 채워둔다 — 별도 API 결제가 필요 없다)
export async function runRealAgent(name, simMin){
  const s = STAFF.find(x=>x.n===name);
  const st = state[name];
  if(!s || !st || st.runningReal) return;

  let all;
  try{
    const res = await fetch('/data/agent-results.json', { cache:'no-store' });
    all = await res.json();
  }catch(e){
    return; // 결과 파일을 못 읽으면 조용히 넘어간다 (매 시간 실패 로그로 도배하지 않는다)
  }

  const item = all[name];
  if(!item || (st.lastReal && st.lastReal.at === item.updatedAt)) return; // 새로 확인할 결과가 없으면 보고하지 않는다

  st.runningReal = true;
  st.st = '처리중';
  st.bubble = '실시간 리서치 결과 확인 중…';
  st.bt = simMin;
  paint(simMin);
  log(simMin, name, '실제 웹 검색 리서치 결과를 확인하고 있습니다.');

  st.lastReal = { text: item.text, sources: item.sources || [], note: item.note || '', at: item.updatedAt };
  st.bubble = '실시간 리서치 완료';
  st.done++;
  st.runningReal = false;
  st.st = '근무중';
  st.bt = simMin;
  log(simMin, name, '실시간 브랜드 후보 조사 확인 완료. 자리를 클릭하면 결과를 볼 수 있습니다.');
  paint(simMin);

  // 실제 리서치 결과도 팀장 검증 → 본부장 검토를 거쳐 대표 보고 대기열에 오른다 (헌장 14항)
  submitForReview({
    name,
    title: '실시간 K뷰티 브랜드 리서치',
    result: item.text,
    sources: item.sources || [],
    files: ['data/agent-results.json'],
    tests: '실제 웹 검색 결과에 근거 (출처 첨부)',
    uncertain: '시장 수치는 기사 시점 기준',
    needsDecision: '소싱 후보로 진행할지 대표님 판단 필요',
  }, simMin);
}

/* 대표님 지시 → 본부장 숙제 접수
 *
 * 로컬(사무실 서버가 켜진 상태)에서는 지시가 저장소의 data/homework.json 에 바로 떨어진다.
 * 본부장은 그 파일을 읽어 처리한다 — 대표님이 따로 옮겨 적으실 필요가 없다.
 * 배포본(Vercel)에는 파일을 쓸 곳이 없으므로, 브라우저에 쌓아 두고 복사해서 전달한다.
 *
 * ★ AI를 호출하지 않는다.
 */
const KEY = 'aurakorea.homework';

const load = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; } };
const save = l => { try{ localStorage.setItem(KEY, JSON.stringify(l.slice(0, 200))); }catch(e){} };

export function pending(){ return load().filter(h => h.status === '대기'); }

/** 지시를 숙제로 접수한다. 반환: 'server'(저장소에 기록됨) | 'local'(브라우저에만 쌓임) */
export async function fileHomework({ title, assignee, team }){
  const item = { title, assignee, team, at: new Date().toISOString(), status: '대기' };
  try{
    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    // 서버가 200을 주면서 ok:false 로 실패를 알릴 수 있다 (토큰 미설정 등) — 본문까지 확인한다
    if(res.ok){
      const j = await res.json().catch(() => ({ ok: true }));
      if(j.ok !== false) return 'server';
    }
  }catch(e){ /* 연결 자체가 안 되면 아래 로컬 보관으로 넘어간다 */ }
  save([{ ...item, id: 'hw' + Date.now() }, ...load()]);
  return 'local';
}

/** 대기 중인 숙제를 본부장에게 그대로 줄 수 있는 형태로 만든다 */
export function asText(){
  const list = pending();
  if(!list.length) return '';
  return '[대표님 지시 — 본부장 처리 요청]\n\n' + list.map((h, i) =>
    `${i + 1}. ${h.title}\n   담당 ${h.assignee} · 접수 ${new Date(h.at).toLocaleString('ko-KR')}`
  ).join('\n');
}

/** 전부 복사하고 처리 완료로 표시한다 */
export async function copyAll(){
  const text = asText();
  if(!text) return false;
  try{ await navigator.clipboard.writeText(text); }catch(e){ return false; }
  save(load().map(h => h.status === '대기' ? { ...h, status: '전달함' } : h));
  return true;
}

/* 클라우드가 처리해 둔 숙제를 사무실로 들여온다.
   대표님이 아무것도 안 하셔도, 사무실을 열면 처리된 결과가 보고 대기열에 올라와 있다. */
export async function loadDoneHomework(submit, simMin){
  let list = [];
  try{
    const res = await fetch('/data/homework.json', { cache:'no-store' });
    list = await res.json();
  }catch(e){ return 0; }

  const seen = new Set(load().map(h => h.id));   // 이미 화면에 올린 건 다시 올리지 않는다
  const fresh = list.filter(h => h.status === '완료' && h.result && !seen.has(h.id));
  fresh.forEach(h => submit({
    name: h.assignee,
    title: h.title,
    result: h.result,
    sources: h.sources || [],
    tests: '본부장이 직접 처리 (클라우드 자동 실행)',
    uncertain: h.uncertain || '',
    needsDecision: h.needsDecision || '',
  }, simMin));

  if(fresh.length) save([...fresh.map(h => ({ ...h, status:'표시함' })), ...load()]);
  return fresh.length;
}

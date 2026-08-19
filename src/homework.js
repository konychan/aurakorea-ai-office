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
    if(res.ok) return 'server';
  }catch(e){ /* 배포본에는 이 경로가 없다 — 아래 로컬 보관으로 넘어간다 */ }
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

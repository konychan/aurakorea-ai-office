/* 팀 정의 — 팀 추가는 이 파일 한 곳만 수정한다.
   kind:'region' = 지역팀 (해당 수출 지역을 책임진다)
   kind:'function' = 기능팀 (전 지역 공통 지원 조직)
   각 팀에는 팀장이 정확히 1명 있어야 한다 (data/staff.js의 rank:'팀장'). */
export const TEAMS = [
  // ── 지역본부 ──
  { id:'ar',    kind:'region',   name:'아르헨티나 지역팀', sub:'부에노스아이레스 · ANMAT', accent:'#7FB6E8' },
  { id:'es',    kind:'region',   name:'스페인·EU 지역팀',  sub:'마드리드 · CPNP',          accent:'#E89AB8' },
  { id:'gcc',   kind:'region',   name:'GCC 지역팀',        sub:'두바이 · 리야드 · 할랄',   accent:'#9FD8C4' },

  // ── 기능팀 ──
  { id:'source', kind:'function', name:'브랜드소싱팀',      sub:'K뷰티 브랜드 발굴 · 심사',   accent:'#C6A9E8' },
  { id:'docs',   kind:'function', name:'수출서류·인증팀',   sub:'CFS · GMP · ANMAT · CPNP',  accent:'#A8D8B0' },
  { id:'logi',   kind:'function', name:'물류·통관팀',       sub:'선적 · 적입 · 통관',         accent:'#8FD0E8' },
  { id:'fin',    kind:'function', name:'재무·정산팀',       sub:'환율 · 원가 · 마진 · 견적',  accent:'#A9C4E8' },
  { id:'mkt',    kind:'function', name:'마케팅·디자인팀',   sub:'카탈로그 · 콘텐츠',          accent:'#F0B8D0' },
];

export const REGION_TEAMS = TEAMS.filter(t => t.kind === 'region');
export const FUNCTION_TEAMS = TEAMS.filter(t => t.kind === 'function');

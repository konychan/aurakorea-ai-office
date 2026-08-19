/* ═══════════════════════════════════════════════════════════════
   사무실 도면 — 이 파일 한 곳에서 모든 방·복도·좌표를 관리한다.

   좌표계: TILE 격자. 화면에서는 1 tile = GRID.tile px 로 그려진다.
   방은 CSS 그리드가 아니라 절대 좌표로 배치되므로, 여기 숫자가 곧 화면 배치다.

   도면 구조
        상단 중앙 : 대표실 → (보고 대기줄) → 본부장실 → 미팅룸
        왼쪽 열   : 팀 룸 4개
        오른쪽 열 : 팀 룸 4개
        맨 오른쪽 : 휴게공간 · 화장실
        중앙      : 세로 복도 (각 방으로 가로 통로가 갈라진다)
        하단 중앙 : 정문
   ═══════════════════════════════════════════════════════════════ */

/* ===================== 근무시간 (여기 한 곳만 고치면 전체가 바뀐다) ===================== */
export const WORK_HOURS = {
  start: 11 * 60,   // 전 직원 출근 11:00
  end:   21 * 60,   // 근무 종료 21:00
};
// 대시보드가 열려 있는(사내 시계가 도는) 범위. 출근 전 대기 모습도 보여주기 위해 시작보다 2시간 이르게 연다.
export const SIM_WINDOW = {
  open:  WORK_HOURS.start - 120,
  close: WORK_HOURS.end,
};

/* ===================== 대표 (직원 명단과 별도 관리) ===================== */
export const CEO = {
  name: '장경철',
  title: '대표',
  hair: '#1E1A22',
  suit: '#22304A',
  chair: '#C9A24B',
  desk: '#5C4530',
};

/* ===================== 본부장 (직원 명단과 별도 관리) ===================== */
/* 본부장 복장은 대표(짙은 남색 정장 + 빨간 넥타이)와 확실히 구분한다.
   회색 정장 + 청록 넥타이 + 가슴에 '본부장' 명찰 (헌장 10항). */
export const HQ_MANAGER = {
  name: '공민규',
  title: '본부장',
  hair: '#3A3140',
  suit: '#6E6480',     // 회색 정장 (대표는 짙은 남색)
  tie:  '#2FA8A0',     // 청록 넥타이 (대표는 빨강)
  badge:'#E7C066',     // 가슴 명찰
  chair: '#7A6A88',
  desk: '#4A3A2E',
};

/* 보고 체계: 팀원 → 팀장 → 본부장 → 대표 (이 방식만 쓴다).
   화면에 경로를 그리지는 않고, 실제 보고 흐름에만 적용한다. */
export const REPORTING_CHAIN = ['팀원', '팀장', '본부장', '대표'];

export const COMPANY = {
  name: 'AURAKOREA',
  nameKo: '아우라코리아',
  tagline: 'K-BEAUTY EXPORT',
  floor: '1F',
};

/* ═══════════ 격자 ═══════════
   화면(가로가 긴 모니터)에 꽉 차도록 도면을 가로로 넓고 세로로 짧게 잡는다. */
export const GRID = { tile: 18, cols: 78, rows: 48 };

/* ═══════════ 중앙 복도 ═══════════
   세로 복도가 도면 한가운데를 위아래로 관통하고, 각 팀 행 위로 가로 통로가 갈라진다. */
export const CORRIDOR = {
  x: 31,            // 세로 복도 왼쪽 끝 col
  w: 4,             // 복도 폭 (tile)
  get cx(){ return this.x + this.w / 2; },   // 복도 중심선 = 33
  top: 10,          // 복도가 시작되는 row (대표실 아래)
  bottom: 44,       // 복도가 끝나는 row (정문 앞)
};

/* ═══════════ 상단 중앙 — 대표실 · 본부장실 · 미팅룸 ═══════════
   좌우 팀 룸 사이의 중앙 열에 세로로 쌓는다. 미팅룸은 본부장실 바로 아래에 붙인다. */
export const CEO_ROOM   = { id:'ceo',     name:'대표실',   nameEn:'EXECUTIVE OFFICE', col:26, row:1,  w:15, h:9 };
export const HQ_ROOM    = { id:'hq',      name:'본부장실', nameEn:'HQ OFFICE',        col:26, row:14, w:15, h:7 };
export const MEETING_ROOM = {
  id:'meeting', name:'미팅룸', nameEn:'MEETING ROOM',
  col:26, row:21, w:15, h:11,          // ← 본부장실(끝 row 21) 바로 아래에 붙는다
  seats: { head:{ who:'CEO', label:'대표' }, hq:{ who:'HQ_MANAGER', label:'본부장' } },
};

/* 대표실 문 앞 보고 대기줄 — 세로로 줄을 선다 (대표실 아래 ~ 본부장실 위 구간) */
export const CEO_QUEUE = Array.from({ length: 5 }, (_, i) => ({
  slot: i + 1,
  col: CORRIDOR.cx,
  row: CEO_ROOM.row + CEO_ROOM.h + 0.7 + i * 0.65,
}));

/* ═══════════ 좌우 팀 룸 ═══════════
   왼쪽 4개 / 오른쪽 4개. 팀이 늘어나면 아래 행에 자동으로 이어 붙는다. */
/* 팀 룸은 좌우 구역에 각각 2열 × 2행으로 놓는다.
   문은 방 위쪽에 내고, 각 행 위의 가로 통로를 통해 중앙 복도와 이어진다.
   (그래서 바깥쪽 열 방도 다른 방을 통과하지 않고 복도까지 갈 수 있다) */
const TEAM_ROOM = { w:11, h:15, gapX:1, gapY:3, startRow:12 };
export const TEAM_SIDE = {
  left:  { cols: [1, 13] },     // 왼쪽 구역 2열 (바깥 / 안쪽)
  right: { cols: [42, 54] },    // 오른쪽 구역 2열 (안쪽 / 바깥)
};
/* 각 행 위에 놓이는 가로 통로의 중심 row */
export const ROW_CORRIDORS = [
  TEAM_ROOM.startRow - 1.5,
  TEAM_ROOM.startRow + TEAM_ROOM.h + TEAM_ROOM.gapY - 1.5,
];

/* 인원수에 맞는 방 높이 — 자리는 2열로 놓이므로 줄 수만큼만 높이를 준다.
   (2명이면 1줄, 3~4명이면 2줄) 덕분에 도면 세로가 짧아져 한 화면에 잘 들어온다. */
export function roomHeightFor(count){
  const rows = Math.max(1, Math.ceil(count / 2));   // 자리는 2열로 놓인다
  return Math.ceil(2.6 + rows * 5.4 + 0.6);         // 헤더 + 자리줄 + 여백
}

/* 팀 목록을 받아 좌우 구역에 2열 × 2행으로 배치한다.
   teams: [{ id, count }] — count 는 그 팀 인원수
   door = 방 위쪽 문 (그 행의 가로 통로 위치). 캐릭터는 반드시 이 문을 거친다. */
export function layoutTeamRooms(teams){
  const pos = {};
  teams.forEach((t, i) => {
    const id = typeof t === 'string' ? t : t.id;
    const side = i % 2 === 0 ? 'left' : 'right';
    const idx = Math.floor(i / 2);                 // 그 구역에서 몇 번째 방인지
    const colIdx = idx % 2;                        // 0=첫 열, 1=둘째 열
    const rowIdx = Math.floor(idx / 2);            // 0=첫 행, 1=둘째 행

    const col = TEAM_SIDE[side].cols[colIdx];
    const row = TEAM_ROOM.startRow + rowIdx * (TEAM_ROOM.h + TEAM_ROOM.gapY);

    pos[id] = {
      side, col, row, w: TEAM_ROOM.w, h: TEAM_ROOM.h,
      // 문은 방 위쪽 벽 중앙 → 그 행의 가로 통로로 바로 나온다
      door: { col: col + TEAM_ROOM.w / 2, row: ROW_CORRIDORS[rowIdx] },
      rowIdx,
    };
  });
  return pos;
}

/* ═══════════ 왼쪽 위 — 문서제작실 ═══════════
   Excel · PPT · Word 전담자는 팀 룸이 아니라 자기 작업실을 쓴다.
   문서 작업은 큰 화면·프린터·색 견본이 필요하고, 누가 문서 담당인지 도면에서 바로 보여야 한다.
   소속은 그대로 마케팅팀이다 (보고는 팀장 → 본부장 → 대표로 간다). 자리만 따로다. */
export const DOC_STUDIO = {
  id:'docstudio', name:'문서제작실', nameEn:'DOCUMENT STUDIO',
  // 가로로 넓게 잡는다 — 견본 벽 · 작업 자리 · 프린터가 한 줄로 놓여야 서로 겹치지 않는다
  col: 4, row: 2, w: 17, h: 8,
  door: { col: 12.5, row: ROW_CORRIDORS[0] },   // 문은 아래쪽 벽 → 첫 행 가로 통로로 나온다
  owner: '강태오',
};

/* ═══════════ 대표실 오른쪽 — 번역실 ═══════════
   대표님이 "내 옆에 두라"고 지시하신 부서다. 대표실(row 1~10)과 위아래 높이를 맞춰
   한 줄로 나란히 보이게 놓는다. 왼쪽 위 문서제작실과 좌우 대칭이 된다.

   번역팀은 팀 룸 격자를 쓰지 않는다 (data/teams.js 의 room:'transRoom').
   격자는 8칸이 정원이라 9번째 팀을 넣으면 도면 밖으로 밀려나기 때문이다.
   방 크기는 roomHeightFor(2) = 9 에 맞췄다 — 인원이 늘면 h 를 그 값으로 다시 잡는다. */
export const TRANS_ROOM = {
  id:'transRoom', name:'번역실', nameEn:'TRANSLATION ROOM',
  col: 44, row: 1, w: 11, h: 9,
  door: { col: 49.5, row: ROW_CORRIDORS[0] },   // 문은 아래쪽 벽 → 첫 행 가로 통로로 나온다
  team: 'trans',
};

/* ═══════════ 맨 오른쪽 — 휴게공간 · 화장실 ═══════════ */
const FAR_RIGHT_COL = TEAM_SIDE.right.cols[1] + TEAM_ROOM.w + 2;   // = 67

export const LOUNGE = {
  id:'lounge', name:'휴게 공간', nameEn:'LOUNGE',
  col: FAR_RIGHT_COL, row: 12, w: 10, h: 14,
  door: { col: FAR_RIGHT_COL + 5, row: ROW_CORRIDORS[0] },
  fixtures: ['커피머신', '정수기', '냉장고', '간식 진열대', '휴게 테이블', '쓰레기통'],
};

export const RESTROOM = {
  id:'restroom', name:'화장실', nameEn:'RESTROOM',
  col: FAR_RIGHT_COL, row: 29, w: 10, h: 11,
  door: { col: FAR_RIGHT_COL + 5, row: ROW_CORRIDORS[1] },
};

/* ═══════════ 정문 · 안내 ═══════════ */
export const ENTRANCE = {
  label:'정문',
  col: CORRIDOR.cx, row: GRID.rows - 4,   // 팀 룸 아래, 도면 맨 아래에 둔다
  w: 10, h: 3,
};
/* 안내데스크는 팀 룸 아래 빈 줄에 둔다.
   예전 좌표(row 43)는 왼쪽 안쪽 팀 룸(row 30~45) 위에 겹쳐 있어 직원 자리를 덮고 있었다. */
export const RECEPTION = { col: 14, row: 45.4, w: 9, h: 2.4 };

/* ═══════════ 복도 웨이포인트 ═══════════
   길찾기 알고리즘을 쓰지 않는다. 아래 규칙으로 경로를 만든다:
     ① 출발 지점 → 그 방의 문
     ② 문 → 복도 중심선(같은 높이)
     ③ 복도를 따라 세로 이동
     ④ 목적지 방 문 높이에서 복도를 벗어남 → 문 → 목적지
   벽이나 방을 통과하지 않는다. */
export function buildPath(from, to){
  const cx = CORRIDOR.cx;
  const pts = [];
  const push = p => {
    const last = pts[pts.length - 1];
    if(!last || Math.abs(last.col - p.col) > 0.01 || Math.abs(last.row - p.row) > 0.01) pts.push(p);
  };

  push({ col: from.col, row: from.row });
  if(from.door) push({ col: from.door.col, row: from.door.row });      // ① 방 문까지
  const enterRow = from.door ? from.door.row : from.row;
  push({ col: cx, row: enterRow });                                     // ② 복도 진입
  const exitRow = to.door ? to.door.row : to.row;
  push({ col: cx, row: exitRow });                                      // ③ 복도 세로 이동
  if(to.door) push({ col: to.door.col, row: to.door.row });             // ④ 목적지 문
  push({ col: to.col, row: to.row });
  return pts;
}

/* 방 안에서 직원 수만큼 책상이 놓일 상대 좌표 (방 원점 기준, 2열 정렬)
   방 크기(w:11, h:14)에 맞춰 자리 하나가 5 x 5.4 타일을 차지한다. */
export function deskSlots(count, roomW = 11){
  const originRow = 2.6, dw = 5, dh = 5.4, gap = 0.3, columns = 2;
  const out = [];
  for(let i = 0; i < count; i++){
    const rowIdx = Math.floor(i / columns);
    // 그 줄에 실제로 앉는 인원수만큼만 폭을 잡아 방 안에서 가운데로 모은다
    const inRow = Math.min(columns, count - rowIdx * columns);
    const rowW = inRow * dw + (inRow - 1) * gap;
    const startCol = Math.max(0.6, (roomW - rowW) / 2);
    out.push({
      col: startCol + (i % columns) * (dw + gap),
      row: originRow + rowIdx * (dh + gap),
    });
  }
  return out;
}

/* ═══════════ 평상시 자동 움직임 (F 이후 · 비용 0) ═══════════
   AI를 호출하지 않는다. 아래 목록에서 무작위로 골라 쓰는 순수 화면 연출이다. */
export const IDLE_ACTIVITIES = [
  { id:'coffee',   to:'lounge',   label:'커피 마시러',   say:'커피 한 잔',     stayMs:2600 },
  { id:'water',    to:'lounge',   label:'물 뜨러',       say:'물 좀',          stayMs:2000 },
  { id:'snack',    to:'lounge',   label:'간식 가지러',   say:'간식 좀',        stayMs:2200 },
  { id:'restroom', to:'restroom', label:'화장실',        say:'잠시 다녀오겠습니다', stayMs:2000 },
  { id:'visit',    to:'team',     label:'다른 팀 방문',  say:'잠깐 여쭤볼 게', stayMs:2400 },
  { id:'stroll',   to:'corridor', label:'복도 이동',     say:'',               stayMs:1200 },
];
export const IDLE_MAX_CONCURRENT = 3;   // 동시에 자리를 비울 수 있는 최대 인원

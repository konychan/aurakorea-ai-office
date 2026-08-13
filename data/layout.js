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

/* ═══════════ 격자 ═══════════ */
export const GRID = { tile: 18, cols: 58, rows: 59 };

/* ═══════════ 중앙 복도 ═══════════
   세로 복도가 도면 한가운데를 위아래로 관통하고, 각 방 앞에서 가로 통로가 갈라진다. */
export const CORRIDOR = {
  x: 25,            // 세로 복도 왼쪽 끝 col
  w: 4,             // 복도 폭 (tile)
  get cx(){ return this.x + this.w / 2; },   // 복도 중심선 = 27
  top: 10,          // 복도가 시작되는 row (대표실 아래)
  bottom: 55,       // 복도가 끝나는 row (정문 앞)
};

/* ═══════════ 상단 중앙 — 대표실 · 본부장실 · 미팅룸 ═══════════
   좌우 팀 룸 사이의 중앙 열에 세로로 쌓는다. 미팅룸은 본부장실 바로 아래에 붙인다. */
export const CEO_ROOM   = { id:'ceo',     name:'대표실',   nameEn:'EXECUTIVE OFFICE', col:20, row:1,  w:14, h:9 };
export const HQ_ROOM    = { id:'hq',      name:'본부장실', nameEn:'HQ OFFICE',        col:20, row:14, w:14, h:7 };
export const MEETING_ROOM = {
  id:'meeting', name:'미팅룸', nameEn:'MEETING ROOM',
  col:20, row:21, w:14, h:11,          // ← 본부장실(끝 row 21) 바로 아래에 붙는다
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
const TEAM_ROOM = { w:11, h:14, gapY:1, startRow:4 };
export const TEAM_SIDE = {
  left:  { col: 8 },        // 복도 왼쪽 (중앙 방들과 겹치지 않는 위치)
  right: { col: 35 },       // 복도 오른쪽
};

/* 인원수에 맞는 방 높이 — 자리는 2열로 놓이므로 줄 수만큼만 높이를 준다.
   (2명이면 1줄, 3~4명이면 2줄) 덕분에 도면 세로가 짧아져 한 화면에 잘 들어온다. */
export function roomHeightFor(count){
  const rows = Math.max(1, Math.ceil(count / 2));
  return Math.ceil(2.6 + rows * 5.4 + 0.6);   // 헤더 + 자리줄 + 여백
}

/* 팀 목록을 받아 좌우로 번갈아 배치한다.
   teams: [{ id, count }] — count 는 그 팀 인원수
   door = 그 방에서 복도로 나오는 지점 (캐릭터는 반드시 이 문을 거친다) */
export function layoutTeamRooms(teams){
  const pos = {};
  const nextRow = { left: TEAM_ROOM.startRow, right: TEAM_ROOM.startRow };

  teams.forEach((t, i) => {
    const id = typeof t === 'string' ? t : t.id;
    const count = typeof t === 'string' ? 4 : (t.count || 4);
    const side = i % 2 === 0 ? 'left' : 'right';
    const h = roomHeightFor(count);
    const col = TEAM_SIDE[side].col;
    const row = nextRow[side];
    nextRow[side] = row + h + TEAM_ROOM.gapY;

    pos[id] = {
      side, col, row, w: TEAM_ROOM.w, h,
      // 문은 복도를 향한 쪽 벽면 중앙에 낸다
      door: {
        col: side === 'left' ? col + TEAM_ROOM.w : col,
        row: row + h / 2,
      },
    };
  });
  return pos;
}

/* ═══════════ 맨 오른쪽 — 휴게공간 · 화장실 ═══════════ */
const FAR_RIGHT_COL = TEAM_SIDE.right.col + TEAM_ROOM.w + 2;   // = 48

export const LOUNGE = {
  id:'lounge', name:'휴게 공간', nameEn:'LOUNGE',
  col: FAR_RIGHT_COL, row: 4, w: 9, h: 12,
  door: { col: FAR_RIGHT_COL, row: 10 },
  fixtures: ['커피머신', '정수기', '냉장고', '간식 진열대', '휴게 테이블', '쓰레기통'],
};

export const RESTROOM = {
  id:'restroom', name:'화장실', nameEn:'RESTROOM',
  col: FAR_RIGHT_COL, row: 18, w: 9, h: 9,
  door: { col: FAR_RIGHT_COL, row: 22 },
};

/* ═══════════ 정문 · 안내 ═══════════ */
export const ENTRANCE = {
  label:'정문',
  col: CORRIDOR.cx, row: GRID.rows - 3,
  w: 9, h: 3,
};
export const RECEPTION = { col: CORRIDOR.cx - 16, row: GRID.rows - 6, w: 8, h: 3 };

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
export function deskSlots(count){
  const originCol = 0.6, originRow = 2.6, dw = 5, dh = 5.4, gap = 0.3, columns = 2;
  return Array.from({ length: count }, (_, i) => ({
    col: originCol + (i % columns) * (dw + gap),
    row: originRow + Math.floor(i / columns) * (dh + gap),
  }));
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

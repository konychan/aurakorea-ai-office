/* ===================== 근무시간 (여기 한 곳만 고치면 전체가 바뀐다) ===================== */
export const WORK_HOURS = {
  start: 11 * 60,   // 전 직원 출근 11:00
  end:   20 * 60,   // 근무 종료 20:00
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

/* ===================== 본부장 (직원 명단과 별도 관리) =====================
   대표님과 실무팀 사이의 총괄 오케스트레이터.
   대표님 지시를 받아 담당 팀장에게 전달하고, 팀장이 검증한 결과를 다시 검토해
   대표님께 직접 보고한다. 직원(STAFF)이 아니므로 data/staff.js 에 넣지 않는다. */
export const HQ_MANAGER = {
  name: '공민규',
  title: '본부장',
  hair: '#241C28',
  suit: '#2F3B52',
  tie: '#B04A6A',
  chair: '#7A6A88',
  desk: '#4A3A2E',
};

/* 보고 경로: 팀원 → 팀장 → 본부장 → 대표
   본부장이 팀에 업무를 줄 때도 팀장을 거친다 (팀장이 한 번 더 확인·지시한다). */
export const REPORTING_CHAIN = ['팀원', '팀장', '본부장', '대표'];

/* ===================== 논리 좌표계 (3단계 캐릭터 이동에서 사용) =====================
   TILE 단위 격자 위 좌표. 지금 단계에서는 화면 렌더링이 이 좌표를 100% 그대로
   그리지는 않지만(팀 룸은 반응형 CSS 그리드를 그대로 씀), 방/책상/대기줄/정문/복도의
   좌표 자체는 여기서 정의하고 각 DOM 요소에 data-col/data-row 로 심어 둔다. */
export const GRID = { tile: 24, cols: 34, rows: 30 };

export const CEO_ROOM = { col: 9, row: 1, w: 16, h: 7 };

export const CEO_DESK = {
  col: CEO_ROOM.col + CEO_ROOM.w / 2,
  row: CEO_ROOM.row + CEO_ROOM.h - 2,
};

// 대표실 문 앞 보고 대기줄 5칸 (3단계: 직원이 여기 순서대로 줄을 선다)
export const CEO_QUEUE = Array.from({ length: 5 }, (_, i) => ({
  slot: i + 1,
  col: CEO_ROOM.col + CEO_ROOM.w / 2 - 2 + i,
  row: CEO_ROOM.row + CEO_ROOM.h + 1,
}));

export const ENTRANCE = { label: '정문', col: Math.round(GRID.cols / 2), row: GRID.rows - 1 };

// 정문 → 복도 → 대표실 대기줄 을 잇는 경로 웨이포인트 (3단계 이동 경로용)
export const CORRIDOR = [
  { col: ENTRANCE.col, row: ENTRANCE.row },
  { col: ENTRANCE.col, row: CEO_ROOM.row + CEO_ROOM.h + 3 },
  { col: CEO_ROOM.col + CEO_ROOM.w / 2, row: CEO_ROOM.row + CEO_ROOM.h + 3 },
  { col: CEO_ROOM.col + CEO_ROOM.w / 2, row: CEO_ROOM.row + CEO_ROOM.h + 1 },
];

// 팀 수가 늘어나도 자동으로 3열 격자로 정리되는 팀 룸 좌표 생성기
export function layoutTeamRooms(teamIds) {
  const cols = 3;
  const w = 10, h = 9, gap = 1;
  const startRow = CEO_ROOM.row + CEO_ROOM.h + 5;
  const startCol = Math.round((GRID.cols - (w * cols + gap * (cols - 1))) / 2);
  const positions = {};
  teamIds.forEach((id, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    positions[id] = {
      col: startCol + c * (w + gap),
      row: startRow + r * (h + gap),
      w, h,
      door: { col: startCol + c * (w + gap) + Math.round(w / 2), row: startRow + r * (h + gap) + h },
    };
  });
  return positions;
}

// 방 안에서 직원 수만큼 책상이 놓일 상대 좌표 (방 원점 기준 offset, 2열 정렬)
export function deskSlots(count) {
  const originCol = 1, originRow = 2, dw = 4, dh = 3, gap = 1, columns = 2;
  return Array.from({ length: count }, (_, i) => ({
    col: originCol + (i % columns) * (dw + gap),
    row: originRow + Math.floor(i / columns) * (dh + gap),
  }));
}

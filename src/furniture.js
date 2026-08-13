import { PROP } from '../data/staff.js';

/* ═══════════════════════════════════════════════════════════════
   업무용 가구와 집기 (D 국면)

   헌장 9항:
   - 테이블은 평면 사각형이 아니라 두께·다리·모서리·재질·그림자를 가진 실제 가구여야 한다
   - 모든 업무 테이블 위에 모니터 / 본체 / 키보드 / 마우스 / 마우스패드 /
     서류 / 자료철 / 메모지 / 필기구 / 팀별 전용 소품이 있어야 한다
   - 모니터에는 담당자의 현재 업무 상태를 간단히 표시한다

   구도: 살짝 위에서 내려다본 각도라 상판 윗면이 사다리꼴로 보이고,
        그 위에 키보드·마우스가 놓인다. 캐릭터는 이 책상 뒤에 앉는다.
   ═══════════════════════════════════════════════════════════════ */

const WOOD = { top:'#B98D63', topLight:'#CBA37C', front:'#8A6544', leg:'#6B4E34', legDark:'#563E29' };
const LEADER_WOOD = { top:'#8A6A48', topLight:'#A08256', front:'#6B4F34', leg:'#513B27', legDark:'#3E2C1D' };

/* ── 팀별 전용 소품 (책상 위에 놓인다) ── */
function teamProp(kind){
  switch(kind){
    case 'tablet':    // 브랜드소싱 — 태블릿 거치대
      return `<g transform="translate(72 4)">
        <rect x="0" y="0" width="11" height="14" rx="1.4" fill="#3B3448"/>
        <rect x="1.4" y="1.4" width="8.2" height="10.4" rx=".6" fill="#6BE3E0" opacity=".7"/>
        <rect x="2" y="14" width="7" height="2" rx="1" fill="#5A5270"/></g>`;
    case 'clipboard': // 수출서류 — 체크보드
      return `<g transform="translate(72 3)">
        <rect x="0" y="0" width="11" height="15" rx="1" fill="#C9A97E"/>
        <rect x="1.4" y="2.2" width="8.2" height="11" fill="#FDFCFA"/>
        <rect x="3.4" y="-1.4" width="4.2" height="2.6" rx=".8" fill="#8C8697"/>
        <path d="M2.8 5.4l1.4 1.4 2.4-2.6M2.8 9l1.4 1.4 2.4-2.6" stroke="#2FBF8B" stroke-width="1" fill="none"/></g>`;
    case 'box':       // 물류 — 적재 박스
      return `<g transform="translate(72 4)">
        <rect x="0" y="2" width="12" height="12" rx="1" fill="#C9A97E"/>
        <path d="M0 6h12M6 2v12" stroke="#9C7F5C" stroke-width="1.2"/>
        <rect x="3.4" y="4.4" width="5.2" height="2.4" rx=".4" fill="#F5E6D0"/></g>`;
    case 'chart':     // 재무 — 차트 보드
      return `<g transform="translate(71 3)">
        <rect x="0" y="0" width="13" height="15" rx="1" fill="#FDFCFA" stroke="#B7A8C2" stroke-width=".8"/>
        <path d="M2.6 12V7.4M6 12V4M9.4 12V8.8" stroke="#2FBF8B" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M1.6 13.6h10" stroke="#B7A8C2" stroke-width=".8"/></g>`;
    case 'palette':   // 디자인 — 팔레트와 붓
      return `<g transform="translate(71 5)">
        <path d="M6 0a6.2 6.2 0 1 1 0 12.4c-1.4 0-1.4-1.6-.4-2.4 1-.9.2-2.2-1.2-2.2A5 5 0 0 1 6 0z" fill="#F0B8D0"/>
        <circle cx="4" cy="3.4" r="1.1" fill="#E56A92"/><circle cx="8" cy="2.6" r="1.1" fill="#6BE3E0"/>
        <circle cx="8.8" cy="6.4" r="1.1" fill="#E9B93F"/>
        <rect x="11" y="-1" width="1.6" height="10" rx=".8" fill="#8A6A48" transform="rotate(18 11 4)"/></g>`;
    case 'folder':    // 지역팀 — 국가별 자료철
    default:
      return `<g transform="translate(72 4)">
        <path d="M0 1.4h4.4L6 3.4h6v11H0z" fill="#E9B93F"/>
        <path d="M0 5h12v9.4H0z" fill="#F5D98C"/>
        <path d="M2.4 8h7.2M2.4 10.6h5.4" stroke="#C9A24B" stroke-width="1"/></g>`;
  }
}

/* ═══════════ 업무용 책상 + 집기 한 세트 ═══════════ */
export function workDesk(teamId, { isLeader = false } = {}){
  const w = isLeader ? LEADER_WOOD : WOOD;
  const prop = PROP[teamId] || 'folder';

  return `<svg class="deskSvg" viewBox="0 0 112 62" width="112" height="62">
    <!-- 바닥 그림자 -->
    <ellipse cx="56" cy="58" rx="46" ry="4" fill="rgba(0,0,0,.18)"/>

    <!-- ── 상판 뒤쪽에 세워지는 집기 ── -->
    <!-- 모니터 -->
    <g class="monitor">
      <rect x="12" y="-2" width="34" height="22" rx="2" fill="#2A2430"/>
      <rect x="14" y="0" width="30" height="18" rx="1" fill="#1B1622"/>
      <rect class="monScreen" x="14" y="0" width="30" height="18" rx="1" fill="#2FBF8B" opacity=".8"/>
      <text class="monText" x="29" y="11" text-anchor="middle" font-size="6.5" fill="#0E2B20">대기</text>
      <rect x="26" y="20" width="6" height="4" fill="#3A3444"/>
      <rect x="20" y="23" width="18" height="2.6" rx="1.2" fill="#4A4256"/>
    </g>

    <!-- 본체 (데스크톱 타워) -->
    <g class="tower">
      <rect x="94" y="2" width="13" height="23" rx="1.4" fill="#3A3444"/>
      <rect x="96" y="4.6" width="9" height="2" rx=".6" fill="#5A5270"/>
      <circle cx="100.5" cy="9.6" r="1.2" fill="#6BE3E0"/>
      <rect x="96" y="13" width="9" height="1.4" rx=".6" fill="#2A2430"/>
      <rect x="96" y="16" width="9" height="1.4" rx=".6" fill="#2A2430"/>
    </g>

    <!-- 팀별 전용 소품 -->
    ${teamProp(prop)}

    <!-- 서류 더미 -->
    <g class="papers">
      <rect x="49" y="9" width="15" height="11" rx=".6" fill="#F0EAF2" transform="rotate(-4 56 15)"/>
      <rect x="50" y="8" width="15" height="11" rx=".6" fill="#FDFCFA" transform="rotate(2 57 14)"/>
      <path d="M53 12h9M53 14.4h7" stroke="#C9C2D2" stroke-width=".9"/>
    </g>

    <!-- ── 상판 (윗면 사다리꼴 + 앞면 두께) ── -->
    <path d="M10 20h92l6 10H4z" fill="${w.topLight}"/>
    <path d="M4 30h104v5H4z" fill="${w.front}"/>
    <path d="M4 35h104v1.6H4z" fill="${w.legDark}" opacity=".5"/>

    <!-- ── 상판 위에 놓인 것들 ── -->
    <!-- 마우스패드 + 마우스 -->
    <ellipse cx="80" cy="26" rx="11" ry="3.4" fill="#4A4256" opacity=".45"/>
    <ellipse cx="80" cy="25.4" rx="3.2" ry="2.2" fill="#EDE9F2"/>
    <path d="M80 23.4v2" stroke="#B7A8C2" stroke-width=".7"/>
    <!-- 키보드 -->
    <g class="keyboard">
      <path d="M30 22h34l3 6H27z" fill="#E4DEEA"/>
      <path d="M31.4 23.6h31l1.4 3h-33.8z" fill="#F7F4F9"/>
      <path d="M33 25.2h27" stroke="#CBC3D4" stroke-width=".8"/>
    </g>
    <!-- 메모지 + 필기구 -->
    <g class="memo">
      <rect x="14" y="23" width="9" height="5" rx=".6" fill="#F6E9A8" transform="rotate(-6 18 25)"/>
      <path d="M15.6 25h5.4M15.6 26.4h3.6" stroke="#D9C36A" stroke-width=".7"/>
      <rect x="24" y="22.4" width="1.8" height="6.4" rx=".9" fill="#E56A92" transform="rotate(16 25 25)"/>
    </g>

    <!-- ── 다리 ── -->
    <rect x="12" y="36" width="7" height="20" rx="1" fill="${w.leg}"/>
    <rect x="12" y="36" width="2.4" height="20" fill="${w.legDark}" opacity=".5"/>
    <rect x="93" y="36" width="7" height="20" rx="1" fill="${w.leg}"/>
    <rect x="93" y="36" width="2.4" height="20" fill="${w.legDark}" opacity=".5"/>
    <!-- 가로 지지대 -->
    <rect x="19" y="46" width="74" height="3.4" rx="1.2" fill="${w.leg}" opacity=".8"/>
    <!-- 발 받침 -->
    <rect x="10" y="55.4" width="11" height="2.4" rx="1" fill="${w.legDark}"/>
    <rect x="91" y="55.4" width="11" height="2.4" rx="1" fill="${w.legDark}"/>
  </svg>`;
}

/* 자리 명패 — 이름과 역할을 책상 앞면에 붙인다 */
export function nameplate(s){
  return `<div class="deskPlate${s.rank === '팀장' ? ' deskPlate--lead' : ''}">
    <span class="deskPlate__nm">${s.n}</span>
    <span class="deskPlate__rk">${s.rank}</span>
    <span class="deskPlate__rl">${s.r}</span>
  </div>`;
}

/* 사무용 의자 — 캐릭터 뒤에 놓인다 */
export function officeChair(isLeader){
  const back = isLeader ? '#5E4A6E' : '#6E6288';
  return `<svg class="chairSvg" viewBox="0 0 46 44" width="46" height="44">
    <rect x="9" y="0" width="28" height="26" rx="7" fill="${back}"/>
    <rect x="12" y="4" width="22" height="18" rx="5" fill="${back}" opacity=".65"/>
    <rect x="6" y="24" width="34" height="6" rx="3" fill="${back}"/>
    <rect x="21" y="30" width="4" height="8" fill="#4A4256"/>
    <path d="M10 42h26l-3-4H13z" fill="#3E3648"/>
  </svg>`;
}

/* 모니터에 띄울 상태 텍스트와 색 (헌장 9-7) */
export const MONITOR_STATE = {
  '근무중':  { text:'작업중', bg:'#2FBF8B', fg:'#0E2B20' },
  '처리중':  { text:'처리중', bg:'#E9B93F', fg:'#3B2E10' },
  '보고대기':{ text:'보고대기', bg:'#E56A92', fg:'#41101F' },
  '미출근':  { text:'대기', bg:'#5A5270', fg:'#CFC3E8' },
  '퇴근':    { text:'OFF', bg:'#4A4256', fg:'#9A90AA' },
};

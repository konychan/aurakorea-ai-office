import { OUTFIT, PROP, SKIN } from '../data/staff.js';

/* ═══════════════════════════════════════════════════════════════
   전신 캐릭터 (C 국면)

   헌장 10항: 머리·얼굴·몸통·팔·손·다리·발을 가진 귀여운 사람 형태.
   이모티콘·원형 프로필·단순 아이콘으로 표현하지 않는다.
   서로 구분되는 얼굴·헤어스타일·복장·소품을 가진다.

   pose:
     'sit'  — 자기 자리에 앉은 모습 (책상 앞에서 타이핑)
     'walk' — 통로를 걷는 모습 (다리가 교차하고 팔이 흔들린다)
   애니메이션(눈 깜박임·호흡·걷기·타이핑)은 전부 CSS로 처리해 토큰을 쓰지 않는다.
   ═══════════════════════════════════════════════════════════════ */

const DARK = c => c; // 머리색은 data/staff.js의 hair를 그대로 쓴다

/* ── 헤어스타일 ── 머리(cx=16, cy=13, r=9) 위에 얹는다 */
function hairPath(style, color){
  switch(style){
    case 'crop':  // 아주 짧은 머리
      return `<path d="M7 12a9 9 0 0 1 18 0c0 1.4-.7 2-2 2H9c-1.3 0-2-.6-2-2z" fill="${color}"/>`;
    case 'short': // 짧은 머리 + 살짝 앞머리
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>
              <path d="M11 6.5c2.5 2 7.5 2 10 0" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case 'side':  // 옆가르마
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>
              <path d="M12 5.2c-1.6 2.4-2 5-1.6 7.6" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 'bob':   // 단발
      return `<path d="M6.5 14a9.5 9.5 0 0 1 19 0v5.5c0 .9-.7 1.5-1.6 1.5h-1.7V13.5H9.8V21H8.1c-.9 0-1.6-.6-1.6-1.5z" fill="${color}"/>`;
    case 'pony':  // 포니테일
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>
              <path d="M24.5 12c2.6.6 4 3 3.4 5.8-.4 2-1.6 3.4-3.2 4.2l-1.5-2c1-.5 1.8-1.4 2-2.6.3-1.5-.4-2.7-1.6-3z" fill="${color}"/>`;
    case 'bun':   // 올림머리
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>
              <circle cx="16" cy="2.6" r="3.4" fill="${color}"/>`;
    case 'wave':  // 웨이브
      return `<path d="M6.6 14a9.4 9.4 0 0 1 18.8 0v4.4c0 1-.8 1.7-1.8 1.7h-1.3V13.5H10.3V20H8.4c-1 0-1.8-.7-1.8-1.7z" fill="${color}"/>
              <path d="M8.8 19.5c1.2 1.2 1.2 2.6 0 3.8M23.2 19.5c-1.2 1.2-1.2 2.6 0 3.8" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'long':  // 긴 생머리
      return `<path d="M6.4 14a9.6 9.6 0 0 1 19.2 0v9.5c0 1-.8 1.8-1.8 1.8h-1.5V13.5H10.1v11.8H8.2c-1 0-1.8-.8-1.8-1.8z" fill="${color}"/>`;
    case 'curl':  // 곱슬
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>
              <circle cx="8.4" cy="9" r="2.6" fill="${color}"/><circle cx="16" cy="4.6" r="3" fill="${color}"/>
              <circle cx="23.6" cy="9" r="2.6" fill="${color}"/>`;
    default:
      return `<path d="M7 13a9 9 0 0 1 18 0c0 1.6-.8 2.2-2.2 2.2H9.2C7.8 15.2 7 14.6 7 13z" fill="${color}"/>`;
  }
}

/* ── 얼굴 ── 눈은 .eye 클래스를 달아 CSS로 깜박이게 한다 */
function facePath(kind){
  const blush = `<ellipse cx="10" cy="16.4" rx="1.7" ry="1.1" fill="#F2A0B4" opacity=".45"/>
                 <ellipse cx="22" cy="16.4" rx="1.7" ry="1.1" fill="#F2A0B4" opacity=".45"/>`;
  switch(kind){
    case 'dot':
      return `${blush}<circle class="eye" cx="12.6" cy="14" r="1.35" fill="#33282E"/>
              <circle class="eye" cx="19.4" cy="14" r="1.35" fill="#33282E"/>
              <path d="M14.8 17.4c.7.6 1.7.6 2.4 0" stroke="#8A6A5E" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    case 'line':
      return `${blush}<path class="eye" d="M11.2 14.4c.9-1.1 2.1-1.1 3 0" stroke="#33282E" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <path class="eye" d="M17.8 14.4c.9-1.1 2.1-1.1 3 0" stroke="#33282E" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <path d="M14.6 17.6c.8.8 2 .8 2.8 0" stroke="#8A6A5E" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    case 'calm':
      return `${blush}<rect class="eye" x="11.4" y="13.4" width="2.4" height="1.5" rx=".75" fill="#33282E"/>
              <rect class="eye" x="18.2" y="13.4" width="2.4" height="1.5" rx=".75" fill="#33282E"/>
              <path d="M15 17.5h2" stroke="#8A6A5E" stroke-width="1" stroke-linecap="round"/>`;
    case 'bright':
      return `${blush}<circle class="eye" cx="12.4" cy="14" r="1.9" fill="#33282E"/>
              <circle class="eye" cx="19.6" cy="14" r="1.9" fill="#33282E"/>
              <circle cx="13.1" cy="13.3" r=".6" fill="#fff"/><circle cx="20.3" cy="13.3" r=".6" fill="#fff"/>
              <path d="M14.6 17.6c.8.8 2 .8 2.8 0" stroke="#8A6A5E" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    case 'wink':
      return `${blush}<circle class="eye" cx="12.6" cy="14" r="1.5" fill="#33282E"/>
              <path d="M18.1 14.2c.9-1 2.1-1 3 0" stroke="#33282E" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <path d="M14.6 17.6c.8.8 2 .8 2.8 0" stroke="#8A6A5E" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    default:
      return `${blush}<circle class="eye" cx="12.6" cy="14" r="1.35" fill="#33282E"/>
              <circle class="eye" cx="19.4" cy="14" r="1.35" fill="#33282E"/>`;
  }
}

/* ── 상의 ── 팀별 복장. 팀장은 재킷을 덧입는다. */
function torsoPath(outfit, color, isLeader){
  const body = `<path d="M9.5 24h13c1.4 0 2.5 1.1 2.5 2.5V37H7V26.5C7 25.1 8.1 24 9.5 24z" fill="${color}"/>`;
  let extra = '';

  if(outfit === 'vest'){          // 조끼 (리서치 성격)
    extra = `<path d="M11.6 24h8.8v11h-8.8z" fill="#fff" opacity=".28"/>
             <path d="M14.6 24l1.4 3 1.4-3" fill="none" stroke="#fff" stroke-width="1.1" opacity=".7"/>`;
  } else if(outfit === 'polo'){   // 폴로 (물류 현장)
    extra = `<path d="M13.4 24l2.6 2.4 2.6-2.4" fill="none" stroke="#fff" stroke-width="1.3" opacity=".75"/>`;
  } else if(outfit === 'hoodie'){ // 후드 (디자인)
    extra = `<path d="M10.8 24c1.4 2.6 8.9 2.6 10.4 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".5"/>
             <path d="M16 26.5v6" stroke="#fff" stroke-width="1" opacity=".55"/>`;
  } else {                        // 셔츠 (기본)
    extra = `<path d="M16 24v12" stroke="#fff" stroke-width=".9" opacity=".45"/>
             <path d="M13.8 24l2.2 2.6 2.2-2.6" fill="none" stroke="#fff" stroke-width="1.1" opacity=".65"/>`;
  }

  // 팀장 재킷 + 넥타이
  const jacket = isLeader
    ? `<path d="M8.6 24.4L7 26.5V37h3.6V25.6zM23.4 24.4L25 26.5V37h-3.6V25.6z" fill="#2E2A38"/>
       <path d="M15 24h2l-.6 2.4.9 4.4-1.3 1.4-1.3-1.4.9-4.4z" fill="#B04A6A"/>`
    : '';

  return body + extra + jacket;
}

/* ── 소품 ── 팀 성격을 드러내는 손에 든 물건 */
function propPath(kind){
  switch(kind){
    case 'tablet':    return `<rect x="0.5" y="-4" width="7" height="9" rx="1" fill="#3B3448"/><rect x="1.4" y="-3" width="5.2" height="6.4" rx=".5" fill="#6BE3E0" opacity=".75"/>`;
    case 'clipboard': return `<rect x="0.5" y="-4" width="7" height="9" rx="1" fill="#C9A97E"/><rect x="1.5" y="-2.6" width="5" height="6.2" fill="#FDFCFA"/><rect x="2.6" y="-5" width="2.8" height="1.6" rx=".5" fill="#8C8697"/>`;
    case 'folder':    return `<path d="M0.5 -3.5h3l1 1.2h3v7.5h-7z" fill="#E9B93F"/><path d="M0.5 -1h7v6.2h-7z" fill="#F5D98C"/>`;
    case 'box':       return `<rect x="0" y="-3.5" width="8" height="8" rx="1" fill="#C9A97E"/><path d="M0 -1h8M4 -3.5v8" stroke="#9C7F5C" stroke-width="1"/>`;
    case 'chart':     return `<rect x="0.5" y="-4" width="7" height="9" rx="1" fill="#FDFCFA" stroke="#B7A8C2"/><path d="M2 3V0M4 3v-4.4M6 3v-2.4" stroke="#2FBF8B" stroke-width="1.2" stroke-linecap="round"/>`;
    case 'palette':   return `<path d="M4 -4a4.5 4.5 0 1 1 0 9c-1 0-1-1.2-.3-1.8.8-.7.2-1.6-.9-1.6A3.6 3.6 0 0 1 4 -4z" fill="#F0B8D0"/><circle cx="2.6" cy="-1.6" r=".8" fill="#E56A92"/><circle cx="5.4" cy="-2.2" r=".8" fill="#6BE3E0"/><circle cx="6" cy=".6" r=".8" fill="#E9B93F"/>`;
    default:          return '';
  }
}

/* ═════════ 앉은 자세 ═════════
   책상 앞에 앉아 타이핑하는 모습. 무릎 아래는 책상에 가려지는 구도라
   상반신 + 허벅지까지 보여준다. */
function sitSVG(s, skin, hair, outfit, isLeader, cls){
  return `<svg class="char char--sit ${cls}" viewBox="0 0 32 52" width="44" height="71">
    <ellipse cx="16" cy="50" rx="11" ry="2.2" fill="rgba(0,0,0,.16)"/>
    <!-- 다리: 허벅지(수평) → 무릎 → 종아리(수직) → 발 -->
    <g class="leg leg--l">
      <rect x="9.6" y="35" width="5.4" height="6.6" rx="2.2" fill="#3E3648"/>
      <rect x="10" y="40" width="4.6" height="7" rx="2" fill="#4A4256"/>
      <ellipse cx="12.3" cy="48.4" rx="3.1" ry="1.8" fill="#2A2430"/>
    </g>
    <g class="leg leg--r">
      <rect x="17" y="35" width="5.4" height="6.6" rx="2.2" fill="#3E3648"/>
      <rect x="17.4" y="40" width="4.6" height="7" rx="2" fill="#4A4256"/>
      <ellipse cx="19.7" cy="48.4" rx="3.1" ry="1.8" fill="#2A2430"/>
    </g>
    <!-- 몸통 -->
    <g class="torso">
      ${torsoPath(outfit, s.top, isLeader)}
      <!-- 팔: 책상 위로 뻗어 타이핑 -->
      <g class="arm arm--l"><rect x="4.6" y="26" width="4.2" height="9" rx="2.1" fill="${s.top}"/>
        <circle cx="6.7" cy="35.4" r="2.1" fill="${skin}"/></g>
      <g class="arm arm--r"><rect x="23.2" y="26" width="4.2" height="9" rx="2.1" fill="${s.top}"/>
        <circle cx="25.3" cy="35.4" r="2.1" fill="${skin}"/></g>
    </g>
    <!-- 목 -->
    <rect x="14.2" y="20.6" width="3.6" height="4" rx="1.6" fill="${skin}"/>
    <!-- 머리 -->
    <g class="head">
      <circle cx="16" cy="13" r="9" fill="${skin}"/>
      ${facePath(s.fc)}
      ${hairPath(s.hs, hair)}
    </g>
  </svg>`;
}

/* ═════════ 걷는 자세 ═════════
   다리가 교차하고 팔이 흔들린다. 애니메이션은 CSS(.char--walk)가 담당. */
function walkSVG(s, skin, hair, outfit, isLeader, prop, cls){
  return `<svg class="char char--walk ${cls}" viewBox="0 0 32 52" width="40" height="65">
    <ellipse class="shadow" cx="16" cy="50" rx="9" ry="2" fill="rgba(0,0,0,.22)"/>
    <!-- 뒷다리 -->
    <g class="leg leg--b">
      <rect x="16.4" y="36" width="5" height="11" rx="2.4" fill="#3E3648"/>
      <ellipse cx="18.9" cy="48.2" rx="3.2" ry="1.9" fill="#2A2430"/>
    </g>
    <!-- 앞다리 -->
    <g class="leg leg--f">
      <rect x="10.6" y="36" width="5" height="11" rx="2.4" fill="#4A4256"/>
      <ellipse cx="13.1" cy="48.2" rx="3.2" ry="1.9" fill="#332D3B"/>
    </g>
    <!-- 뒷팔 -->
    <g class="arm arm--b">
      <rect x="22.8" y="25.6" width="4.2" height="10" rx="2.1" fill="${s.top}"/>
      <circle cx="24.9" cy="36" r="2.1" fill="${skin}"/>
    </g>
    <!-- 몸통 -->
    <g class="torso">${torsoPath(outfit, s.top, isLeader)}</g>
    <!-- 앞팔 + 소품 -->
    <g class="arm arm--f">
      <rect x="5" y="25.6" width="4.2" height="10" rx="2.1" fill="${s.top}"/>
      <circle cx="7.1" cy="36" r="2.1" fill="${skin}"/>
      ${prop ? `<g transform="translate(-1.5 36)">${propPath(prop)}</g>` : ''}
    </g>
    <!-- 목 -->
    <rect x="14.2" y="20.6" width="3.6" height="4" rx="1.6" fill="${skin}"/>
    <!-- 머리 -->
    <g class="head">
      <circle cx="16" cy="13" r="9" fill="${skin}"/>
      ${facePath(s.fc)}
      ${hairPath(s.hs, hair)}
    </g>
  </svg>`;
}

/* ═════════ 공개 API ═════════ */
export function character(s, { pose = 'sit', withProp = true, className = '' } = {}){
  const skin = SKIN[s.sk ?? 0] || SKIN[0];
  const hair = DARK(s.hair);
  const outfit = OUTFIT[s.t] || 'shirt';
  const isLeader = s.rank === '팀장';
  const prop = withProp ? PROP[s.t] : null;
  return pose === 'walk'
    ? walkSVG(s, skin, hair, outfit, isLeader, prop, className)
    : sitSVG(s, skin, hair, outfit, isLeader, className);
}

/* 대표·본부장처럼 STAFF에 없는 인물도 같은 규격으로 그린다 */
export function vipCharacter({ hair, suit, tie, sk = 0, hs = 'side', fc = 'calm' }, pose = 'sit'){
  return character(
    { hair, top: suit, sk, hs, fc, rank: '팀장', t: '_vip' },
    { pose, withProp: false, className: 'char--vip' }
  ).replace('#B04A6A', tie || '#B04A6A');
}

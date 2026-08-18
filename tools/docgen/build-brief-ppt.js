/* 샘플 산출물 — 2026 하반기 3대 수출시장 브리핑 (PPT)
   내용은 시장조사 담당 3명(박세렌·윤도아·최이든)이 실제 웹 검색으로 조사한
   data/agent-results.json 을 그대로 근거로 삼는다. */
const fs = require('fs');
const path = require('path');
const Pptx = require('pptxgenjs');
const { C, F, T, M, SLIDE } = require('./brand');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/agent-results.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const p = new Pptx();
p.defineLayout({ name: 'A16x9', width: SLIDE.w, height: SLIDE.h });
p.layout = 'A16x9';
p.author = '아우라코리아 · 강태오';
p.company = 'AURA KOREA';
p.title = '2026 하반기 3대 수출시장 브리핑';

/* ── 공통 파츠 ──────────────────────────────────────────────────── */

// 내지 상단: 제목 + 골드 헤어라인. 모든 내지가 같은 자리에서 시작해야 눈이 편하다.
function header(s, kicker, title) {
  s.addText(kicker, {
    x: M.x, y: M.top, w: 8, h: 0.26,
    fontFace: F.body, fontSize: T.micro, color: C.mint, bold: true, charSpacing: 2.4,
  });
  s.addText(title, {
    x: M.x, y: M.top + 0.24, w: 10.4, h: 0.62,
    fontFace: F.head, fontSize: T.title, color: C.ink, bold: true,
  });
  s.addShape(p.ShapeType.rect, { x: M.x, y: M.top + 0.94, w: 0.86, h: 0.035, fill: { color: C.gold } });
}

// 하단 러닝: 페이지 번호 + 출처 표기 자리
function footer(s, no, src) {
  s.addShape(p.ShapeType.rect, {
    x: M.x, y: SLIDE.h - M.bottom - 0.24, w: SLIDE.w - M.x * 2, h: 0.01, fill: { color: C.line },
  });
  if (src) {
    s.addText(src, {
      x: M.x, y: SLIDE.h - M.bottom - 0.16, w: 9.6, h: 0.22,
      fontFace: F.body, fontSize: T.micro, color: C.muted,
    });
  }
  s.addText(String(no), {
    x: SLIDE.w - M.x - 0.6, y: SLIDE.h - M.bottom - 0.16, w: 0.6, h: 0.22,
    fontFace: F.num, fontSize: T.micro, color: C.muted, align: 'right',
  });
}

// 카드 — 흰 바닥 + 얇은 선. 그림자는 쓰지 않는다(인쇄에서 지저분해진다).
function card(s, { x, y, w, h, accent }) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: C.card }, line: { color: C.line, width: 0.75 },
  });
  if (accent) s.addShape(p.ShapeType.rect, { x, y, w: 0.045, h, fill: { color: accent } });
}

/* ── 1. 표지 ────────────────────────────────────────────────────── */
{
  const s = p.addSlide();
  s.background = { color: C.deep };
  // 오른쪽 아래로 흐르는 톤 블록 — 단색 표지를 깊이 있게 만든다
  s.addShape(p.ShapeType.rect, { x: 7.5, y: 0, w: 5.833, h: SLIDE.h, fill: { color: C.deepSoft } });
  s.addShape(p.ShapeType.rect, { x: 7.5, y: 0, w: 0.02, h: SLIDE.h, fill: { color: C.gold } });

  s.addText('AURA KOREA', {
    x: M.x, y: 0.86, w: 6, h: 0.3,
    fontFace: F.num, fontSize: T.small, color: C.gold, bold: true, charSpacing: 5,
  });
  s.addShape(p.ShapeType.rect, { x: M.x, y: 2.02, w: 1.15, h: 0.045, fill: { color: C.mint } });
  s.addText('2026 하반기\n3대 수출시장 브리핑', {
    x: M.x, y: 2.36, w: 6.4, h: 1.9,
    fontFace: F.head, fontSize: T.display, color: C.white, bold: true, lineSpacingMultiple: 1.18,
  });
  s.addText('아르헨티나 · 스페인/EU · GCC', {
    x: M.x, y: 4.42, w: 6.4, h: 0.32,
    fontFace: F.body, fontSize: T.lead, color: C.mintPale,
  });
  s.addText('시장조사 담당 3인이 직접 조사한 결과입니다', {
    x: M.x, y: 4.76, w: 6.4, h: 0.3,
    fontFace: F.body, fontSize: T.small, color: C.muted,
  });

  s.addText([
    { text: '보고 ', options: { color: C.muted } },
    { text: '본부장 공민규', options: { color: C.white, bold: true } },
    { text: '   |   작성 ', options: { color: C.muted } },
    { text: '문서제작 강태오', options: { color: C.white, bold: true } },
  ], { x: M.x, y: 6.16, w: 6.4, h: 0.26, fontFace: F.body, fontSize: T.small });
  s.addText('2026. 08. 18.', {
    x: M.x, y: 6.46, w: 6.4, h: 0.26, fontFace: F.num, fontSize: T.small, color: C.muted,
  });

  // 우측 패널 — 한 장에 숫자 세 개만. 표지에서 결론이 먼저 보이게 한다.
  const stats = [
    ['21.7%', 'EU 수입 화장품 점유율 1위'],
    ['90%+', '아르헨티나 대한 수입 증가율'],
    ['75%+', 'GCC 수요의 사우디·UAE 집중도'],
  ];
  stats.forEach(([n, label], i) => {
    const y = 2.1 + i * 1.24;
    s.addText(n, {
      x: 8.5, y, w: 4, h: 0.62,
      fontFace: F.num, fontSize: 34, color: C.mint, bold: true,
    });
    s.addText(label, {
      x: 8.5, y: y + 0.6, w: 4.1, h: 0.28, fontFace: F.body, fontSize: T.small, color: C.mintPale,
    });
  });
}

/* ── 2. 한 장 요약 ──────────────────────────────────────────────── */
{
  const s = p.addSlide();
  s.background = { color: C.paper };
  header(s, 'EXECUTIVE SUMMARY', '지금 시장은 이렇게 갈리고 있습니다');

  const regions = [
    { key: '윤도아', tag: '스페인 · EU',   accent: C.deep, verdict: '방어',   note: '이미 1위 — 규제가 변수' },
    { key: '최이든', tag: 'GCC · 중동',    accent: C.mint, verdict: '집중',   note: '두 나라에 자원을 몰아야' },
    { key: '박세렌', tag: '아르헨티나',    accent: C.gold, verdict: '선점',   note: '작지만 가장 빨리 크는 곳' },
  ];

  const cw = (SLIDE.w - M.x * 2 - M.gut * 2) / 3;
  regions.forEach((r, i) => {
    const x = M.x + i * (cw + M.gut);
    const y = 2.2, h = 3.1;
    card(s, { x, y, w: cw, h, accent: r.accent });

    s.addText(r.tag, {
      x: x + 0.34, y: y + 0.3, w: cw - 0.6, h: 0.26,
      fontFace: F.body, fontSize: T.small, color: C.muted, bold: true, charSpacing: 1.2,
    });
    s.addText(r.verdict, {
      x: x + 0.34, y: y + 0.6, w: cw - 0.6, h: 0.56,
      fontFace: F.head, fontSize: 26, color: r.accent, bold: true,
    });
    s.addText(r.note, {
      x: x + 0.34, y: y + 1.18, w: cw - 0.6, h: 0.3,
      fontFace: F.body, fontSize: T.body, color: C.ink, bold: true,
    });
    s.addShape(p.ShapeType.rect, { x: x + 0.34, y: y + 1.62, w: cw - 0.68, h: 0.008, fill: { color: C.line } });
    s.addText(DATA[r.key].headline, {
      x: x + 0.34, y: y + 1.78, w: cw - 0.68, h: 1.5,
      fontFace: F.body, fontSize: T.small, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top',
    });
  });

  s.addText([
    { text: '본부장 의견   ', options: { color: C.gold, bold: true } },
    { text: '세 시장을 같은 무게로 다루면 셋 다 놓칩니다. EU는 규제 대응(라벨·포장)에, GCC는 사우디·UAE 두 나라에, 아르헨티나는 선점 속도에 예산을 나눠 배분하실 것을 제안드립니다.', options: { color: C.white } },
  ], {
    x: M.x, y: 5.86, w: SLIDE.w - M.x * 2, h: 0.72,
    fontFace: F.body, fontSize: T.body, fill: { color: C.deep }, margin: 12, valign: 'middle',
    lineSpacingMultiple: 1.3,
  });

  footer(s, 2, '출처: 시장조사 담당 3인 웹 검색 리서치 (2026.08.18)');
}

/* ── 3~5. 지역별 상세 ───────────────────────────────────────────── */
const details = [
  {
    key: '박세렌', no: 3, kicker: 'ARGENTINA', title: '아르헨티나 — 작지만 가장 빨리 크는 시장',
    accent: C.gold,
    stat: [['1.2%', '한국 점유율'], ['90%+', '전년 대비 성장'], ['60%', '상위 3개국 과점']],
    chart: { labels: ['프랑스·브라질·미국', '기타', '한국'], values: [60, 38.8, 1.2] },
  },
  {
    key: '윤도아', no: 4, kicker: 'SPAIN / EU', title: '스페인·EU — 1위지만 규제가 흔든다',
    accent: C.deep,
    stat: [['21.7%', 'EU 수입 점유율 1위'], ['5위', '대EU 수출국 순위'], ['2건', '2026년 시행 규제']],
    timeline: [
      ['2026.07', 'INCI 성분 사전 강제 · 알레르겐 82종 표기'],
      ['2026.08.12', 'PPWR 시행 — PFAS·중금속 제한, 포장 추적성'],
    ],
  },
  {
    key: '최이든', no: 5, kicker: 'GCC', title: 'GCC — 두 나라가 시장의 4분의 3',
    accent: C.mint,
    stat: [['52%', '사우디 비중'], ['75%+', '사우디+UAE 합계'], ['4~8주', 'UAE 등록 소요']],
    chart: { labels: ['사우디', 'UAE 외 GCC'], values: [52, 48] },
  },
];

details.forEach(d => {
  const s = p.addSlide();
  s.background = { color: C.paper };
  header(s, d.kicker, d.title);

  // 헤드라인 배너 — 이 장에서 딱 하나 기억할 문장.
  // 밝은 골드 바탕에 흰 글씨는 대비가 무너진다. 바탕이 밝으면 글자를 잉크색으로 뒤집는다.
  const onAccent = d.accent === C.gold ? C.ink : C.white;
  s.addText(DATA[d.key].headline, {
    x: M.x, y: 1.72, w: SLIDE.w - M.x * 2, h: 0.52,
    fontFace: F.head, fontSize: T.lead, color: onAccent, bold: true,
    fill: { color: d.accent }, margin: 12, valign: 'middle',
  });

  // 숫자 3개 — 좌측
  d.stat.forEach(([n, l], i) => {
    const x = M.x + i * 2.42;
    s.addText(n, { x, y: 2.52, w: 2.3, h: 0.56, fontFace: F.num, fontSize: 26, color: d.accent, bold: true });
    s.addText(l, { x, y: 3.08, w: 2.3, h: 0.26, fontFace: F.body, fontSize: T.small, color: C.muted });
  });

  // 핵심 포인트 — 좌측 본문
  // indent 를 줄이지 않으면 불릿과 글자 사이가 벌어져 목록이 흩어져 보인다
  const pts = DATA[d.key].keyPoints.map(t => ({
    text: t, options: { bullet: { code: '2022', indent: 14 }, breakLine: true },
  }));
  s.addText(pts, {
    x: M.x, y: 3.6, w: 7.0, h: 2.1,
    fontFace: F.body, fontSize: T.body, color: C.ink, lineSpacingMultiple: 1.55, valign: 'top',
  });

  // 주의 박스 — 하단 폭 전체
  s.addShape(p.ShapeType.roundRect, {
    x: M.x, y: 5.84, w: SLIDE.w - M.x * 2, h: 0.72, rectRadius: 0.05,
    fill: { color: C.warnPale }, line: { color: C.gold, width: 0.75 },
  });
  s.addText([
    { text: '주의   ', options: { color: C.warn, bold: true } },
    { text: DATA[d.key].watchOut, options: { color: C.ink } },
  ], {
    x: M.x + 0.22, y: 5.9, w: SLIDE.w - M.x * 2 - 0.44, h: 0.6,
    fontFace: F.body, fontSize: T.small, valign: 'middle', lineSpacingMultiple: 1.35,
  });

  // 우측 — 차트 또는 타임라인
  if (d.chart) {
    s.addChart(p.ChartType.doughnut, [{
      name: '점유율', labels: d.chart.labels, values: d.chart.values,
    }], {
      x: 7.55, y: 2.42, w: 5.06, h: 3.26,
      holeSize: 62, chartColors: [d.accent, 'DCD8CF', C.mint],
      showLegend: true, legendPos: 'b', legendFontSize: 9, legendFontFace: F.body,
      showValue: false, dataBorder: { pt: 2, color: C.paper },
      showTitle: false,
    });
  } else {
    s.addText('규제 캘린더', {
      x: 7.55, y: 2.5, w: 5.06, h: 0.28,
      fontFace: F.body, fontSize: T.small, color: C.muted, bold: true, charSpacing: 1.2,
    });
    // 세로 축선 + 마디 — 날짜가 중요한 장이므로 도넛보다 타임라인이 맞다
    s.addShape(p.ShapeType.rect, { x: 7.68, y: 2.98, w: 0.014, h: 2.3, fill: { color: C.line } });
    d.timeline.forEach(([when, what], i) => {
      const y = 3.02 + i * 1.16;
      s.addShape(p.ShapeType.ellipse, { x: 7.6, y: y + 0.04, w: 0.17, h: 0.17, fill: { color: d.accent } });
      s.addText(when, {
        x: 7.94, y, w: 4.6, h: 0.28, fontFace: F.num, fontSize: T.body, color: d.accent, bold: true,
      });
      s.addText(what, {
        x: 7.94, y: y + 0.3, w: 4.62, h: 0.66,
        fontFace: F.body, fontSize: T.small, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top',
      });
    });
  }

  footer(s, d.no, '출처: ' + DATA[d.key].sources.map(x => x.title.split(' - ').pop()).join(' · '));
});

/* ── 6. 결론 ────────────────────────────────────────────────────── */
{
  const s = p.addSlide();
  s.background = { color: C.deep };
  s.addText('DECISION', {
    x: M.x, y: M.top + 0.1, w: 8, h: 0.26,
    fontFace: F.body, fontSize: T.micro, color: C.gold, bold: true, charSpacing: 2.4,
  });
  s.addText('대표님 결정이 필요한 세 가지', {
    x: M.x, y: M.top + 0.34, w: 10.4, h: 0.66,
    fontFace: F.head, fontSize: T.title, color: C.white, bold: true,
  });
  s.addShape(p.ShapeType.rect, { x: M.x, y: M.top + 1.06, w: 0.86, h: 0.035, fill: { color: C.gold } });

  const asks = [
    ['01', 'EU 라벨·포장 재작업 착수 시점', '8월 12일 PPWR 이후 기존 포장 재고가 유통 불가해질 수 있습니다. 재고 소진 계획과 재작업 예산을 언제 잡을지 정해 주십시오.'],
    ['02', 'GCC 진입 채널과 할랄 인증 여부', '할랄은 법적 의무가 아닙니다. 목표 채널이 요구하는지 먼저 확인하고 인증 비용 집행 여부를 결정하시길 제안드립니다.'],
    ['03', '아르헨티나 선점 투자 규모', '점유율 1.2%, 성장률 90%+ 구간입니다. ANMAT 등록 리드타임을 감안하면 지금 착수해야 내년 시즌에 맞습니다.'],
  ];
  asks.forEach(([no, t, body], i) => {
    const y = 2.34 + i * 1.6;
    s.addText(no, {
      x: M.x, y, w: 0.7, h: 0.5, fontFace: F.num, fontSize: 22, color: C.gold, bold: true,
    });
    s.addText(t, {
      x: M.x + 0.82, y: y + 0.02, w: 11.2, h: 0.32,
      fontFace: F.head, fontSize: T.lead, color: C.white, bold: true,
    });
    s.addText(body, {
      x: M.x + 0.82, y: y + 0.4, w: 11.2, h: 0.66,
      fontFace: F.body, fontSize: T.small, color: C.mintPale, lineSpacingMultiple: 1.45, valign: 'top',
    });
    if (i < 2) s.addShape(p.ShapeType.rect, { x: M.x, y: y + 1.3, w: SLIDE.w - M.x * 2, h: 0.008, fill: { color: C.deepSoft } });
  });

  s.addText('AURA KOREA', {
    x: M.x, y: SLIDE.h - M.bottom - 0.2, w: 4, h: 0.24,
    fontFace: F.num, fontSize: T.micro, color: C.gold, bold: true, charSpacing: 4,
  });
}

const file = path.join(OUT, '2026-하반기-3대-수출시장-브리핑.pptx');
p.writeFile({ fileName: file }).then(() => console.log(file));

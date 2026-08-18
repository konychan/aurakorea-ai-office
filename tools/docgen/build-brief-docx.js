/* 샘플 산출물 — 3대 수출시장 브리핑 (Word)
   Word 는 "표지 · 제목 위계 · 본문 조판" 세 가지로 승부한다.
   기본 스타일을 그대로 쓰면 반드시 아마추어 문서가 된다. 스타일부터 다시 정의한다. */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType, PageBreak, Footer, PageNumber,
  convertInchesToTwip,
} = require('docx');
const { C, F, T } = require('./brand');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/agent-results.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const half = pt => pt * 2;          // docx 는 글자 크기를 half-point 로 받는다
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const noBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

/* ── 표지 ───────────────────────────────────────────────────────── */
const cover = [
  new Paragraph({ spacing: { before: 2600 } }),
  new Paragraph({
    children: [new TextRun({ text: 'A U R A   K O R E A', font: F.num, size: half(10), bold: true, color: C.gold })],
  }),
  // 짧은 민트 악센트 선. 문단 테두리를 쓰면 본문 폭 전체로 늘어나므로 1×1 표로 길이를 잡는다.
  new Table({
    width: { size: 12, type: WidthType.PERCENTAGE },
    borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 18, color: C.mint } },
    rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ spacing: { before: 200 } })] })] })],
  }),
  // 제목은 반드시 TextRun 두 개로 나눈다. 한 TextRun 안의 \n 은 Word 에서 줄바꿈이 아니라
  // 커다란 문단 간격으로 새어 나온다 (실제로 겪었다).
  new Paragraph({
    // line 은 "줄 배수 × 240" 이다 (280 ≈ 1.17줄). pt 로 착각하면 제목 두 줄이 멀찍이 떨어진다.
    spacing: { before: 420, line: 280 },
    children: [
      new TextRun({ text: '2026 하반기', font: F.head, size: half(28), bold: true, color: C.ink }),
      new TextRun({ text: '3대 수출시장 브리핑', font: F.head, size: half(28), bold: true, color: C.ink, break: 1 }),
    ],
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: '아르헨티나 · 스페인/EU · GCC', font: F.body, size: half(13), color: C.deep })],
  }),
  new Paragraph({
    spacing: { before: 60 },
    children: [new TextRun({ text: '시장조사 담당 3인이 실제 웹 검색으로 조사한 결과입니다.', font: F.body, size: half(10), color: C.muted })],
  }),
  new Paragraph({
    spacing: { before: 3200 },
    children: [
      new TextRun({ text: '보고  ', font: F.body, size: half(9.5), color: C.muted }),
      new TextRun({ text: '본부장 공민규', font: F.body, size: half(9.5), bold: true, color: C.ink }),
      new TextRun({ text: '     작성  ', font: F.body, size: half(9.5), color: C.muted }),
      new TextRun({ text: '문서제작 강태오', font: F.body, size: half(9.5), bold: true, color: C.ink }),
    ],
  }),
  new Paragraph({
    children: [new TextRun({ text: '2026. 08. 18.', font: F.num, size: half(9.5), color: C.muted })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ── 본문 파츠 ──────────────────────────────────────────────────── */
const h1 = text => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 420, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.line, space: 8 } },
  children: [new TextRun({ text, font: F.head, size: half(17), bold: true, color: C.ink })],
});

const h2 = text => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 100 },
  children: [new TextRun({ text, font: F.head, size: half(12.5), bold: true, color: C.deep })],
});

// 한글 본문은 양쪽 맞춤(JUSTIFIED)을 쓰지 않는다. 어절 사이가 들쭉날쭉 벌어져
// 줄마다 공백 폭이 달라 보인다. 왼쪽 정렬이 훨씬 깨끗하다.
const body = text => new Paragraph({
  spacing: { after: 120, line: 330 },
  alignment: AlignmentType.LEFT,
  children: [new TextRun({ text, font: F.body, size: half(10.5), color: C.ink })],
});

const bullet = text => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 60, line: 320 },
  indent: { left: convertInchesToTwip(0.28), hanging: convertInchesToTwip(0.18) },
  children: [new TextRun({ text, font: F.body, size: half(10.5), color: C.ink })],
});

// 강조 박스 — 배경만 깔고 왼쪽에 색 선을 세운다
const callout = (label, text, tone) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 18, color: tone.line } },
  rows: [new TableRow({
    children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: tone.fill },
      margins: { top: 160, bottom: 160, left: 220, right: 220 },
      children: [new Paragraph({
        spacing: { line: 320 },
        children: [
          new TextRun({ text: label + '   ', font: F.body, size: half(9.5), bold: true, color: tone.line }),
          new TextRun({ text, font: F.body, size: half(10), color: C.ink }),
        ],
      })],
    })],
  })],
});

const TONE = {
  warn: { line: C.warn, fill: C.warnPale },
  key:  { line: C.mint, fill: C.mintPale },
};

/* ── 지역별 본문 ────────────────────────────────────────────────── */
const REGIONS = [
  { key: '윤도아', title: '1. 스페인 · EU — 1위지만 규제가 흔든다' },
  { key: '최이든', title: '2. GCC · 중동 — 두 나라가 시장의 4분의 3' },
  { key: '박세렌', title: '3. 아르헨티나 — 작지만 가장 빨리 크는 시장' },
];

const bodyParas = [];
bodyParas.push(h1('요약'));
bodyParas.push(body('세 시장을 같은 무게로 다루면 셋 다 놓칩니다. EU는 규제 대응(라벨·포장)에, GCC는 사우디·UAE 두 나라에, 아르헨티나는 선점 속도에 예산을 나눠 배분하실 것을 제안드립니다.'));
REGIONS.forEach(r => {
  bodyParas.push(new Paragraph({
    spacing: { before: 100, after: 40 },
    children: [
      new TextRun({ text: '· ', color: C.gold, bold: true, size: half(10.5) }),
      new TextRun({ text: DATA[r.key].headline, font: F.body, size: half(10.5), color: C.ink }),
    ],
  }));
});

REGIONS.forEach(r => {
  const d = DATA[r.key];
  bodyParas.push(h1(r.title));
  bodyParas.push(callout('핵심', d.headline, TONE.key));
  bodyParas.push(new Paragraph({ spacing: { after: 160 } }));
  bodyParas.push(h2('시장 상황'));
  bodyParas.push(body(d.text));
  bodyParas.push(h2('알아야 할 것'));
  d.keyPoints.forEach(k => bodyParas.push(bullet(k)));
  bodyParas.push(new Paragraph({ spacing: { after: 140 } }));
  bodyParas.push(callout('주의', d.watchOut, TONE.warn));
  bodyParas.push(new Paragraph({ spacing: { after: 160 } }));
  bodyParas.push(h2('출처'));
  d.sources.forEach(s => bodyParas.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: '— ' + s.title, font: F.body, size: half(8.5), color: C.muted })],
  })));
});

/* ── 문서 조립 ──────────────────────────────────────────────────── */
const doc = new Document({
  creator: '아우라코리아 · 강태오',
  title: '2026 하반기 3대 수출시장 브리핑',
  sections: [{
    properties: {
      titlePage: true,   // 표지에는 바닥글(페이지 번호)을 넣지 않는다
      page: {
        margin: {
          top: convertInchesToTwip(1.1), bottom: convertInchesToTwip(1.0),
          left: convertInchesToTwip(1.1), right: convertInchesToTwip(1.1),
        },
      },
    },
    footers: {
      first: new Footer({ children: [new Paragraph({})] }),
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 8 } },
          children: [
            new TextRun({ text: 'AURA KOREA      ', font: F.num, size: half(7.5), color: C.muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: F.num, size: half(8), color: C.muted }),
          ],
        })],
      }),
    },
    children: [...cover, ...bodyParas],
  }],
});

const file = path.join(OUT, '2026-하반기-3대-수출시장-브리핑.docx');
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(file, buf); console.log(file); });

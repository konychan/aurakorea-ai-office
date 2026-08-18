/* 샘플 산출물 — 3대 수출시장 비교표 (Excel)
   표는 "선이 많은 표"가 아니라 "읽히는 표"여야 한다.
   세로 괘선을 지우고, 헤더만 눌러주고, 숫자는 오른쪽 정렬 + 서식으로 정리한다. */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { C, F } = require('./brand');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const wb = new ExcelJS.Workbook();
wb.creator = '아우라코리아 · 강태오';
wb.created = new Date();

const argb = hex => 'FF' + hex;
const fill = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const thin = hex => ({ style: 'thin', color: { argb: argb(hex) } });

/* ── 시트 1: 시장 비교 ──────────────────────────────────────────── */
const ws = wb.addWorksheet('시장 비교', {
  views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
  pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
});

ws.columns = [
  { key: 'pad',    width: 2.4 },
  { key: 'region', width: 18 },
  { key: 'share',  width: 14 },
  { key: 'growth', width: 14 },
  { key: 'lead',   width: 14 },
  { key: 'reg',    width: 30 },
  { key: 'move',   width: 38 },
];

// 제목 블록 — 시트 맨 위 두 줄은 늘 비워두고 제목을 앉힌다 (표가 벽에 붙으면 답답하다)
ws.mergeCells('B2:G2');
ws.getCell('B2').value = '3대 수출시장 비교';
ws.getCell('B2').font = { name: F.head, size: 18, bold: true, color: { argb: argb(C.ink) } };
ws.getRow(2).height = 30;

ws.mergeCells('B3:G3');
ws.getCell('B3').value = '시장조사 담당 3인 웹 검색 리서치 기준 · 2026.08.18';
ws.getCell('B3').font = { name: F.body, size: 9, color: { argb: argb(C.muted) } };
ws.getRow(4).height = 8;

// 헤더
const HEAD = ['지역', '한국 점유율', '성장률', '등록 리드타임', '규제 핵심', '지금 해야 할 것'];
const hr = ws.getRow(5);
HEAD.forEach((t, i) => {
  const c = hr.getCell(i + 2);
  c.value = t;
  c.font = { name: F.body, size: 10, bold: true, color: { argb: argb(C.white) } };
  c.fill = fill(C.deep);
  c.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'left' : (i === 0 ? 'left' : 'center') };
});
hr.height = 26;

const ROWS = [
  ['스페인 · EU',  0.217, null,  '수 주 (CPNP)', 'INCI 사전(7월) · PPWR(8.12)', '라벨·포장 재작업 착수, 기존 재고 소진 계획'],
  ['GCC · 중동',   null,  0.045, '4~8주 (UAE)',  '등록 의무 · 할랄은 선택',      '사우디·UAE 두 나라에 자원 집중'],
  ['아르헨티나',   0.012, 0.90,  'ANMAT 사전등록', '광고 규제 제4059/2025호',     '선점 투자 착수, 효능 카피 사전 검수'],
];

ROWS.forEach((r, i) => {
  const row = ws.getRow(6 + i);
  r.forEach((v, j) => {
    const c = row.getCell(j + 2);
    c.value = v == null ? '—' : v;
    c.font = { name: j === 0 ? F.body : F.body, size: 10, bold: j === 0, color: { argb: argb(v == null ? C.muted : C.ink) } };
    c.alignment = { vertical: 'middle', horizontal: j >= 4 ? 'left' : (j === 0 ? 'left' : 'center'), wrapText: j >= 4 };
    // 가로 괘선만 남긴다 — 세로선을 지우면 표가 훨씬 조용해진다
    c.border = { bottom: thin(C.line) };
    if (i % 2 === 1) c.fill = fill('FBFAF7');
  });
  row.getCell(3).numFmt = '0.0%';
  row.getCell(4).numFmt = '0.0%';
  row.height = 34;
});

// 점유율 열에 데이터 막대 — 숫자만 보면 크기 차이가 안 잡힌다
// 눈금은 0~100%로 고정한다. min/max 로 두면 값이 둘뿐일 때 큰 쪽이 칸을 꽉 채워
// "100%"처럼 보인다 — 막대가 사실을 왜곡하면 안 쓰느니만 못하다.
const bar = (hex) => ({
  type: 'dataBar', gradient: false, color: { argb: argb(hex) },
  cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],  // cfvo 를 빼면 exceljs 가 파일을 깨뜨린다
  minLength: 0, maxLength: 100, showValue: true,
});
ws.addConditionalFormatting({ ref: 'C6:C8', rules: [bar(C.mint)] });
ws.addConditionalFormatting({ ref: 'D6:D8', rules: [bar(C.gold)] });

// 각주
ws.mergeCells('B10:G10');
ws.getCell('B10').value = '— 값이 없는 칸(—)은 공개 자료에서 동일 기준 수치를 확인하지 못한 항목입니다. 추정치를 넣지 않았습니다.';
ws.getCell('B10').font = { name: F.body, size: 8, color: { argb: argb(C.muted) }, italic: true };

/* ── 시트 2: 규제 캘린더 ────────────────────────────────────────── */
const cal = wb.addWorksheet('규제 캘린더', {
  views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
  // 인쇄 설정을 빼면 표가 두 장으로 잘려 나온다 — 시트마다 반드시 지정한다
  pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
});
cal.columns = [
  { key: 'pad', width: 2.4 }, { key: 'd', width: 16 }, { key: 'm', width: 16 },
  { key: 'w', width: 52 }, { key: 'a', width: 34 },
];
cal.mergeCells('B2:E2');
cal.getCell('B2').value = '규제 캘린더';
cal.getCell('B2').font = { name: F.head, size: 18, bold: true, color: { argb: argb(C.ink) } };
cal.getRow(2).height = 30;
cal.mergeCells('B3:E3');
cal.getCell('B3').value = '시행일이 지나면 되돌릴 수 없는 항목만 모았습니다';
cal.getCell('B3').font = { name: F.body, size: 9, color: { argb: argb(C.muted) } };

const ch = cal.getRow(5);
['시행일', '시장', '내용', '우리가 할 일'].forEach((t, i) => {
  const c = ch.getCell(i + 2);
  c.value = t;
  c.font = { name: F.body, size: 10, bold: true, color: { argb: argb(C.white) } };
  c.fill = fill(C.deep);
  c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : 'left' };
});
ch.height = 26;

const CAL = [
  [new Date(2026, 6, 1),  '스페인 · EU', 'INCI 성분 사전 강제 적용 · 향료 알레르겐 82종 표기 확대', '라벨 전면 재작업 / 원료 대체 검토'],
  [new Date(2026, 7, 12), '스페인 · EU', 'PPWR 시행 — PFAS·중금속 제한, 포장 추적성 의무',        '포장 사양 교체 · 재고 소진 계획'],
  [new Date(2025, 5, 1),  '아르헨티나',  'ANMAT 제4059/2025호 — 화장품 광고 규제 체계 도입',        '효능 표현 카피 사전 검수'],
];
CAL.forEach((r, i) => {
  const row = cal.getRow(6 + i);
  r.forEach((v, j) => {
    const c = row.getCell(j + 2);
    c.value = v;
    c.font = { name: F.body, size: 10, color: { argb: argb(C.ink) } };
    c.alignment = { vertical: 'middle', horizontal: j === 0 ? 'center' : 'left', wrapText: j >= 2 };
    c.border = { bottom: thin(C.line) };
  });
  row.getCell(2).numFmt = 'yyyy". "mm". "dd';
  row.getCell(2).font = { name: F.num, size: 10, bold: true, color: { argb: argb(C.deep) } };
  row.height = 32;
});
// 이미 지난 시행일은 눌러서 표시 — 남은 것에 눈이 가야 한다
cal.addConditionalFormatting({
  ref: 'B6:E8',
  rules: [{
    type: 'expression', formulae: ['$B6<TODAY()'], priority: 1,
    style: { font: { color: { argb: argb(C.muted) } } },
  }],
});

const file = path.join(OUT, '3대-수출시장-비교표.xlsx');
wb.xlsx.writeFile(file).then(() => console.log(file));

/* PDF -> 페이지별 PNG. Word·Excel 산출물을 눈으로 검수하기 위한 마지막 단계다.
   사용: node pdf2png.js <pdf경로> [배율(기본 2)] */
const fs = require('fs');
const path = require('path');

(async () => {
  const { pdf } = await import('pdf-to-img');
  const src = process.argv[2];
  const scale = Number(process.argv[3] || 2);
  if (!src) { console.error('사용법: node pdf2png.js <pdf경로> [배율]'); process.exit(1); }

  const dir = path.dirname(src);
  const base = path.basename(src, '.pdf');
  const doc = await pdf(src, { scale });

  let i = 1;
  for await (const page of doc) {
    const out = path.join(dir, `${base}-${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(out, page);
    console.log(out);
    i++;
  }
})();

/* 이미지 여백 잘라내기 — PDF 를 이미지로 뽑으면 아래쪽이 텅 빈 채로 나온다.
 * 그대로 쓰면 미리보기 칸만 길어지고 볼 게 없다. 내용이 끝나는 지점에서 자른다.
 * 사용: node tools/crop.js <이미지> [여백px]
 */
const fs = require('fs');
const path = require('path');

(async () => {
  const { createCanvas, loadImage } = require(
    path.join(__dirname, 'docgen/node_modules/@napi-rs/canvas'));

  const file = process.argv[2];
  const pad = Number(process.argv[3] || 24);
  if (!file) { console.error('사용법: node tools/crop.js <이미지> [여백px]'); process.exit(1); }

  const img = await loadImage(fs.readFileSync(file));
  const probe = createCanvas(img.width, img.height);
  const pctx = probe.getContext('2d');
  pctx.drawImage(img, 0, 0);
  const data = pctx.getImageData(0, 0, img.width, img.height).data;

  // 아래에서 위로 올라오며 "흰색이 아닌 픽셀"이 처음 나오는 줄을 찾는다
  let lastRow = 0;
  outer:
  for (let y = img.height - 1; y >= 0; y--) {
    for (let x = 0; x < img.width; x += 3) {          // 3픽셀 간격이면 충분히 정확하고 훨씬 빠르다
      const i = (y * img.width + x) * 4;
      if (data[i] < 246 || data[i+1] < 246 || data[i+2] < 246) { lastRow = y; break outer; }
    }
  }

  const h = Math.min(img.height, lastRow + pad);
  if (h >= img.height - 2) { console.log('자를 여백이 없습니다: ' + file); return; }

  const out = createCanvas(img.width, h);
  out.getContext('2d').drawImage(img, 0, 0);
  fs.writeFileSync(file, out.toBuffer('image/png'));
  console.log(`${path.basename(file)} — ${img.height} → ${h}px 로 잘랐습니다`);
})().catch(e => { console.error(e); process.exit(1); });

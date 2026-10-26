import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fill(png, paint) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const color = paint(x, y);
      const index = (png.width * y + x) << 2;
      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = color[3];
    }
  }
}

const og = new PNG({ width: 1200, height: 630 });
fill(og, (x, y) => {
  const card = x > 80 && x < 1120 && y > 70 && y < 560;
  if (!card) return [11, 110, 91, 255];
  const checker = x > 700 && x < 1040 && y > 150 && y < 480;
  if (checker) {
    const dark = Math.floor(x / 24) % 2 === Math.floor(y / 24) % 2;
    return dark ? [215, 227, 222, 255] : [255, 255, 255, 255];
  }
  return [255, 255, 255, 255];
});
const ogPath = join(root, 'public/og.png');
writeFileSync(ogPath, PNG.sync.write(og));

mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
const square = new PNG({ width: 64, height: 64 });
fill(square, () => [220, 40, 40, 255]);
writeFileSync(join(root, 'tests/fixtures/red-square.png'), PNG.sync.write(square));
console.log('Wrote public/og.png and tests/fixtures/red-square.png');

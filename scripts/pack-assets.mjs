// fps/assets 안의 .glb 파일을 모두 base64로 묶어 fps/js/assets-data.js를 만들어요.
// 파일로 연 게임(더블클릭)은 옆 파일을 읽을 수 없어서, 모델을 이렇게 스크립트 안에 넣어요.
// 사용법: npm run assets:pack  (직접 구한 GLB로 바꾼 뒤에도 이것만 실행하면 돼요)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'fps', 'assets');

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d).sort()) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.toLowerCase().endsWith('.glb')) files.push(p);
  }
};
walk(dir);

let body = '';
let total = 0;
for (const f of files) {
  const key = relative(dir, f).split(sep).join('/').replace(/\.glb$/i, '');
  const b64 = readFileSync(f).toString('base64');
  total += b64.length;
  body += '    ' + JSON.stringify(key) + ':\n      ' + JSON.stringify(b64) + ',\n';
}

const out = `/* SECTOR ZERO — 3D 모델 묶음 (자동으로 만든 파일: npm run assets:pack). 직접 고치지 마세요.
   원본 GLB 파일: fps/assets/ (Blender 같은 3D 프로그램에서 열 수 있어요) */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});
  SZ.ASSET_DATA = {
${body}  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(root, 'fps', 'js', 'assets-data.js'), out);
console.log('묶었어요: ' + files.length + '개 모델, ' + Math.round(total / 1024) + ' KB → fps/js/assets-data.js');

// 총·손·탄피·적 로봇 3D 모델을 코드로 만들어 GLB 파일로 저장해요.
// 사용법: npm run assets  (fps/assets/*.glb를 새로 만들고 fps/js/assets-data.js로 묶어요)
// 주의: 직접 구한 GLB로 바꿨다면 이 명령 대신 npm run assets:pack만 쓰세요 (덮어써요).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGLB } from './assets/glb.mjs';
import { toScene } from './assets/kit.mjs';
import * as guns from './assets/guns.mjs';
import * as robots from './assets/robots.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fps', 'assets');

const MODELS = {
  'guns/pistol': guns.pistol,
  'guns/rifle': guns.rifle,
  'guns/shotgun': guns.shotgun,
  'guns/hands': guns.hands,
  'props/casings': guns.casings,
  'robots/drone': robots.drone,
  'robots/runner': robots.runner,
  'robots/brute': robots.brute,
  'robots/bomber': robots.bomber,
};

let total = 0;
for (const [key, make] of Object.entries(MODELS)) {
  const part = make();
  const glb = writeGLB(toScene([part]));
  const file = join(root, key + '.glb');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, glb);
  total += glb.byteLength;
  console.log(key.padEnd(16), String(part.tris()).padStart(6), '삼각형', String(Math.round(glb.byteLength / 1024)).padStart(5), 'KB');
}
console.log('합계', Math.round(total / 1024), 'KB');

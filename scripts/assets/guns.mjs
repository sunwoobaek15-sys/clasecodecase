// 총·손·탄피 모델
// 좌표는 게임 손에 든 총 좌표 그대로예요 (x 오른쪽, y 위, -z 앞, 원점은 방아쇠 근처).
// 따로 움직이는 부품 이름: slide(권총), bolt(소총 장전 손잡이), pump(산탄총), magazine(탄창).
// 빈 노드 muzzle(총구), eject(탄피 나오는 곳)는 자리 표시예요.
import { box, cylinder, lathe, sphere, extrude, rect } from './geom.mjs';
import { Part, C } from './kit.mjs';

const B = (sx, sy, sz, col, bevel = 0) => box(sx, sy, sz, col, bevel);
/** 옆모습 [z, y]를 x 방향 두께 ±hw로 */
const side = (poly, hw, col, bevel = 0) => extrude(poly, -hw, hw, 'x', col, bevel);
/** 옆모습을 x0 ~ x1 사이에만 (옆면에 붙이는 얇은 판) */
const sideAt = (poly, x0, x1, col, bevel = 0) => extrude(poly, x0, x1, 'x', col, bevel);
const both = (fn) => [fn(-1), fn(1)];

/** 방아쇠울: 앞(zf)에서 뒤(zb)까지, 위 y0에서 깊이 d, 두께 th */
function guard(zf, zb, y0, d, th = 0.0055) {
  const yb = y0 - d;
  return [
    [zf, y0], [zf + 0.001, yb + 0.012], [zf + 0.009, yb + 0.001], [zb - 0.012, yb], [zb, yb + 0.008],
    [zb - th * 0.6, yb + 0.008 + th], [zb - 0.014, yb + th], [zf + 0.012, yb + th + 0.001], [zf + th + 0.002, yb + 0.013], [zf + th, y0],
  ];
}
/** 방아쇠 (휘어진 판) */
function trigger(z, y0, len = 0.022) {
  return [[z, y0], [z + 0.002, y0 - len * 0.45], [z - 0.002, y0 - len], [z - 0.007, y0 - len + 0.002], [z - 0.005, y0 - len * 0.45], [z - 0.006, y0]];
}

/* ---------------- 권총 P-9 ---------------- */
export function pistol() {
  const root = new Part('pistol');
  const frame = root.child(new Part('frame'));
  const slide = root.child(new Part('slide'));
  const mag = root.child(new Part('magazine', [0, -0.075, 0.009], [-0.22, 0, 0]));
  root.child(new Part('muzzle', [0, 0.035, -0.27]));
  root.child(new Part('eject', [0.026, 0.05, -0.1]));

  // 슬라이드: 앞쪽이 비스듬히 깎인 몸통, 뒤·앞 미끄럼 홈, 탄피 구멍, 야광 가늠쇠
  slide.add('metal', side([[0.012, 0.012], [0.012, 0.053], [0.004, 0.06], [-0.205, 0.06], [-0.232, 0.051], [-0.245, 0.038], [-0.245, 0.012]], 0.0145, C.gunmetal, 0.0025));
  for (let i = 0; i < 7; i++) slide.add('metal', both((s) => B(0.0012, 0.032, 0.0022, C.hole).at([s * 0.0145, 0.037, 0.006 - i * 0.0052])));
  for (let i = 0; i < 4; i++) slide.add('metal', both((s) => B(0.0012, 0.03, 0.0022, C.hole).at([s * 0.0145, 0.036, -0.17 - i * 0.0052])));
  slide.add('metal', B(0.0012, 0.017, 0.046, C.hole).at([0.0145, 0.047, -0.098]), B(0.017, 0.0012, 0.046, C.hole).at([0.0055, 0.0602, -0.098]));
  slide.add('metal', B(0.0055, 0.008, 0.007, C.black, 0.001).at([0, 0.064, -0.226]));
  slide.add('metal', both((s) => B(0.0055, 0.009, 0.008, C.black, 0.001).at([s * 0.0075, 0.0645, 0.004])));
  slide.add('glow_green', B(0.0032, 0.0032, 0.0012, C.white).at([0, 0.0655, -0.2224]), both((s) => B(0.0026, 0.0026, 0.0012, C.white).at([s * 0.0075, 0.0655, 0.0083])));
  slide.add('metal', cylinder('z', 0.0078, 0.0078, -0.245, -0.2476, 14, C.steelDark).at([0, 0.035, 0]), cylinder('z', 0.0042, 0.0042, -0.2476, -0.2478, 10, C.hole).at([0, 0.035, 0]));
  slide.add('metal', both((s) => B(0.0008, 0.0045, 0.022, C.amber).at([s * 0.0147, 0.05, -0.19])));
  slide.add('glow_cyan', both((s) => B(0.0008, 0.0018, 0.1, C.white).at([s * 0.0147, 0.017, -0.13])));

  // 프레임: 레일, 방아쇠울, 손가락 홈이 있는 손잡이(아래가 뒤로 기울어요)
  const FRAME = [
    [0.009, 0.012], [-0.214, 0.012], [-0.214, -0.004], [-0.11, -0.004], [-0.1, -0.007], [-0.03, -0.007],
    [-0.024, -0.035], [-0.027, -0.046], [-0.018, -0.068], [-0.021, -0.079], [-0.012, -0.1], [-0.014, -0.111], [0.0, -0.135],
    [0.04, -0.128], [0.023, -0.022], [0.033, -0.006], [0.03, 0.004], [0.016, 0.012],
  ];
  frame.add('polymer', side(FRAME, 0.0135, C.polymer, 0.002));
  frame.add('polymer', both((s) => sideAt([[-0.019, -0.03], [-0.007, -0.118], [0.027, -0.112], [0.017, -0.03]], s * 0.0135, s * 0.0143, C.polymerDark)));
  for (const z of [-0.165, -0.18, -0.195]) frame.add('polymer', B(0.026, 0.003, 0.004, C.hole).at([0, -0.0045, z]));
  frame.add('polymer', side(guard(-0.1, -0.026, -0.007, 0.036), 0.006, C.polymer, 0.0008));
  frame.add('metal', side(trigger(-0.058, -0.007), 0.003, C.black));
  frame.add('metal', B(0.002, 0.004, 0.022, C.black, 0.0005).at([-0.0143, 0.006, -0.065]), both((s) => B(0.002, 0.003, 0.008, C.black).at([s * 0.0143, 0.0, -0.11])));
  frame.add('metal', B(0.003, 0.007, 0.008, C.black).at([-0.0135, -0.012, -0.022]));
  frame.add('metal', both((s) => B(0.0008, 0.006, 0.006, C.amber).at([s * 0.0144, -0.05, 0.016])));

  // 탄창 (탄창 축 = 자기 y). 손잡이 속에 들어가고 바닥판과 맨 위 탄만 보여요
  mag.add('metal', B(0.021, 0.12, 0.031, C.black, 0.0015), cylinder('z', 0.0046, 0.0046, 0.012, -0.008, 10, C.brass).at([0, 0.0635, 0]));
  mag.add('metal', cylinder('z', 0.0046, 0.0012, -0.008, -0.0155, 10, C.copper).at([0, 0.0635, 0]));
  mag.add('polymer', B(0.029, 0.011, 0.044, C.polymer, 0.002).at([0, -0.0645, 0.003]));
  return root;
}

/* ---------------- 돌격소총 AR-7 ---------------- */
export function rifle() {
  const root = new Part('rifle');
  const body = root.child(new Part('body'));
  const bolt = root.child(new Part('bolt', [0.03, 0.014, -0.06]));
  const mag = root.child(new Part('magazine', [0, -0.112, -0.2], [0.12, 0, 0]));
  root.child(new Part('muzzle', [0, 0.01, -0.73]));
  root.child(new Part('eject', [0.034, 0.02, -0.12]));

  // 총몸 + 둥근 덮개 + 위 레일
  body.add('metal', side([[0.035, 0.028], [0.035, -0.028], [-0.04, -0.028], [-0.046, -0.036], [-0.27, -0.036], [-0.29, -0.026], [-0.29, 0.028]], 0.021, C.gunmetal, 0.002));
  body.add('metal', extrude([[-0.021, 0.026], [0.021, 0.026], [0.021, 0.036], [0.015, 0.045], [0, 0.048], [-0.015, 0.045], [-0.021, 0.036]], -0.27, 0.032, 'z', C.gunmetal, 0.002));
  body.add('metal', B(0.02, 0.006, 0.165, C.black, 0.001).at([0, 0.051, -0.1825]));
  for (let i = 0; i < 9; i++) body.add('metal', B(0.023, 0.004, 0.008, C.black, 0.0008).at([0, 0.0555, -0.11 - i * 0.019]));
  body.add('metal', B(0.05, 0.022, 0.082, C.gunmetal, 0.002).at([0, -0.045, -0.2]));
  body.add('metal', B(0.0014, 0.02, 0.075, C.hole).at([0.0212, 0.012, -0.12]), B(0.0014, 0.005, 0.11, C.hole).at([0.0212, 0.014, -0.03]));
  body.add('metal', B(0.0016, 0.008, 0.085, C.steelDark, 0.0005).at([0.0218, -0.012, -0.065]), B(0.003, 0.012, 0.012, C.steelDark).at([0.0222, -0.004, -0.022]));
  for (const z of [-0.17, -0.24, -0.26]) body.add('metal', both((s) => cylinder('x', 0.0022, 0.0022, s * 0.0205, s * 0.0224, 6, C.steel).at([0, -0.025, z])));
  body.add('metal', both((s) => B(0.0008, 0.004, 0.05, C.amber).at([s * 0.0213, -0.022, -0.235])));

  // 개머리판 (올리브 폴리머) + 고무 패드
  body.add('polymer', side([[0.035, 0.028], [0.27, 0.006], [0.282, 0.004], [0.282, -0.088], [0.27, -0.092], [0.15, -0.062], [0.09, -0.05], [0.035, -0.03]], 0.018, C.olive, 0.003));
  body.add('polymer', both((s) => sideAt([[0.07, 0.012], [0.22, 0.0], [0.22, -0.05], [0.12, -0.04], [0.07, -0.02]], s * 0.018, s * 0.0188, C.oliveDark)));
  body.add('polymer', extrude(rect(-0.019, -0.093, 0.019, 0.006, 0.004), 0.282, 0.298, 'z', C.black, 0.002));

  // 손잡이, 방아쇠
  body.add('polymer', side([[-0.062, -0.035], [-0.022, -0.035], [-0.008, -0.128], [-0.045, -0.132], [-0.05, -0.105], [-0.046, -0.095], [-0.053, -0.08], [-0.05, -0.068], [-0.058, -0.052]], 0.015, C.polymer, 0.003));
  body.add('polymer', both((s) => sideAt([[-0.048, -0.05], [-0.026, -0.05], [-0.016, -0.115], [-0.04, -0.118]], s * 0.015, s * 0.0156, C.polymerDark)));
  body.add('polymer', side(guard(-0.105, -0.058, -0.036, 0.03), 0.006, C.polymer, 0.0008));
  body.add('metal', side(trigger(-0.08, -0.036), 0.003, C.black), B(0.016, 0.01, 0.006, C.black).at([0, -0.05, -0.153]));

  // 총열 덮개 + 숨구멍 + 청록 빛줄
  body.add('polymer', extrude([[-0.026, -0.026], [-0.018, -0.036], [0.018, -0.036], [0.026, -0.026], [0.026, 0.026], [0.016, 0.036], [-0.016, 0.036], [-0.026, 0.026]], -0.505, -0.29, 'z', C.olive, 0.004));
  body.add('polymer', both((s) => B(0.0012, 0.003, 0.2, C.oliveDark).at([s * 0.026, 0.006, -0.398])));
  for (let i = 0; i < 3; i++) body.add('polymer', both((s) => B(0.0012, 0.009, 0.026, C.hole).at([s * 0.026, -0.014, -0.33 - i * 0.045])));
  body.add('glow_cyan', both((s) => B(0.0012, 0.003, 0.11, C.white).at([s * 0.0262, 0.0175, -0.4])));

  // 가스 블록, 총열, 가늠쇠, 소염기
  body.add('metal', B(0.03, 0.04, 0.032, C.steelDark, 0.003).at([0, 0.016, -0.522]));
  body.add('metal', cylinder('z', 0.0088, 0.0082, -0.29, -0.665, 14, C.steelDark).at([0, 0.01, 0]));
  body.add('metal', B(0.022, 0.012, 0.02, C.black, 0.002).at([0, 0.022, -0.6]), B(0.003, 0.024, 0.003, C.black).at([0, 0.04, -0.6]), both((s) => B(0.003, 0.026, 0.012, C.black).at([s * 0.009, 0.038, -0.6])));
  body.add('metal', lathe('z', [[0, -0.727], [0.0085, -0.727], [0.0135, -0.723], [0.0135, -0.668], [0.0095, -0.663]], 14, C.steelDark).at([0, 0.01, 0]));
  body.add('metal', cylinder('z', 0.0045, 0.0045, -0.7272, -0.7274, 8, C.hole).at([0, 0.01, 0]));
  for (const z of [-0.68, -0.695, -0.71]) body.add('metal', both((s) => B(0.0014, 0.012, 0.007, C.hole).at([s * 0.0135, 0.01, z])), B(0.006, 0.0014, 0.007, C.hole).at([0, 0.0235, z]));

  // 빨간 점 조준기 (점의 높이 0.082 = 정조준 눈높이)
  body.add('metal', B(0.03, 0.008, 0.052, C.black, 0.0015).at([0, 0.062, -0.185]));
  body.add('polymer', both((s) => B(0.0055, 0.036, 0.05, C.polymerDark, 0.0015).at([s * 0.0148, 0.083, -0.185])), B(0.035, 0.006, 0.052, C.polymerDark, 0.0015).at([0, 0.103, -0.185]));
  body.add('metal', cylinder('x', 0.007, 0.007, 0.017, 0.025, 10, C.black).at([0, 0.08, -0.19]));
  body.add('glow_red', B(0.0022, 0.0022, 0.0008, C.white).at([0, 0.082, -0.165]));

  // 장전 손잡이 (뒤로 당겨져요)
  bolt.add('metal', B(0.012, 0.007, 0.009, C.steel, 0.001), cylinder('x', 0.0065, 0.0065, 0.005, 0.016, 10, C.chrome));

  // 바나나 탄창: 아래로 갈수록 앞으로 휘어요
  const spine = (y) => -1.6 * Math.max(0, 0.04 - y) ** 2;
  const ys = [0.075, 0.04, 0.01, -0.02, -0.05, -0.085];
  const MAG = [...ys.map((y) => [spine(y) - 0.019, y]), ...ys.slice().reverse().map((y) => [spine(y) + 0.019, y])];
  mag.add('metal', side(MAG, 0.0115, [0.15, 0.13, 0.11], 0.0018));
  for (const y of [-0.01, -0.045]) mag.add('metal', B(0.0245, 0.004, 0.04, [0.12, 0.105, 0.09], 0.001).at([0, y, spine(y)]));
  mag.add('metal', B(0.027, 0.009, 0.044, C.black, 0.002).at([0, -0.09, spine(-0.085)]));
  mag.add('metal', cylinder('z', 0.0048, 0.0048, 0.012, -0.012, 10, C.brass).at([0, 0.08, -0.002]), cylinder('z', 0.0048, 0.0012, -0.012, -0.022, 10, C.copper).at([0, 0.08, -0.002]));
  return root;
}

/* ---------------- 산탄총 SG-12 ---------------- */
export function shotgun() {
  const root = new Part('shotgun');
  const body = root.child(new Part('body'));
  const pump = root.child(new Part('pump', [0, -0.013, -0.42]));
  root.child(new Part('muzzle', [0, 0.02, -0.725]));
  root.child(new Part('eject', [0.036, 0.02, -0.1]));

  // 총몸 + 탄피 구멍 + 아래 장전 구멍 + 왼쪽 예비탄 4발
  body.add('metal', side([[0.03, 0.03], [0.03, -0.03], [0.002, -0.042], [-0.168, -0.042], [-0.18, -0.03], [-0.18, 0.028], [-0.165, 0.04], [0.0, 0.042], [0.022, 0.038]], 0.023, [0.12, 0.12, 0.13], 0.002));
  body.add('metal', B(0.0014, 0.026, 0.07, C.hole).at([0.0232, 0.014, -0.1]), B(0.03, 0.0014, 0.07, C.hole).at([0, -0.0425, -0.16]));
  body.add('metal', B(0.004, 0.032, 0.095, C.black, 0.001).at([-0.0252, 0.005, -0.085]));
  for (let i = 0; i < 4; i++) {
    const z = -0.05 - i * 0.023;
    body.add('polymer', cylinder('y', 0.0102, 0.0102, -0.022, 0.03, 10, C.shellRed).at([-0.0375, 0, z]));
    body.add('metal', cylinder('y', 0.0106, 0.0106, -0.03, -0.022, 10, C.brass).at([-0.0375, 0, z]));
  }
  body.add('metal', both((s) => B(0.0008, 0.004, 0.06, C.amber).at([s * 0.0233, -0.03, -0.09])));

  // 총열 + 위 띠 + 구슬 가늠쇠, 탄창 관, 고정쇠
  body.add('metal', cylinder('z', 0.0125, 0.0125, -0.18, -0.72, 16, C.steelDark).at([0, 0.02, 0]));
  body.add('metal', cylinder('z', 0.0135, 0.0135, -0.712, -0.722, 16, C.black).at([0, 0.02, 0]), cylinder('z', 0.0085, 0.0085, -0.7222, -0.7224, 12, C.hole).at([0, 0.02, 0]));
  body.add('metal', B(0.006, 0.004, 0.5, C.black).at([0, 0.0345, -0.45]));
  body.add('glow_amber', sphere(0.0032, 8, 6, C.white).at([0, 0.04, -0.705]));
  body.add('metal', cylinder('z', 0.0112, 0.0112, -0.18, -0.655, 14, C.steelDark).at([0, -0.013, 0]));
  body.add('metal', lathe('z', [[0, -0.67], [0.009, -0.67], [0.0118, -0.665], [0.0118, -0.655]], 14, C.black).at([0, -0.013, 0]));
  body.add('metal', B(0.03, 0.062, 0.018, C.black, 0.004).at([0, 0.004, -0.62]));

  // 나무 개머리판 + 고무 패드, 방아쇠
  body.add('wood', side([[0.03, 0.03], [0.235, 0.008], [0.25, 0.006], [0.25, -0.098], [0.235, -0.098], [0.12, -0.058], [0.075, -0.068], [0.045, -0.085], [0.028, -0.08], [0.022, -0.055], [0.03, -0.03]], 0.02, C.wood, 0.004));
  body.add('wood', both((s) => sideAt([[0.1, -0.012], [0.225, -0.006], [0.225, -0.014], [0.1, -0.019]], s * 0.02, s * 0.0207, C.woodDark)));
  body.add('polymer', extrude(rect(-0.0205, -0.099, 0.0205, 0.007, 0.005), 0.25, 0.266, 'z', C.black, 0.002));
  body.add('metal', side(guard(-0.06, -0.006, -0.042, 0.03), 0.006, C.black, 0.0008), side(trigger(-0.03, -0.042), 0.003, C.steel));

  // 펌프: 홈이 7줄 파인 나무 손잡이 (탄창 관 둘레)
  const P = [[0.012, -0.085], [0.022, -0.083]];
  for (let g = 0; g < 7; g++) {
    const w = -0.066 + g * 0.022;
    P.push([0.023, w - 0.005], [0.0198, w - 0.002], [0.0198, w + 0.002], [0.023, w + 0.005]);
  }
  P.push([0.022, 0.083], [0.012, 0.085]);
  pump.add('wood', lathe('z', P, 16, C.wood));
  return root;
}

/* ---------------- 손과 팔 ---------------- */
/** 팔: 장갑 손목 → 소매 끝단 → 소매(주황 줄). 손목에서 +z로 뻗어요 */
function forearm(part) {
  part.add('cloth', cylinder('z', 0.03, 0.033, 0, 0.055, 12, C.glove));
  part.add('cloth', cylinder('z', 0.044, 0.046, 0.05, 0.075, 12, C.sleeveDark));
  part.add('cloth', cylinder('z', 0.042, 0.05, 0.07, 0.34, 12, C.sleeve));
  part.add('polymer', cylinder('z', 0.0458, 0.0462, 0.135, 0.148, 12, C.amber, { caps: false }));
  return part;
}

export function hands() {
  const root = new Part('hands');
  // 오른손: 손잡이를 감싸 쥔 모양. 원점 = 손잡이 가운데, +y = 손잡이 위, -z = 앞
  const R = root.child(new Part('hand_r'));
  R.add('cloth', B(0.03, 0.082, 0.07, C.glove, 0.008).at([0.03, -0.004, 0.006]));
  R.add('polymer', B(0.007, 0.052, 0.05, C.glovePad, 0.003).at([0.047, 0.004, 0.0]));
  for (const y of [0.03, 0.01, -0.011, -0.032]) {
    R.add('cloth', B(0.04, 0.0175, 0.018, C.glove, 0.005).at([0.011, y, -0.033]));
    R.add('cloth', B(0.017, 0.0165, 0.032, C.glove, 0.005).at([-0.017, y, -0.017]));
  }
  R.add('polymer', B(0.006, 0.075, 0.012, C.glovePad, 0.002).at([0.031, -0.001, -0.043]));
  R.add('cloth', B(0.017, 0.017, 0.048, C.glove, 0.005).at([-0.016, 0.044, 0.0], [0.45, 0, 0]));
  const ra = R.child(new Part('arm_r', [0.026, -0.03, 0.04], [0.62, 0.12, 0]));
  forearm(ra);

  // 왼손: 손바닥이 위를 보며 받쳐 든 모양. 원점 = 손 자리, 손가락은 오른쪽(+x)으로 감아요
  const L = root.child(new Part('hand_l'));
  L.add('cloth', B(0.058, 0.022, 0.085, C.glove, 0.008));
  L.add('polymer', B(0.044, 0.006, 0.05, C.glovePad, 0.002).at([0, -0.013, 0.004]));
  for (const z of [-0.03, -0.01, 0.01, 0.03]) {
    L.add('cloth', B(0.016, 0.042, 0.017, C.glove, 0.005).at([0.031, 0.022, z]));
    L.add('cloth', B(0.015, 0.016, 0.017, C.glove, 0.005).at([0.022, 0.046, z]));
  }
  L.add('cloth', B(0.017, 0.036, 0.02, C.glove, 0.005).at([-0.031, 0.018, -0.012], [0, 0, -0.2]));
  const la = L.child(new Part('arm_l', [-0.008, -0.006, 0.04], [0.7, -0.45, 0]));
  forearm(la);
  return root;
}

/* ---------------- 탄피 ---------------- */
export function casings() {
  const root = new Part('casings');
  root.child(new Part('casing_9mm')).add('metal', cylinder('z', 0.0049, 0.0049, -0.0095, 0.0085, 10, C.brass), cylinder('z', 0.0052, 0.0052, 0.0085, 0.0098, 10, C.brass));
  root.child(new Part('casing_556')).add('metal', lathe('z', [[0, -0.022], [0.003, -0.022], [0.003, -0.016], [0.0046, -0.012], [0.0048, 0.019], [0.004, 0.0205], [0.0049, 0.021], [0.0049, 0.0225], [0, 0.0225]], 10, C.brass));
  const sh = root.child(new Part('shell_12g'));
  sh.add('polymer', cylinder('z', 0.0105, 0.0105, -0.035, 0.018, 12, C.shellRed));
  sh.add('metal', cylinder('z', 0.011, 0.011, 0.018, 0.029, 12, C.brass), cylinder('z', 0.0118, 0.0118, 0.029, 0.031, 12, C.brass));
  return root;
}

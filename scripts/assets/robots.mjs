// 적 로봇 모델: 관절마다 이름 있는 노드(원점 = 관절)라서 게임이 코드로 움직여요.
// 원점은 발밑(드론은 떠 있는 몸 가운데), -z가 앞. 크기는 rules.js 히트박스에 맞췄어요.
import { box, cylinder, lathe, sphere, extrude, circle } from './geom.mjs';
import { Part, C } from './kit.mjs';

const B = (sx, sy, sz, col, bevel = 0) => box(sx, sy, sz, col, bevel);
const SIDES = [['l', -1], ['r', 1]];

/* ---------------- 감시 드론 (떠 있는 원반) ---------------- */
export function drone() {
  const root = new Part('drone');
  const body = root.child(new Part('body'));
  // 각진 원반 몸통 + 가운데 띠
  body.add('metal', lathe('y', [[0, -0.2], [0.16, -0.215], [0.29, -0.17], [0.355, -0.07], [0.372, 0.02], [0.335, 0.12], [0.23, 0.19], [0.1, 0.215], [0, 0.22]], 16, C.droneShell));
  body.add('metal', lathe('y', [[0.372, -0.038], [0.382, -0.032], [0.382, 0.036], [0.372, 0.042]], 16, C.droneDark));
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k + 1) * ((Math.PI * 2) / 7); // 앞(눈 쪽)은 비워요
    body.add('glow_red', B(0.05, 0.009, 0.004, C.white).at([Math.cos(a) * 0.384, 0.0, Math.sin(a) * 0.384], [0, -a + Math.PI / 2, 0]));
  }
  // 위 장갑판(육각) + 경고 줄무늬 + 센서
  body.add('metal', extrude(circle(0.2, 6, 0, 0, Math.PI / 6), 0.2, 0.248, 'y', C.droneDark, 0.012));
  for (const z of [0.0, 0.07]) body.add('polymer', B(0.22, 0.003, 0.032, C.hazard).at([0, 0.2495, z]));
  body.add('metal', sphere(0.045, 10, 6, C.droneDark).at([0, 0.25, 0.1]));
  // 아래 포탑과 총신
  body.add('metal', cylinder('y', 0.075, 0.06, -0.205, -0.255, 12, C.droneDark));
  body.add('metal', cylinder('z', 0.017, 0.014, -0.02, -0.32, 10, C.droneDark).at([0, -0.238, 0]));
  body.add('glow_red', cylinder('z', 0.009, 0.009, -0.3205, -0.323, 8, C.white).at([0, -0.238, 0]));
  // 눈 둘레 (앞쪽 원통) — 빛나는 눈은 eye 노드
  body.add('metal', cylinder('z', 0.128, 0.116, -0.27, -0.375, 18, C.droneDark).at([0, 0.02, 0]));
  body.add('metal', cylinder('z', 0.096, 0.096, -0.375, -0.379, 18, [0.04, 0.04, 0.05]).at([0, 0.02, 0]));
  const eye = body.child(new Part('eye', [0, 0.02, -0.38]));
  eye.add('glow_red', cylinder('z', 0.058, 0.058, 0, -0.003, 18, C.white), cylinder('z', 0.024, 0.024, -0.003, -0.006, 12, [1, 0.8, 0.7]));
  // 양쪽 엔진 (뒤로 주황 불꽃, 아래로 떠오르는 불빛)
  for (const [s, sg] of SIDES) {
    const pod = root.child(new Part('pod_' + s, [sg * 0.44, 0, 0.02]));
    pod.add('metal', lathe('z', [[0, -0.2], [0.05, -0.2], [0.085, -0.15], [0.095, -0.05], [0.09, 0.1], [0.07, 0.19], [0.05, 0.21], [0, 0.21]], 12, C.droneShell));
    pod.add('metal', cylinder('z', 0.047, 0.047, -0.2, -0.204, 12, C.droneDark), B(0.13, 0.045, 0.12, C.droneDark, 0.01).at([-sg * 0.08, 0, 0]));
    pod.add('polymer', B(0.06, 0.003, 0.05, C.hazard).at([0, 0.094, -0.04]));
    pod.add('glow_orange', cylinder('z', 0.042, 0.042, 0.21, 0.214, 12, C.white), cylinder('y', 0.04, 0.04, -0.094, -0.098, 10, C.white));
  }
  const ant = root.child(new Part('antenna', [0.13, 0.205, 0.12]));
  ant.add('metal', cylinder('y', 0.006, 0.004, 0, 0.2, 6, C.droneDark));
  ant.add('glow_red', sphere(0.012, 8, 5, C.white).at([0, 0.205, 0]));
  return root;
}

/* ---------------- 추격자 (날 달린 두 발 로봇, 키 약 1.75m) ---------------- */
export function runner() {
  const root = new Part('runner');
  const hips = root.child(new Part('hips', [0, 0.92, 0]));
  hips.add('metal', extrude([[-0.17, 0.05], [0.17, 0.05], [0.12, -0.07], [-0.12, -0.07]], -0.11, 0.11, 'z', C.runnerDark, 0.012));
  hips.add('metal', B(0.22, 0.09, 0.015, C.runnerArmor, 0.004).at([0, -0.02, -0.118], [0.15, 0, 0]), B(0.2, 0.08, 0.015, C.runnerArmor, 0.004).at([0, -0.02, 0.118], [-0.15, 0, 0]));
  hips.add('metal', sphere(0.055, 10, 6, C.steelDark).at([-0.15, -0.03, 0]), sphere(0.055, 10, 6, C.steelDark).at([0.15, -0.03, 0]));
  hips.add('metal', cylinder('y', 0.035, 0.035, 0.03, 0.12, 8, C.steel));

  // 몸통: 역삼각형 가슴판, 빛나는 V자 틈, 등의 동력 코어
  const torso = hips.child(new Part('torso', [0, 0.1, 0]));
  torso.add('metal', extrude([[-0.13, 0], [0.13, 0], [0.26, 0.3], [0.23, 0.46], [-0.23, 0.46], [-0.26, 0.3]], -0.16, 0.14, 'z', C.runnerArmor, 0.02));
  torso.add('metal', extrude([[-0.1, 0.12], [0.1, 0.12], [0.16, 0.32], [-0.16, 0.32]], -0.17, -0.158, 'z', C.runnerDark, 0.004));
  for (const s of [-1, 1]) torso.add('glow_red', B(0.085, 0.01, 0.004, C.white).at([s * 0.048, 0.24, -0.172], [0, 0, s * 0.42]));
  torso.add('glow_red', B(0.04, 0.008, 0.004, C.white).at([0, 0.17, -0.172]));
  torso.add('metal', cylinder('z', 0.065, 0.065, 0.14, 0.2, 12, C.runnerDark).at([0, 0.28, 0]));
  torso.add('glow_red', cylinder('z', 0.042, 0.042, 0.2, 0.204, 12, C.white).at([0, 0.28, 0]));
  for (let k = 0; k < 3; k++) torso.add('metal', B(0.08, 0.05, 0.03, C.runnerDark, 0.008).at([0, 0.06 + k * 0.08, 0.15]));
  torso.add('metal', B(0.3, 0.05, 0.22, C.runnerDark, 0.012).at([0, 0.45, 0]), cylinder('y', 0.035, 0.03, 0.44, 0.52, 8, C.steel));

  // 머리: 앞으로 길쭉한 사냥꾼 머리 + V자 눈 + 뒤로 젖힌 지느러미
  const head = torso.child(new Part('head', [0, 0.52, 0.08]));
  head.add('metal', extrude([[0.09, 0.0], [0.1, 0.09], [0.03, 0.15], [-0.14, 0.12], [-0.21, 0.05], [-0.17, -0.03], [0.0, -0.05]], -0.12, 0.12, 'x', C.runnerArmor, 0.012));
  head.add('metal', extrude([[-0.08, 0.03], [-0.2, 0.062], [-0.215, 0.05], [-0.175, -0.012], [-0.08, 0.0]], -0.123, 0.123, 'x', C.runnerDark, 0.004));
  for (const s of [-1, 1]) head.add('glow_red', B(0.085, 0.013, 0.006, C.white).at([s * 0.047, 0.042, -0.205], [0, s * 0.3, -s * 0.25]));
  for (const s of [-1, 1]) head.add('metal', B(0.008, 0.06, 0.13, C.runnerArmor, 0.003).at([s * 0.126, 0.09, 0.03], [-0.45, 0, 0]));
  for (const s of [-1, 1]) head.add('metal', B(0.03, 0.03, 0.06, C.runnerDark, 0.006).at([s * 0.05, -0.04, -0.14]));

  // 팔: 어깨 덮개 → 윗팔 → 팔꿈치 → 아래팔 + 휘어진 칼날 (앞날이 빨갛게 빛나요)
  for (const [s, sg] of SIDES) {
    const arm = torso.child(new Part('arm_' + s, [sg * 0.29, 0.4, 0]));
    arm.add('metal', lathe('y', [[0, -0.02], [0.09, -0.02], [0.095, 0.03], [0.07, 0.08], [0, 0.095]], 10, C.runnerArmor).at([sg * 0.012, 0, 0]));
    arm.add('metal', cylinder('y', 0.046, 0.04, -0.02, -0.26, 10, C.runnerDark), sphere(0.05, 8, 6, C.steel).at([0, -0.27, 0]));
    const fore = arm.child(new Part('fore_' + s, [0, -0.27, 0]));
    fore.add('metal', cylinder('y', 0.042, 0.034, 0, -0.22, 10, C.runnerArmor), B(0.012, 0.18, 0.06, C.runnerDark, 0.003).at([sg * 0.042, -0.11, 0]));
    fore.add('metal', B(0.05, 0.04, 0.06, C.runnerDark, 0.008).at([0, -0.235, 0]));
    fore.add('metal', extrude([[0.025, -0.2], [-0.02, -0.22], [-0.07, -0.36], [-0.1, -0.55], [-0.085, -0.6], [-0.06, -0.5], [-0.02, -0.36], [0.025, -0.24]], -0.006, 0.006, 'x', C.blade, 0.002));
    fore.add('glow_red', extrude([[-0.02, -0.22], [-0.07, -0.36], [-0.1, -0.55], [-0.097, -0.55], [-0.066, -0.36], [-0.016, -0.225]], -0.0068, 0.0068, 'x', C.white));
  }

  // 다리: 허벅지 → 무릎 → 정강이(앞 보호판) → 발(발톱)
  for (const [s, sg] of SIDES) {
    const thigh = hips.child(new Part('thigh_' + s, [sg * 0.15, -0.03, 0]));
    thigh.add('metal', extrude([[-0.075, 0.02], [0.075, 0.02], [0.06, -0.4], [-0.06, -0.4]], -0.075, 0.075, 'z', C.runnerArmor, 0.014));
    thigh.add('metal', sphere(0.05, 8, 6, C.steelDark).at([0, -0.42, 0]));
    const shin = thigh.child(new Part('shin_' + s, [0, -0.42, 0]));
    shin.add('metal', extrude([[-0.055, 0], [0.055, 0], [0.042, -0.42], [-0.042, -0.42]], -0.058, 0.058, 'z', C.runnerDark, 0.012));
    shin.add('metal', B(0.085, 0.3, 0.022, C.runnerArmor, 0.007).at([0, -0.18, -0.066], [-0.05, 0, 0]), cylinder('y', 0.016, 0.016, -0.05, -0.35, 6, C.chrome).at([0, 0, 0.063]));
    const foot = shin.child(new Part('foot_' + s, [0, -0.43, 0]));
    foot.add('metal', extrude([[0.06, 0.01], [0.06, -0.04], [-0.17, -0.04], [-0.2, -0.02], [-0.12, 0.025], [0.0, 0.03]], -0.05, 0.05, 'x', C.runnerArmor, 0.008));
    for (const x of [-0.03, 0.03]) foot.add('metal', B(0.02, 0.02, 0.05, C.blade, 0.004).at([x, -0.03, -0.215], [0.3, 0, 0]));
  }
  return root;
}

/* ---------------- 중장갑 로봇 (노란 공업용 기체, 키 약 2.3m) ---------------- */
export function brute() {
  const root = new Part('brute');
  const hips = root.child(new Part('hips', [0, 0.98, 0]));
  hips.add('metal', B(0.9, 0.28, 0.58, C.bruteDark, 0.03), cylinder('x', 0.12, 0.12, -0.5, 0.5, 12, C.bruteSteel).at([0, -0.04, 0]));
  hips.add('metal', B(0.6, 0.22, 0.04, C.brutePaint, 0.02).at([0, -0.06, -0.31], [0.12, 0, 0]));

  // 몸통: 넓은 가슴 장갑, 어두운 환기구, 주황 빛줄, 경고 줄무늬, 등 배기관
  const torso = hips.child(new Part('torso', [0, 0.12, 0]));
  torso.add('metal', extrude([[-0.42, 0], [0.42, 0], [0.6, 0.42], [0.56, 0.82], [0.3, 0.92], [-0.3, 0.92], [-0.56, 0.82], [-0.6, 0.42]], -0.42, 0.38, 'z', C.brutePaint, 0.04));
  torso.add('metal', extrude([[-0.3, 0.2], [0.3, 0.2], [0.36, 0.58], [-0.36, 0.58]], -0.44, -0.41, 'z', C.bruteDark, 0.01));
  for (let k = 0; k < 4; k++) torso.add('metal', B(0.5 - k * 0.04, 0.025, 0.012, C.bruteSteel, 0.004).at([0, 0.26 + k * 0.08, -0.445]));
  torso.add('glow_orange', B(0.46, 0.03, 0.006, C.white).at([0, 0.645, -0.425]));
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) torso.add('polymer', B(0.03, 0.2, 0.006, C.bruteDark).at([s * (0.38 + k * 0.05), 0.72, -0.423], [0, 0, s * 0.6]));
  torso.add('metal', B(0.7, 0.55, 0.2, C.bruteDark, 0.03).at([0, 0.5, 0.45]));
  for (const s of [-1, 1]) {
    torso.add('metal', cylinder('y', 0.06, 0.055, 0.6, 1.05, 10, C.bruteSteel).at([s * 0.22, 0, 0.32]));
    torso.add('glow_orange', cylinder('y', 0.045, 0.045, 1.05, 1.054, 10, C.white).at([s * 0.22, 0, 0.32]));
  }

  // 머리: 어깨 사이에 묻힌 투구 + 주황 눈띠
  const head = torso.child(new Part('head', [0, 0.9, -0.14]));
  head.add('metal', B(0.42, 0.3, 0.42, C.bruteSteel, 0.04).at([0, 0.12, 0]), B(0.36, 0.1, 0.02, C.bruteDark, 0.01).at([0, 0.15, -0.215]));
  head.add('metal', B(0.06, 0.04, 0.4, C.brutePaint, 0.01).at([0, 0.285, 0]), B(0.2, 0.07, 0.05, C.bruteDark, 0.01).at([0, 0.02, -0.2]));
  head.add('glow_orange', B(0.3, 0.035, 0.006, C.white).at([0, 0.15, -0.228]));

  for (const [s, sg] of SIDES) {
    // 어깨 장갑 (위에 경고 줄무늬)
    const sh = torso.child(new Part('shoulder_' + s, [sg * 0.7, 0.8, 0]));
    sh.add('metal', extrude([[0.4, -0.12], [0.4, 0.1], [0.24, 0.24], [-0.24, 0.24], [-0.42, 0.08], [-0.44, -0.14]], sg * 0.04 - 0.21, sg * 0.04 + 0.21, 'x', C.brutePaint, 0.03));
    for (let k = 0; k < 4; k++) sh.add('polymer', B(0.035, 0.006, 0.28, C.bruteDark).at([sg * 0.04, 0.243, -0.105 + k * 0.07], [0, 0.6, 0]));
    // 팔 대포: 팔꿈치 관절 → 팔각 몸통 → 도는 총신 3개 (barrels 노드)
    const cannon = torso.child(new Part('cannon_' + s, [sg * 0.86, 0.38, 0]));
    cannon.add('metal', sphere(0.14, 10, 6, C.bruteSteel).at([0, 0, 0.1]));
    cannon.add('metal', extrude(circle(0.16, 8, 0, 0, Math.PI / 8), -0.6, 0.12, 'z', C.bruteDark, 0.02));
    cannon.add('metal', B(0.24, 0.05, 0.5, C.brutePaint, 0.02).at([0, 0.16, -0.22]));
    const barrels = cannon.child(new Part('barrels_' + s, [0, 0, -0.6]));
    barrels.add('metal', cylinder('z', 0.13, 0.13, 0, -0.03, 12, C.bruteSteel), cylinder('z', 0.115, 0.115, -0.25, -0.27, 12, C.bruteSteel));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const at = [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0];
      barrels.add('metal', cylinder('z', 0.032, 0.03, -0.03, -0.32, 10, C.bruteSteel).at(at));
      barrels.add('glow_orange', cylinder('z', 0.02, 0.02, -0.32, -0.324, 8, C.white).at(at));
    }
    // 다리: 굵은 허벅지 + 무릎 보호대 → 정강이 + 유압 실린더 → 넓은 발
    const thigh = hips.child(new Part('thigh_' + s, [sg * 0.38, -0.06, 0]));
    thigh.add('metal', B(0.3, 0.48, 0.36, C.bruteDark, 0.03).at([0, -0.22, 0]), B(0.32, 0.36, 0.06, C.brutePaint, 0.02).at([0, -0.2, -0.2]));
    thigh.add('metal', cylinder('x', 0.12, 0.12, -0.17, 0.17, 12, C.bruteSteel).at([0, -0.46, 0]), B(0.26, 0.2, 0.08, C.brutePaint, 0.02).at([0, -0.46, -0.16]));
    const shin = thigh.child(new Part('shin_' + s, [0, -0.46, 0]));
    shin.add('metal', extrude([[-0.13, 0], [0.13, 0], [0.11, -0.38], [-0.11, -0.38]], -0.16, 0.16, 'z', C.bruteSteel, 0.025));
    shin.add('metal', cylinder('y', 0.035, 0.035, -0.05, -0.33, 8, C.chrome).at([0, 0, 0.18]), B(0.22, 0.24, 0.04, C.brutePaint, 0.015).at([0, -0.17, -0.17]));
    const foot = shin.child(new Part('foot_' + s, [0, -0.38, 0]));
    foot.add('metal', extrude([[0.16, 0.02], [0.16, -0.08], [-0.3, -0.08], [-0.34, -0.04], [-0.24, 0.04], [0, 0.07]], -0.17, 0.17, 'x', C.bruteDark, 0.02));
    foot.add('metal', B(0.3, 0.03, 0.14, C.brutePaint, 0.01).at([0, 0.035, -0.18], [0.35, 0, 0]));
  }
  return root;
}

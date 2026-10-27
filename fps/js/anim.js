/* SECTOR ZERO — 총 애니메이션 (발로란트처럼 크고 묵직하게)
   꺼내기, 재장전(탄창 빼기 → 새 탄창 → 밀어 넣고 치기 → 장전 손잡이), 산탄 한 발씩 넣기, 펌프,
   살펴보기(Y), 쏠 때 크게 튀었다 돌아오는 반동(스프링), 숨쉬기·걷기·달리기·점프 흔들림.
   DOM·WebGL 없는 순수 로직이라 테스트할 수 있어요. 그리기는 models.js가 해요. */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});
  const TAU = Math.PI * 2;

  /*
   * 총 좌표: x 오른쪽, y 위, -z 앞. rx 양수 = 총구가 위로, ry 양수 = 총구가 왼쪽으로, rz 양수 = 윗면이 왼쪽으로 누워요.
   * hip: 허리 사격 위치, ads: 정조준 위치(가늠쇠가 화면 가운데), left: 왼손이 쉬는 자리,
   * mag.seat: 탄창이 꽂힌 자리(가운데), mag.rx: 탄창 기울기, pivot: 손가락에 걸고 돌리는 축
   */
  const GEOM = {
    pistol: {
      hip: [0.19, -0.19, -0.46],
      ads: [0, -0.066, -0.34],
      muzzle: [0, 0.035, -0.27],
      eject: [0.026, 0.05, -0.1],
      left: [-0.046, -0.085, -0.012],
      mag: { seat: [0, -0.085, -0.02], rx: 0.22, size: [0.03, 0.13, 0.044] },
      pivot: [0, -0.036, -0.07],
      casing: [0.009, 0.009, 0.022],
    },
    rifle: {
      hip: [0.18, -0.2, -0.44],
      ads: [0, -0.082, -0.3],
      muzzle: [0, 0.01, -0.7],
      eject: [0.034, 0.02, -0.12],
      left: [-0.012, -0.055, -0.42],
      mag: { seat: [0, -0.095, -0.2], rx: -0.18, size: [0.045, 0.13, 0.07] },
      bolt: [0.037, 0.014, -0.06],
      pivot: [0, -0.04, -0.06],
      casing: [0.01, 0.01, 0.032],
    },
    shotgun: {
      hip: [0.18, -0.2, -0.44],
      ads: [0, -0.052, -0.32],
      muzzle: [0, 0.02, -0.72],
      eject: [0.036, 0.02, -0.1],
      left: [-0.012, -0.055, -0.42],
      port: [0, -0.05, -0.16],
      pivot: [0, -0.04, -0.06],
      casing: [0.02, 0.02, 0.055],
    },
  };

  /** 동작 길이(초). 재장전 길이는 rules.js의 무기 값을 따라요 */
  const DUR = {
    lower: 0.14,
    draw: { pistol: 0.55, rifle: 0.72, shotgun: 0.66 },
    inspect: { pistol: 2.4, rifle: 2.8, shotgun: 2.6 },
    shellEnter: 0.25,
    rack: 0.45,
    pumpDelay: 0.12,
    pump: 0.5,
  };

  /** 탄창 아래를 잡은 손 높이: 탄창은 손에서 탄창 축을 따라 0.075m 위에 있어요 */
  const MAG_GRIP = 0.075;

  const add = (a, b) => {
    const o = Object.assign({}, a);
    for (const k in b) o[k] = (o[k] || 0) + b[k];
    return o;
  };

  /** 탄창을 자리에서 off만큼 (탄창 축을 따라) 내린 채로 잡은 왼손 위치 (왼손 쉬는 자리 기준) */
  function hold(id, off, extra) {
    const g = GEOM[id];
    const ay = Math.cos(g.mag.rx), az = Math.sin(g.mag.rx);
    const d = off - MAG_GRIP;
    const o = {
      x: g.mag.seat[0] - g.left[0],
      y: g.mag.seat[1] + ay * d - g.left[1],
      z: g.mag.seat[2] + az * d - g.left[2],
    };
    return extra ? add(o, extra) : o;
  }

  /** 오른쪽 장전 손잡이를 잡은 왼손 (pull = 뒤로 당긴 거리) */
  function boltHand(pull) {
    const g = GEOM.rifle;
    return { x: g.bolt[0] + 0.042 - g.left[0], y: g.bolt[1] - g.left[1], z: g.bolt[2] + pull - g.left[2], rz: -0.5 };
  }

  /** 산탄을 넣는 구멍(아래쪽)에 탄을 댄 왼손. push = 앞으로 밀어 넣은 거리 */
  function portHand(push) {
    const g = GEOM.shotgun;
    return { x: g.port[0] - g.left[0], y: g.port[1] - 0.045 - g.left[1], z: g.port[2] + 0.02 + 0.05 - push - g.left[2] };
  }

  const AWAY = { x: -0.07, y: -0.42, z: 0.2, rx: -0.7 }; // 왼손이 화면 밖(허리 쪽)으로

  /* ---------- 동작별 키프레임 ---------- */
  // root: 총 전체 [u, {x,y,z,rx,ry,rz,spin}], left: 왼손, slide/bolt/pump/mag: 부품 이동, magMode/hold: 단계,
  // events: [u, 이름] — 소리와 탄창·탄피 떨어뜨리기
  const RIFLE_BOLT_ROOT = { x: -0.045, y: 0.035, z: 0.02, rx: 0.1, ry: 0.42, rz: 0.25 }; // 오른쪽 면이 보이게
  const SHOTGUN_LOAD = { x: -0.035, y: 0.05, z: 0.03, rx: 0.16, ry: -0.15, rz: -0.72 };
  const SHELL_WAIT = { x: -0.03, y: -0.1, z: 0.26 };

  const ANIMS = {
    pistol: {
      lower: { root: [[0, {}], [1, { y: -0.3, z: 0.04, rx: -0.75, rz: 0.35 }]], left: [[0, {}], [1, AWAY]] },
      draw: {
        // 아래에서 올라오며 손가락에 걸고 한 바퀴 휙 돌리기
        root: [
          [0, { y: -0.3, z: 0.05, rx: -0.5, rz: 0.3, spin: -TAU }],
          [0.55, { y: 0.02, rx: 0.05, spin: 0.14 }],
          [0.72, { y: -0.01, spin: -0.05 }],
          [1, {}],
        ],
        left: [[0, AWAY], [0.5, AWAY], [0.85, {}], [1, {}]],
        events: [[0, 'equip'], [0.55, 'spinCatch']],
      },
      reload: {
        root: [
          [0, {}],
          [0.13, { x: -0.035, y: 0.06, z: 0.05, rx: 0.35, rz: -0.36 }],
          [0.46, { x: -0.035, y: 0.062, z: 0.05, rx: 0.33, rz: -0.34 }],
          [0.53, { x: -0.035, y: 0.09, z: 0.05, rx: 0.48, rz: -0.4 }],
          [0.6, { x: -0.035, y: 0.06, z: 0.05, rx: 0.3, rz: -0.3 }],
          [0.7, { x: -0.01, y: 0.03, z: 0.03, rx: 0.12, rz: 0.12 }],
          [0.76, { x: -0.01, y: 0.055, z: 0.02, rx: 0.3, rz: 0.16 }],
          [0.88, { y: -0.01, rx: -0.05 }],
          [1, {}],
        ],
        mag: [[0, 0], [0.08, 0], [0.19, -0.09], [0.44, -0.07], [0.51, 0]],
        magMode: [[0, 'gun'], [0.19, 'none'], [0.32, 'hand'], [0.44, 'gun']],
        left: [
          [0, {}],
          [0.12, { x: -0.05, y: -0.1, z: 0.06, rx: -0.3 }],
          [0.22, AWAY],
          [0.32, AWAY],
          [0.44, hold('pistol', -0.07)],
          [0.51, hold('pistol', 0)],
          [0.54, hold('pistol', 0, { y: 0.02 })],
          [0.62, hold('pistol', 0, { y: -0.02 })],
          [0.76, {}],
          [1, {}],
        ],
        slide: [[0, 0], [0.7, 0], [0.72, 1], [0.77, 0]],
        events: [[0.05, 'magOut'], [0.19, 'dropMag'], [0.47, 'magIn'], [0.52, 'slap'], [0.74, 'slideRelease']],
      },
      inspect: {
        // 옆면을 보여 주고, 손가락에 걸어 한 바퀴 돌려서 받기
        root: [
          [0, {}],
          [0.16, { x: -0.13, y: 0.07, z: 0.08, rx: 0.1, ry: 1.15, rz: 0.2 }],
          [0.4, { x: -0.135, y: 0.08, z: 0.08, rx: 0.12, ry: 1.22, rz: 0.26 }],
          [0.52, { x: -0.02, y: 0.03, z: 0.02, ry: -0.25, rz: -0.15 }],
          [0.58, { y: 0.045 }],
          [0.8, { y: 0.03, spin: -TAU }],
          [0.86, { y: -0.012, rx: -0.06, spin: -TAU - 0.1 }],
          [0.94, { spin: -TAU }],
          [1, { spin: -TAU }],
        ],
        left: [[0, {}], [0.1, AWAY], [0.88, AWAY], [1, {}]],
        events: [[0.04, 'cloth'], [0.5, 'cloth'], [0.84, 'spinCatch']],
      },
    },
    rifle: {
      lower: { root: [[0, {}], [1, { y: -0.3, z: 0.04, rx: -0.75, rz: 0.35 }]], left: [[0, {}], [1, AWAY]] },
      draw: {
        // 오른쪽 아래에서 굴리듯 올라온 뒤 장전 손잡이 철컥
        root: [
          [0, { x: 0.1, y: -0.34, z: 0.06, rx: -0.55, ry: 0.45, rz: -0.9 }],
          [0.42, { x: -0.01, y: 0.018, rx: 0.07, rz: 0.1 }],
          [0.52, {}],
          [0.6, RIFLE_BOLT_ROOT],
          [0.67, RIFLE_BOLT_ROOT],
          [0.73, add(RIFLE_BOLT_ROOT, { y: -0.015, z: 0.035, rx: -0.08, rz: 0.06 })],
          [0.88, { y: -0.006, rx: -0.035 }],
          [1, {}],
        ],
        left: [[0, AWAY], [0.38, {}], [0.5, {}], [0.6, boltHand(0)], [0.67, boltHand(0)], [0.72, boltHand(0.075)], [0.75, boltHand(0.06)], [0.88, {}], [1, {}]],
        bolt: [[0, 0], [0.67, 0], [0.72, 0.075], [0.74, 0]],
        events: [[0, 'equip'], [0.69, 'boltBack'], [0.74, 'boltRelease']],
      },
      reload: {
        root: [
          [0, {}],
          // 윗면을 오른쪽으로 크게 눕혀 탄창 구멍이 왼손 쪽을 보게
          [0.14, { x: -0.06, y: 0.06, z: 0.04, rx: 0.2, ry: 0.18, rz: -0.62 }],
          [0.48, { x: -0.06, y: 0.062, z: 0.04, rx: 0.19, ry: 0.18, rz: -0.6 }],
          [0.55, { x: -0.06, y: 0.088, z: 0.04, rx: 0.34, ry: 0.18, rz: -0.67 }],
          [0.6, { x: -0.06, y: 0.06, z: 0.04, rx: 0.17, ry: 0.18, rz: -0.58 }],
          [0.69, RIFLE_BOLT_ROOT],
          [0.76, RIFLE_BOLT_ROOT],
          [0.8, add(RIFLE_BOLT_ROOT, { y: -0.018, z: 0.035, rx: -0.1, rz: 0.06 })],
          [0.92, { y: -0.006, rx: -0.035 }],
          [1, {}],
        ],
        mag: [[0, 0], [0.08, 0], [0.16, -0.08], [0.46, -0.07], [0.53, 0]],
        magMode: [[0, 'gun'], [0.16, 'none'], [0.33, 'hand'], [0.46, 'gun']],
        left: [
          [0, {}],
          [0.12, { x: -0.06, y: -0.12, z: 0.15, rx: -0.3 }],
          [0.22, AWAY],
          [0.33, AWAY],
          [0.46, hold('rifle', -0.07)],
          [0.53, hold('rifle', 0)],
          [0.56, hold('rifle', 0, { y: 0.022 })],
          [0.61, hold('rifle', 0, { y: -0.012 })],
          [0.66, { x: 0.1, y: -0.07, z: 0.3 }],
          [0.7, boltHand(0)],
          [0.76, boltHand(0)],
          [0.79, boltHand(0.075)],
          [0.82, boltHand(0.06)],
          [0.94, {}],
          [1, {}],
        ],
        bolt: [[0, 0], [0.76, 0], [0.79, 0.075], [0.81, 0]],
        events: [[0.06, 'magOut'], [0.16, 'dropMag'], [0.5, 'magIn'], [0.55, 'slap'], [0.77, 'boltBack'], [0.81, 'boltRelease']],
      },
      inspect: {
        // 왼쪽 면을 크게 보여 주고, 뒤집어 오른쪽 면과 윗면
        root: [
          [0, {}],
          [0.14, { x: -0.12, y: 0.06, z: 0.06, rx: 0.1, ry: 0.95, rz: 0.25 }],
          [0.42, { x: -0.125, y: 0.075, z: 0.06, rx: 0.14, ry: 1.05, rz: 0.32 }],
          [0.6, { x: -0.05, y: 0.04, z: 0.03, rx: -0.15, ry: -0.55, rz: -0.85 }],
          [0.8, { x: -0.05, y: 0.05, z: 0.03, rx: -0.1, ry: -0.6, rz: -0.92 }],
          [0.92, { y: -0.008, rx: 0.04 }],
          [1, {}],
        ],
        events: [[0.04, 'cloth'], [0.48, 'cloth'], [0.86, 'cloth']],
      },
    },
    shotgun: {
      lower: { root: [[0, {}], [1, { y: -0.3, z: 0.04, rx: -0.75, rz: 0.35 }]], left: [[0, {}], [1, AWAY]] },
      draw: {
        root: [
          [0, { x: 0.07, y: -0.32, z: 0.05, rx: -0.6, ry: 0.3, rz: 0.75 }],
          [0.45, { y: 0.015, rx: 0.06, rz: -0.05 }],
          [0.55, {}],
          [0.68, { y: -0.025, z: 0.025, rx: -0.1, rz: 0.24 }],
          [0.84, { rx: 0.05 }],
          [1, {}],
        ],
        left: [[0, AWAY], [0.4, {}], [1, {}]],
        pump: [[0, 0], [0.56, 0], [0.68, 0.1], [0.82, 0], [1, 0]],
        events: [[0, 'equip'], [0.66, 'pumpBack'], [0.82, 'pumpFwd']],
      },
      // 첫 탄 전에: 총을 오른쪽으로 눕혀 아래쪽 구멍을 왼손 쪽으로
      shellEnter: { root: [[0, {}], [1, SHOTGUN_LOAD]], left: [[0, {}], [1, SHELL_WAIT]] },
      // 한 발 넣기 (반복): 허리에서 탄을 꺼내 구멍에 밀어 넣어요
      shell: {
        root: [[0, SHOTGUN_LOAD], [0.74, SHOTGUN_LOAD], [0.82, add(SHOTGUN_LOAD, { y: 0.014, rx: 0.06 })], [1, SHOTGUN_LOAD]],
        left: [
          [0, SHELL_WAIT],
          [0.28, { x: -0.09, y: -0.36, z: 0.3, rx: -0.6 }],
          [0.4, { x: -0.09, y: -0.36, z: 0.3, rx: -0.6 }],
          [0.66, portHand(0)],
          [0.8, portHand(0.05)],
          [1, SHELL_WAIT],
        ],
        hold: [[0, null], [0.36, 'shell'], [0.8, null]],
        events: [[0.8, 'shellIn']],
      },
      // 다 넣고 나서: 바로 세우며 펌프 철컥
      rack: {
        root: [[0, SHOTGUN_LOAD], [0.35, { y: -0.012, rz: 0.2, rx: -0.06 }], [0.66, { rx: 0.06 }], [1, {}]],
        left: [[0, SHELL_WAIT], [0.3, {}], [1, {}]],
        pump: [[0, 0], [0.22, 0], [0.42, 0.1], [0.62, 0], [1, 0]],
        events: [[0.4, 'pumpBack'], [0.62, 'pumpFwd']],
      },
      // 쏜 뒤 펌프질: 총을 크게 기울이며 탄피를 튕겨 내요
      pump: {
        root: [[0, {}], [0.4, { y: -0.028, z: 0.025, rx: -0.12, rz: 0.28 }], [0.75, { y: -0.008, rx: 0.05, rz: 0.06 }], [1, {}]],
        pump: [[0, 0], [0.18, 0], [0.42, 0.1], [0.66, 0], [1, 0]],
        events: [[0.36, 'pumpBack'], [0.4, 'ejectShell'], [0.64, 'pumpFwd']],
      },
      inspect: {
        root: [
          [0, {}],
          [0.16, { x: -0.1, y: 0.07, z: 0.05, rx: 0.2, ry: 0.8, rz: 0.5 }],
          [0.42, { x: -0.105, y: 0.08, z: 0.05, rx: 0.24, ry: 0.86, rz: 0.56 }],
          [0.58, { x: 0, y: 0.02, rx: -0.05, ry: -0.3, rz: -0.6 }],
          [0.66, { x: 0, y: 0.02, rx: -0.05, ry: -0.3, rz: -0.6 }],
          [0.74, { y: -0.012, z: 0.025, rx: -0.13, ry: -0.2, rz: -0.35 }],
          [0.86, { rx: 0.06 }],
          [1, {}],
        ],
        pump: [[0, 0], [0.66, 0], [0.74, 0.1], [0.84, 0], [1, 0]],
        events: [[0.04, 'cloth'], [0.5, 'cloth'], [0.74, 'pumpBack'], [0.84, 'pumpFwd']],
      },
    },
  };

  /* 쏠 때 반동 (스프링에 더하는 값). ADS 중에는 절반 */
  const KICK = {
    pistol: { z: 0.06, rx: 0.24, y: 0.014, rz: 0.07 },
    rifle: { z: 0.032, rx: 0.085, y: 0.006, rz: 0.045 },
    shotgun: { z: 0.13, rx: 0.42, y: 0.03, rz: 0.12 },
  };
  const SPRING_K = 240;
  const SPRING_C = 21;

  /* ---------- 키프레임 읽기 ---------- */
  const ease = (t) => t * t * (3 - 2 * t);
  const ROOT_CH = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'spin'];
  const LEFT_CH = ['x', 'y', 'z', 'rx', 'ry', 'rz'];

  function findKey(keys, u) {
    let i = 0;
    while (i < keys.length - 1 && u > keys[i + 1][0]) i++;
    return i;
  }

  /** 객체 키프레임 → u에서의 값 (빠진 채널은 0, 키 사이는 부드럽게) */
  function sampleObj(keys, u, chans, out) {
    for (const c of chans) out[c] = 0;
    if (!keys) return out;
    const i = findKey(keys, u);
    const [u0, a] = keys[i];
    if (i >= keys.length - 1 || u <= u0) {
      for (const c of chans) out[c] = a[c] || 0;
      return out;
    }
    const [u1, b] = keys[i + 1];
    const t = ease((u - u0) / (u1 - u0));
    for (const c of chans) out[c] = (a[c] || 0) + ((b[c] || 0) - (a[c] || 0)) * t;
    return out;
  }

  function sampleNum(keys, u) {
    if (!keys) return 0;
    const i = findKey(keys, u);
    const [u0, a] = keys[i];
    if (i >= keys.length - 1 || u <= u0) return a;
    const [u1, b] = keys[i + 1];
    return a + (b - a) * ease((u - u0) / (u1 - u0));
  }

  /** 단계 키 → u까지 마지막으로 지난 값 */
  function step(keys, u, def) {
    if (!keys) return def;
    let v = def;
    for (const [k, val] of keys) if (u >= k) v = val;
    return v;
  }

  /* ---------- 상태 ---------- */
  function create() {
    const zero = () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
    return {
      sx: zero(), // 반동 스프링 위치
      sv: zero(), // 반동 스프링 속도
      sm: null, // 부드럽게 따라가는 총 위치
      smL: null, // 부드럽게 따라가는 왼손 위치
      slideKick: 0,
      boltKick: 0,
      actKey: '',
      lastU: -1,
      tRoot: {},
      tLeft: {},
      pose: {
        id: 'pistol',
        x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, spin: 0,
        slide: 0, bolt: 0, pump: 0,
        magMode: 'gun', magOff: 0, hold: null,
        left: zero(),
      },
    };
  }

  /** 쏠 때: 크게 튀는 반동 + 권총 슬라이드·소총 노리쇠 */
  function fire(vm, id, aim) {
    const k = KICK[id];
    const s = 1 - 0.5 * (aim || 0);
    const side = Math.random() < 0.5 ? -1 : 1;
    vm.sx.z = Math.min(0.22, vm.sx.z + k.z * s);
    vm.sx.rx = Math.min(0.7, vm.sx.rx + k.rx * s * (0.85 + Math.random() * 0.3));
    vm.sx.y += k.y * s;
    vm.sx.rz += k.rz * s * side * (0.6 + Math.random() * 0.4);
    vm.sx.x += (Math.random() - 0.5) * 0.008 * s;
    vm.sx.ry += (Math.random() - 0.5) * 0.04 * s;
    if (id === 'pistol') vm.slideKick = 1;
    if (id === 'rifle') vm.boltKick = 1;
  }

  /** 빈 총 방아쇠: 살짝 까딱 */
  function dry(vm) {
    vm.sx.rx -= 0.05;
    vm.sx.z += 0.01;
  }

  /** 숨쉬기, 걷기·달리기 흔들림, 옆걸음 기울기, 마우스 따라 늦게 오기, 점프·착지 */
  function moveLayer(c, o, busy) {
    const still = (1 - 0.85 * c.aim) * (busy ? 0.6 : 1);
    const t = c.time;
    o.x += Math.sin(t * 0.9) * 0.003 * still;
    o.y += Math.sin(t * 1.7) * 0.005 * still;
    o.rx += Math.sin(t * 1.7 - 0.6) * 0.012 * still;
    const bob = c.bobAmt * (1 + 0.9 * c.sprint) * still;
    const p = c.bobPhase;
    o.x += Math.sin(p) * 0.024 * bob;
    o.y += (0.012 - Math.abs(Math.cos(p)) * 0.03) * bob;
    o.rz += Math.sin(p) * 0.05 * bob;
    o.rx -= Math.abs(Math.cos(p)) * 0.04 * bob;
    o.rz -= c.strafe * 0.018 * still;
    o.x -= c.strafe * 0.004 * still;
    const sway = 1 - 0.6 * c.aim;
    o.x += c.swayX * 0.55 * sway;
    o.y += c.swayY * 0.55 * sway;
    o.ry -= c.swayX * 2.2 * sway;
    o.rx += c.swayY * 1.5 * sway;
    if (!c.onGround) {
      const v = Math.max(-8, Math.min(8, c.vy));
      o.y -= v * 0.0035 * still;
      o.rx -= v * 0.012 * still;
    }
    o.y -= c.land * 0.07 * still;
    o.rx -= c.land * 0.2 * still;
    // 달리기: 총을 왼쪽 아래로 크게 돌려 들어요
    const sp = c.sprint * (busy ? 0.3 : 1);
    o.x += 0.03 * sp;
    o.y -= 0.035 * sp;
    o.z += 0.03 * sp;
    o.rx -= 0.32 * sp;
    o.ry += 0.62 * sp;
    o.rz += 0.3 * sp;
  }

  /**
   * 한 프레임 진행. c = {id, action, u, aim, sprint, bobPhase, bobAmt, swayX, swayY, strafe, vy, onGround, land, time}
   * 돌려주는 값: 이번 프레임에 지난 사건 이름들 (소리, 탄창 떨어뜨리기, 탄피 튕기기)
   */
  function update(vm, dt, c) {
    const events = [];
    // 반동 스프링
    for (const k in vm.sx) {
      const a = -SPRING_K * vm.sx[k] - SPRING_C * vm.sv[k];
      vm.sv[k] += a * dt;
      vm.sx[k] += vm.sv[k] * dt;
    }
    vm.slideKick = Math.max(0, vm.slideKick - dt * 16);
    vm.boltKick = Math.max(0, vm.boltKick - dt * 20);

    // 동작과 사건
    const anim = c.action ? ANIMS[c.id][c.action] : null;
    const key = anim ? c.id + ':' + c.action : '';
    const u = Math.max(0, Math.min(1, c.u || 0));
    if (key !== vm.actKey || u < vm.lastU) {
      vm.actKey = key;
      vm.lastU = -1;
    }
    if (anim && anim.events) for (const [eu, name] of anim.events) if (vm.lastU < eu && u >= eu) events.push(name);
    vm.lastU = u;

    // 목표 자세 = 허리/조준 위치 + 흔들림 + 동작
    const g = GEOM[c.id];
    const tr = sampleObj(anim && anim.root, u, ROOT_CH, vm.tRoot);
    const tl = sampleObj(anim && anim.left, u, LEFT_CH, vm.tLeft);
    const a = c.aim;
    tr.x += g.hip[0] + (g.ads[0] - g.hip[0]) * a;
    tr.y += g.hip[1] + (g.ads[1] - g.hip[1]) * a;
    tr.z += g.hip[2] + (g.ads[2] - g.hip[2]) * a;
    moveLayer(c, tr, !!anim && c.action !== 'pump');

    // 부드럽게 따라가기 (동작이 끊겨도 튀지 않게). 회전 바퀴(spin)는 그대로
    const f = vm.sm ? 1 - Math.exp(-30 * dt) : 1;
    if (!vm.sm) {
      vm.sm = Object.assign({}, tr);
      vm.smL = Object.assign({}, tl);
    }
    for (const ch of LEFT_CH) {
      vm.sm[ch] += (tr[ch] - vm.sm[ch]) * f;
      vm.smL[ch] += (tl[ch] - vm.smL[ch]) * f;
    }

    const p = vm.pose;
    p.id = c.id;
    for (const ch of LEFT_CH) {
      p[ch] = vm.sm[ch] + vm.sx[ch];
      p.left[ch] = vm.smL[ch];
    }
    p.spin = tr.spin;
    p.slide = Math.max(vm.slideKick, sampleNum(anim && anim.slide, u));
    p.bolt = sampleNum(anim && anim.bolt, u) + vm.boltKick * 0.018;
    p.pump = sampleNum(anim && anim.pump, u);
    p.magMode = g.mag ? step(anim && anim.magMode, u, 'gun') : 'none';
    p.magOff = sampleNum(anim && anim.mag, u);
    p.hold = step(anim && anim.hold, u, null);
    return events;
  }

  SZ.anim = { GEOM, DUR, ANIMS, KICK, MAG_GRIP, create, fire, dry, update, sampleObj, sampleNum, step, hold };
})(typeof window !== 'undefined' ? window : globalThis);

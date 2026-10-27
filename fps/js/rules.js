/* SECTOR ZERO — 규칙: 무기, 적 종류, 웨이브 구성, 점수 (DOM·WebGL 없는 순수 로직) */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  /*
   * fireDelay: 연사 간격(초)   holdDelay: 버튼을 누르고 있을 때 간격 (반자동 무기)
   * spread: 기본 탄 퍼짐(라디안)   bloom: 한 발마다 늘어나는 퍼짐   reload: 재장전 시간 (산탄총은 한 발당)
   */
  const WEAPONS = [
    {
      id: 'pistol',
      name: 'P-9 권총',
      caliber: '9mm',
      slot: 1,
      damage: 26,
      pellets: 1,
      fireDelay: 0.13,
      holdDelay: 0.26,
      mag: 12,
      reserve: Infinity,
      maxReserve: Infinity,
      reload: 1.4,
      spread: 0.004,
      bloom: 0.012,
      maxSpread: 0.045,
      recoil: 0.026,
      range: 90,
      falloff: 0,
      headMul: 2.2,
      zoom: 0.8,
    },
    {
      id: 'rifle',
      name: 'AR-7 돌격소총',
      caliber: '5.56mm',
      slot: 2,
      damage: 17,
      pellets: 1,
      fireDelay: 0.092,
      holdDelay: 0.092,
      mag: 30,
      reserve: 120,
      maxReserve: 270,
      reload: 2.1,
      spread: 0.006,
      bloom: 0.0055,
      maxSpread: 0.055,
      recoil: 0.015,
      range: 110,
      falloff: 0,
      headMul: 2,
      zoom: 0.62,
      tracer: true,
    },
    {
      id: 'shotgun',
      name: 'SG-12 산탄총',
      caliber: '12G',
      slot: 3,
      damage: 13,
      pellets: 9,
      fireDelay: 0.78,
      holdDelay: 0.78,
      mag: 6,
      reserve: 18,
      maxReserve: 42,
      reload: 0.5,
      shellReload: true,
      spread: 0.07,
      bloom: 0,
      maxSpread: 0.07,
      recoil: 0.07,
      range: 45,
      falloff: 9,
      headMul: 1.6,
      zoom: 0.85,
    },
  ];

  /*
   * 적 히트박스는 발밑(y=0, 드론은 떠 있는 높이)을 기준으로 한 상자 [중심 y, 반폭, 반높이].
   * head에 맞으면 치명타. 드론은 몸 한가운데 코어가 약점이에요.
   */
  const ENEMIES = {
    drone: {
      name: '감시 드론',
      hp: 42,
      speed: 3.6,
      radius: 0.45,
      flying: true,
      hover: 1.9,
      score: 100,
      attack: 'shoot',
      fireEvery: [1.5, 2.5],
      burst: 1,
      shotSpeed: 14,
      shotDamage: 8,
      range: 24,
      keepDist: 9,
      body: [0, 0.46, 0.32],
      head: [0, 0.2, 0.2],
      color: [1, 0.28, 0.2],
    },
    runner: {
      name: '추격자',
      hp: 60,
      speed: 6.3,
      radius: 0.42,
      score: 120,
      attack: 'melee',
      meleeDamage: 13,
      meleeEvery: 0.75,
      reach: 1.45,
      body: [0.74, 0.4, 0.73],
      head: [1.62, 0.22, 0.17],
      color: [1, 0.2, 0.15],
    },
    brute: {
      name: '중장갑 로봇',
      hp: 260,
      speed: 2.4,
      radius: 0.75,
      score: 400,
      attack: 'shoot',
      fireEvery: [2.4, 3.2],
      burst: 3,
      burstGap: 0.17,
      shotSpeed: 17,
      shotDamage: 11,
      range: 28,
      keepDist: 10,
      body: [1.0, 0.75, 1.0],
      head: [2.2, 0.3, 0.2],
      color: [1, 0.55, 0.12],
    },
  };

  const PLAYER = {
    maxHp: 100,
    radius: 0.32,
    eye: 1.62,
    height: 1.8,
    walk: 6.2,
    sprint: 9.4,
    jump: 7.1,
    gravity: 22,
  };

  const PICKUPS = {
    health: { amount: 35, respawn: 28 },
    ammo: { rifle: 45, shotgun: 8, respawn: 24 },
  };

  /** n번째 웨이브 구성 (1부터) */
  function wavePlan(n) {
    n = Math.max(1, Math.floor(n));
    const total = 5 + n * 3;
    const brutes = n >= 3 ? Math.floor((n - 1) / 2) : 0;
    const runners = Math.round((total - brutes) * Math.min(0.55, 0.3 + n * 0.04));
    const drones = total - brutes - runners;
    return {
      wave: n,
      total,
      drones,
      runners,
      brutes,
      maxAlive: Math.min(5 + n, 14),
      spawnGap: Math.max(0.45, 1.4 - n * 0.08),
      hpMul: 1 + 0.07 * (n - 1),
      dmgMul: 1 + 0.05 * (n - 1),
      speedMul: 1 + Math.min(0.25, 0.02 * (n - 1)),
      clearBonus: 250 * n,
    };
  }

  /** 웨이브에 나올 적 순서: 섞되, 중장갑은 처음 두 마리 안에 오지 않아요 */
  function spawnOrder(plan, rand) {
    rand = rand || Math.random;
    const list = [];
    for (let i = 0; i < plan.drones; i++) list.push('drone');
    for (let i = 0; i < plan.runners; i++) list.push('runner');
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    for (let i = 0; i < plan.brutes; i++) {
      const at = Math.min(list.length, 2 + Math.floor(rand() * Math.max(1, list.length - 1)));
      list.splice(at, 0, 'brute');
    }
    return list;
  }

  const COMBO_WINDOW = 4; // 초 안에 다음 처치를 하면 콤보가 이어져요

  /** 콤보 배율: 1, 1.25, 1.5 … 최대 3 */
  const comboMul = (combo) => Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));

  /** 처치 점수 */
  function killScore(type, crit, combo) {
    const base = ENEMIES[type].score;
    return Math.round(base * (crit ? 1.5 : 1) * comboMul(combo));
  }

  /** 거리에 따른 피해 감소 (산탄총) */
  function damageAt(weapon, dist) {
    if (!weapon.falloff || dist <= weapon.falloff) return weapon.damage;
    return weapon.damage * Math.max(0.3, 1 - (dist - weapon.falloff) / 28);
  }

  /**
   * 광선 vs 축 정렬 상자. 상자 [cx,cy,cz] 중심, 반폭 hx(=hz), 반높이 hy.
   * 처음 닿는 거리 t(≥0) 또는 -1
   */
  function rayBox(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz) {
    let tmin = -Infinity, tmax = Infinity;
    const o = [ox - cx, oy - cy, oz - cz];
    const d = [dx, dy, dz];
    const h = [hx, hy, hz];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < -h[i] || o[i] > h[i]) return -1;
      } else {
        let t1 = (-h[i] - o[i]) / d[i];
        let t2 = (h[i] - o[i]) / d[i];
        if (t1 > t2) {
          const t = t1;
          t1 = t2;
          t2 = t;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (tmax < 0) return -1;
    return tmin >= 0 ? tmin : 0;
  }

  /**
   * 광선이 적을 맞히는지 → {t, crit} 또는 null
   * enemy: {type, x, y, z} — y는 발밑(드론은 떠 있는 중심 높이)
   */
  function rayEnemy(ox, oy, oz, dx, dy, dz, enemy) {
    const def = ENEMIES[enemy.type];
    const [hcY, hW, hH] = def.head;
    const [bcY, bW, bH] = def.body;
    const th = rayBox(ox, oy, oz, dx, dy, dz, enemy.x, enemy.y + hcY, enemy.z, hW, hH, hW);
    const tb = rayBox(ox, oy, oz, dx, dy, dz, enemy.x, enemy.y + bcY, enemy.z, bW, bH, bW);
    if (th >= 0) return { t: tb >= 0 ? Math.min(th, tb) : th, crit: true };
    if (tb >= 0) return { t: tb, crit: false };
    return null;
  }

  SZ.rules = {
    WEAPONS,
    ENEMIES,
    PLAYER,
    PICKUPS,
    COMBO_WINDOW,
    wavePlan,
    spawnOrder,
    comboMul,
    killScore,
    damageAt,
    rayBox,
    rayEnemy,
  };
})(typeof window !== 'undefined' ? window : globalThis);

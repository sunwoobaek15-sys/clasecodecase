/* SECTOR ZERO — 게임: 상태, 플레이어, 무기, 적 AI, 웨이브, 효과, 그리기 순서 */
(function (root) {
  'use strict';
  const SZ = root.SZ;
  const { m4, clamp, lerp, damp, angleDiff, yawTo } = SZ.math;
  const LV = SZ.level;
  const RU = SZ.rules;
  const PL = RU.PLAYER;
  const audio = SZ.audio;
  const input = SZ.input;
  const hud = SZ.hud;
  const models = SZ.models;

  /* ---------------- 저장 (최고 기록, 설정) ---------------- */
  const STORE_KEY = 'sectorzero.v1';
  const DEFAULTS = { sens: 1, volume: 0.8, fov: 74, quality: 'auto', invertY: false };
  const store = { best: null, settings: Object.assign({}, DEFAULTS) };
  function loadStore() {
    try {
      const s = JSON.parse(root.localStorage.getItem(STORE_KEY) || 'null');
      if (s && typeof s === 'object') {
        if (s.best && typeof s.best.score === 'number') store.best = s.best;
        if (s.settings && typeof s.settings === 'object') {
          const v = s.settings;
          const st = store.settings;
          if (typeof v.sens === 'number') st.sens = clamp(v.sens, 0.2, 3);
          if (typeof v.volume === 'number') st.volume = clamp(v.volume, 0, 1);
          if (typeof v.fov === 'number') st.fov = clamp(v.fov, 60, 95);
          if (['auto', 'high', 'low'].includes(v.quality)) st.quality = v.quality;
          st.invertY = !!v.invertY;
        }
      }
    } catch (e) {
      /* 저장이 막힌 브라우저에서도 게임은 돼요 */
    }
  }
  function saveStore() {
    try {
      root.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      /* 저장 실패는 무시 */
    }
  }

  /* ---------------- 상태 ---------------- */
  let canvas = null;
  let R = null;
  let lv = null;
  let field = null;
  let fieldCell = -1;
  let fieldTimer = 0;

  const game = {
    state: 'boot', // title | playing | paused | dying | over
    time: 0,
    titleTime: 0,
    score: 0,
    combo: 0,
    lastKill: -99,
    pendingResume: false,
    hint: '',
    hintT: 0,
    autoScale: 1,
    slowFrames: 0,
    onStateChange: null,
  };
  const player = {};
  let enemies = [];
  let shots = [];
  let particles = [];
  let chunks = [];
  let pickups = [];
  let flashes = []; // 잠깐 켜지는 빛 (폭발, 출현)
  let wave = null;
  let stats = null;
  let nextId = 1;
  const muzzle = [0, 0, 0];
  const demo = [];

  const view = m4.create();
  const proj = m4.create();
  const camWorld = m4.create();

  /* ---------------- 플레이어 ---------------- */
  function resetPlayer() {
    Object.assign(player, {
      x: lv.player.x,
      y: 0,
      z: lv.player.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      hp: PL.maxHp,
      onGround: true,
      bobPhase: 0,
      bobAmt: 0,
      land: 0,
      hurt: 0,
      shake: 0,
      recoilDebt: 0,
      lastShot: -9,
      stepDist: 0,
      weapons: RU.WEAPONS.map((d) => ({ def: d, ammo: d.mag, reserve: d.reserve })),
      cur: 0,
      prev: 1,
      switchT: 0,
      switchTo: -1,
      reloading: false,
      reloadT: 0,
      reloadTotal: 1,
      fireT: 0,
      holdT: 0,
      bloom: 0,
      aim: 0,
      kick: 0,
      flashT: 0,
      sprint: 0,
      sprintLock: 0,
      swayX: 0,
      swayY: 0,
      deadT: 0,
    });
  }

  const curW = () => player.weapons[player.cur];

  function forward(yaw, pitch, out) {
    const cp = Math.cos(pitch);
    out[0] = -Math.sin(yaw) * cp;
    out[1] = Math.sin(pitch);
    out[2] = -Math.cos(yaw) * cp;
    return out;
  }
  const fwd = [0, 0, -1];
  const eye = [0, 0, 0];

  function eyePos() {
    eye[0] = player.x;
    eye[1] = player.y + PL.eye;
    eye[2] = player.z;
    return eye;
  }

  function updatePlayer(dt) {
    const st = store.settings;
    // 시점
    const zoomK = lerp(1, curW().def.zoom, player.aim);
    const ms = 0.0022 * st.sens * zoomK;
    const ts = 0.0055 * st.sens * zoomK;
    const inv = st.invertY ? -1 : 1;
    const lx = input.lookX * ms + input.touchLookX * ts;
    const ly = (input.lookY * ms + input.touchLookY * ts) * inv;
    let turn = 0, tilt = 0;
    if (input.down('ArrowLeft')) turn += 1;
    if (input.down('ArrowRight')) turn -= 1;
    if (input.down('ArrowUp')) tilt += 1;
    if (input.down('ArrowDown')) tilt -= 1;
    player.yaw -= lx;
    player.yaw += turn * 2.4 * dt * zoomK;
    player.pitch -= ly;
    player.pitch += tilt * 1.6 * dt * zoomK;
    player.pitch = clamp(player.pitch, -1.45, 1.45);
    player.swayX = damp(player.swayX, clamp(-lx * 6, -0.06, 0.06), 10, dt);
    player.swayY = damp(player.swayY, clamp(ly * 6, -0.05, 0.05), 10, dt);

    // 이동
    let f = 0, s = 0;
    if (input.down('KeyW')) f += 1;
    if (input.down('KeyS')) f -= 1;
    if (input.down('KeyD')) s += 1;
    if (input.down('KeyA')) s -= 1;
    f -= input.moveY;
    s += input.moveX;
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const wx = -sy * f + cy * s;
    const wz = -cy * f - sy * s;
    player.sprintLock -= dt;
    const wantSprint = (input.down('ShiftLeft') || input.down('ShiftRight') || input.touchSprint) && f > 0.3 && player.sprintLock <= 0 && player.aim < 0.5;
    player.sprint = damp(player.sprint, wantSprint ? 1 : 0, 8, dt);
    const speed = lerp(PL.walk, PL.sprint, player.sprint) * lerp(1, 0.6, player.aim);
    const accel = player.onGround ? 14 : 2.5;
    player.vx = damp(player.vx, wx * speed, accel, dt);
    player.vz = damp(player.vz, wz * speed, accel, dt);

    if (input.pressed.has('Space') && player.onGround) {
      player.vy = PL.jump;
      player.onGround = false;
    }
    player.vy -= PL.gravity * dt;

    LV.slide(lv, player, player.vx * dt, player.vz * dt, PL.radius, player.y);
    const wasAir = !player.onGround;
    const fallSpeed = player.vy;
    player.y += player.vy * dt;
    const ground = LV.maxHeightUnder(lv, player.x, player.z, PL.radius);
    if (player.y <= ground) {
      if (wasAir && fallSpeed < -4) {
        player.land = Math.min(1, -fallSpeed / 14);
        audio.play('land', null, 0.8);
      }
      player.y = ground;
      player.vy = 0;
      player.onGround = true;
    } else player.onGround = false;
    if (player.y + PL.height > LV.WALL_H) {
      player.y = LV.WALL_H - PL.height;
      if (player.vy > 0) player.vy = 0;
    }

    // 발소리와 화면 흔들림
    const hs = Math.hypot(player.vx, player.vz);
    player.bobAmt = damp(player.bobAmt, player.onGround ? Math.min(1, hs / PL.walk) : 0, 10, dt);
    if (player.onGround) {
      player.bobPhase += hs * dt * 1.55;
      player.stepDist += hs * dt;
      if (player.stepDist > 2.3) {
        player.stepDist = 0;
        audio.play('step', null, 0.7 + player.sprint * 0.4);
      }
    }
    player.land = damp(player.land, 0, 7, dt);
    player.hurt = damp(player.hurt, 0, 2.2, dt);
    player.shake = damp(player.shake, 0, 6, dt);
  }

  /* ---------------- 무기 ---------------- */
  function switchWeapon(i) {
    if (i < 0 || i >= player.weapons.length) return;
    if (player.switchTo === i || (player.switchTo < 0 && i === player.cur)) return;
    player.switchTo = i;
    player.switchT = 0.34;
    player.reloading = false;
    audio.play('swap');
  }

  function startReload() {
    const w = curW();
    if (player.reloading || player.switchTo >= 0 || w.ammo >= w.def.mag || w.reserve <= 0) return false;
    player.reloading = true;
    player.reloadT = player.reloadTotal = w.def.reload + (w.def.shellReload ? 0.2 : 0);
    audio.play('reload');
    return true;
  }

  function updateWeapon(dt) {
    player.fireT -= dt;
    player.holdT -= dt;
    // 무기 바꾸기
    for (let i = 0; i < player.weapons.length; i++) if (input.pressed.has('Digit' + (i + 1)) || input.pressed.has('Numpad' + (i + 1))) switchWeapon(i);
    if (input.pressed.has('KeyQ')) switchWeapon(player.switchTo >= 0 ? player.cur : player.prev);
    if (input.wheel) {
      const base = player.switchTo >= 0 ? player.switchTo : player.cur;
      const n = player.weapons.length;
      switchWeapon((((base + input.wheel) % n) + n) % n);
    }
    if (player.switchTo >= 0) {
      const before = player.switchT;
      player.switchT -= dt;
      if (before > 0.17 && player.switchT <= 0.17) {
        player.prev = player.cur;
        player.cur = player.switchTo;
      }
      if (player.switchT <= 0) {
        player.switchT = 0;
        player.switchTo = -1;
      }
    }
    const w = curW();
    const d = w.def;

    // 재장전
    if (player.reloading) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) {
        if (d.shellReload) {
          w.ammo++;
          w.reserve--;
          audio.play('shell');
          if (w.ammo < d.mag && w.reserve > 0) player.reloadT = player.reloadTotal = d.reload;
          else {
            player.reloading = false;
            audio.play('reloadEnd');
          }
        } else {
          const take = Math.min(d.mag - w.ammo, w.reserve);
          w.ammo += take;
          if (w.reserve !== Infinity) w.reserve -= take;
          player.reloading = false;
          audio.play('reloadEnd');
        }
      }
    }
    if (input.pressed.has('KeyR')) startReload();

    // 발사
    if (input.fire && player.switchTo < 0 && player.fireT <= 0 && (input.firePressed || player.holdT <= 0)) {
      if (w.ammo > 0 && (!player.reloading || d.shellReload)) {
        player.reloading = false;
        fire(w);
      } else if (w.ammo <= 0) {
        if (input.firePressed) audio.play('empty');
        startReload();
        player.fireT = 0.25;
      }
    }
    if (w.ammo === 0 && w.reserve > 0 && !player.reloading && player.switchTo < 0 && player.fireT < -0.2) startReload();

    player.bloom = damp(player.bloom, 0, 5, dt);
    const wantAim = (input.aim || input.aimToggle) && player.switchTo < 0 && !(player.reloading && !d.shellReload) && player.sprint < 0.5;
    player.aim = damp(player.aim, wantAim ? 1 : 0, 15, dt);
    player.kick = damp(player.kick, 0, 12, dt);
    player.flashT -= dt;
    if (game.time - player.lastShot > 0.14 && player.recoilDebt > 0) {
      const back = Math.min(player.recoilDebt, (player.recoilDebt * 6 + 0.02) * dt);
      player.pitch -= back;
      player.recoilDebt -= back;
    }
  }

  function fire(w) {
    const d = w.def;
    w.ammo--;
    player.fireT = d.fireDelay;
    player.holdT = d.holdDelay;
    player.lastShot = game.time;
    player.kick = 1;
    player.flashT = 0.06;
    player.sprintLock = 0.4;
    stats.shots++;
    audio.play(d.id);

    const e = eyePos();
    forward(player.yaw, player.pitch, fwd);
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const sp = Math.sin(player.pitch), cp = Math.cos(player.pitch);
    const right = [cy, 0, -sy];
    const up = [sy * sp, cp, cy * sp];
    const hs = Math.hypot(player.vx, player.vz);
    let cone = d.spread + player.bloom + hs * 0.0032 + (player.onGround ? 0 : 0.03);
    cone *= lerp(1, d.pellets > 1 ? 0.75 : 0.28, player.aim);

    const hits = new Map();
    for (let i = 0; i < d.pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * cone;
      const ox = Math.cos(a) * r, oy = Math.sin(a) * r;
      let dx = fwd[0] + right[0] * ox + up[0] * oy;
      let dy = fwd[1] + right[1] * ox + up[1] * oy;
      let dz = fwd[2] + right[2] * ox + up[2] * oy;
      const l = Math.hypot(dx, dy, dz);
      dx /= l;
      dy /= l;
      dz /= l;
      const res = trace(e[0], e[1], e[2], dx, dy, dz, d.range);
      const hx = e[0] + dx * res.t, hy = e[1] + dy * res.t, hz = e[2] + dz * res.t;
      if (res.enemy) {
        const dmg = RU.damageAt(d, res.t) * (res.crit ? d.headMul : 1);
        const h = hits.get(res.enemy) || { dmg: 0, crit: false, x: hx, y: hy, z: hz, dx, dz };
        h.dmg += dmg;
        h.crit = h.crit || res.crit;
        hits.set(res.enemy, h);
        sparks(hx, hy, hz, -dx, -dy, -dz, res.crit ? 7 : 4, [1, 0.6, 0.25], 5);
      } else if (res.wall) {
        const wl = res.wall;
        sparks(wl.x, wl.y, wl.z, wl.nx, wl.ny, wl.nz, d.pellets > 1 ? 2 : 5, [1, 0.8, 0.45], 4);
        puff(wl.x + wl.nx * 0.05, wl.y + wl.ny * 0.05, wl.z + wl.nz * 0.05);
        if (i === 0) audio.play('impact', { x: wl.x, z: wl.z }, 0.6);
      }
      if (d.tracer || (d.pellets > 1 && i < 3)) {
        emit({ kind: 'beam', x: muzzle[0], y: muzzle[1], z: muzzle[2], x2: hx, y2: hy, z2: hz, life: 0.05, size: d.tracer ? 0.035 : 0.02, r: 1, g: 0.85, b: 0.55, a: 0.8 });
      }
    }
    if (hits.size) {
      stats.hits++;
      let killed = false, crit = false;
      hits.forEach((h, en) => {
        crit = crit || h.crit;
        if (damageEnemy(en, h.dmg, h.crit, h.dx, h.dz)) killed = true;
      });
      hud.hit(killed ? 'kill' : crit ? 'crit' : 'hit');
      audio.play(crit ? 'crit' : 'hit', null, 0.9);
    }
    player.bloom = Math.min(d.maxSpread, player.bloom + d.bloom);
    const k = d.recoil * lerp(1, 0.6, player.aim) * (0.85 + Math.random() * 0.3);
    player.pitch = clamp(player.pitch + k, -1.45, 1.45);
    player.recoilDebt += k * 0.75;
    player.yaw += (Math.random() - 0.5) * d.recoil * 0.5;
  }

  /** 한 발의 궤적: 가장 먼저 닿는 적 또는 벽 */
  function trace(ox, oy, oz, dx, dy, dz, range) {
    const wall = LV.raycast(lv, ox, oy, oz, dx, dy, dz, range);
    let bestT = wall ? wall.t : range;
    let best = null, crit = false;
    for (const en of enemies) {
      if (en.spawnT < 1) continue;
      const r = RU.rayEnemy(ox, oy, oz, dx, dy, dz, en);
      if (r && r.t < bestT) {
        best = en;
        bestT = r.t;
        crit = r.crit;
      }
    }
    return { enemy: best, t: bestT, crit, wall: best ? null : wall };
  }

  /* ---------------- 적 ---------------- */
  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function pickSpawn() {
    const cands = lv.spawns.map((s) => ({ s, d: Math.hypot(s.x - player.x, s.z - player.z) }));
    const free = (c) => !enemies.some((e) => Math.hypot(e.x - c.s.x, e.z - c.s.z) < 1.4);
    let ok = cands.filter((c) => c.d > 14 && free(c) && !LV.lineOfSight(lv, c.s.x, 1.6, c.s.z, player.x, player.y + PL.eye, player.z));
    if (!ok.length) ok = cands.filter((c) => c.d > 9 && free(c));
    if (!ok.length) ok = cands.slice().sort((a, b) => b.d - a.d).slice(0, 2);
    return ok[Math.floor(Math.random() * ok.length)].s;
  }

  function spawnEnemy(type, at) {
    const def = RU.ENEMIES[type];
    const plan = wave.plan;
    const s = at || pickSpawn();
    const x = s.x + (at ? 0 : rnd(-0.4, 0.4)), z = s.z + (at ? 0 : rnd(-0.4, 0.4));
    const e = {
      id: nextId++,
      type,
      x,
      y: def.flying ? def.hover : 0,
      z,
      vx: 0,
      vz: 0,
      yaw: yawTo(player.x - x, player.z - z),
      hp: def.hp * plan.hpMul,
      maxHp: def.hp * plan.hpMul,
      spawnT: 0,
      flash: 0,
      los: false,
      losT: 0,
      fireT: rnd(def.fireEvery ? def.fireEvery[0] : 1, def.fireEvery ? def.fireEvery[1] : 2) * 0.6 + 0.8,
      windup: 0,
      burstLeft: 0,
      burstT: 0,
      gun: 1,
      atkT: 0.4,
      swingT: 0,
      swingHit: true,
      swing: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: rnd(1, 3),
      phase: 0,
      moveAmt: 0,
      seed: Math.random() * 100,
      tilt: 0,
      roll: 0,
      aimPitch: 0,
    };
    enemies.push(e);
    wave.spawned++;
    flashes.push({ x, y: 1.4, z, r: 0.2, g: 1.2, b: 1.6, radius: 8, life: 0.9, max: 0.9 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      emit({ x: x + Math.cos(a) * 0.7, y: rnd(0, 2.4), z: z + Math.sin(a) * 0.7, vx: -Math.cos(a) * 0.6, vy: rnd(0.5, 2), vz: -Math.sin(a) * 0.6, life: rnd(0.5, 0.9), size: rnd(0.08, 0.16), r: 0.35, g: 0.9, b: 1, a: 0.9 });
    }
    audio.play('spawn', e);
  }

  function enemyEyeY(e) {
    return e.type === 'drone' ? e.y : e.y + (e.type === 'brute' ? 2.2 : 1.6);
  }

  function updateEnemies(dt) {
    const plan = wave ? wave.plan : RU.wavePlan(1);
    // 길찾기 지도: 플레이어 칸이 바뀌거나 0.5초마다
    const pc = LV.cellOf(player.z) * lv.w + LV.cellOf(player.x);
    fieldTimer -= dt;
    if (pc !== fieldCell || fieldTimer <= 0) {
      field = LV.flowField(lv, player.x, player.z, field);
      fieldCell = pc;
      fieldTimer = 0.5;
    }
    const peY = player.y + PL.eye;
    for (const e of enemies) {
      const def = RU.ENEMIES[e.type];
      e.flash = Math.max(0, e.flash - dt);
      if (e.spawnT < 1) {
        e.spawnT = Math.min(1, e.spawnT + dt / 0.85);
        if (def.flying) e.y = def.hover + Math.sin(game.time * 2 + e.seed) * 0.12;
        continue;
      }
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const ey = enemyEyeY(e);
      e.losT -= dt;
      if (e.losT <= 0) {
        e.los = LV.lineOfSight(lv, e.x, ey, e.z, player.x, peY, player.z);
        // 상자 너머로 보여도 걸어서 곧장 갈 수 있는지는 따로 봐요
        e.walkClear = e.los && LV.lineOfSight(lv, e.x, 0.4, e.z, player.x, Math.max(0.4, player.y + 0.4), player.z);
        e.losT = rnd(0.12, 0.22);
      }
      const speed = def.speed * plan.speedMul;
      let mx = 0, mz = 0;
      const follow = () => {
        const step = LV.nextStep(lv, field, e.x, e.z);
        if (step && step.dist > 0) {
          const sx = step.x - e.x, sz = step.z - e.z;
          const l = Math.hypot(sx, sz) || 1;
          mx = sx / l;
          mz = sz / l;
        } else {
          mx = dx / dist;
          mz = dz / dist;
        }
      };

      if (def.attack === 'melee') {
        if (e.walkClear && dist < 14) {
          mx = dx / dist;
          mz = dz / dist;
        } else follow();
        const reach = def.reach + PL.radius;
        const vertical = player.y - e.y;
        e.atkT -= dt;
        if (dist < reach && vertical < 2.3 && e.atkT <= 0) {
          e.atkT = def.meleeEvery;
          e.swingT = 0.32;
          e.swingHit = false;
          audio.play('swing', e);
        }
        if (dist < reach * 0.7) {
          mx *= 0.2;
          mz *= 0.2;
        }
      } else {
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafe = -e.strafe;
          e.strafeT = rnd(1.2, 3);
        }
        if (e.los && dist < def.range) {
          const radial = dist > def.keepDist + 2 ? 1 : dist < def.keepDist - 2 ? -0.8 : 0;
          const ux = dx / dist, uz = dz / dist;
          mx = ux * radial - uz * e.strafe * 0.75;
          mz = uz * radial + ux * e.strafe * 0.75;
          e.fireT -= dt * (1 + 0.04 * (plan.wave - 1));
          if (e.fireT <= 0 && e.burstLeft <= 0 && e.windup <= 0) {
            e.windup = e.type === 'brute' ? 0.45 : 0.35;
            audio.play('charge', e, 0.8);
          }
        } else {
          follow();
          if (e.windup <= 0) e.fireT = Math.max(e.fireT, 0.4);
        }
        if (e.windup > 0) {
          e.windup -= dt;
          mx *= 0.3;
          mz *= 0.3;
          if (e.windup <= 0) {
            e.burstLeft = def.burst;
            e.burstT = 0;
            e.fireT = rnd(def.fireEvery[0], def.fireEvery[1]);
          }
        }
        if (e.burstLeft > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            enemyShoot(e, def, plan);
            e.burstLeft--;
            e.burstT = def.burstGap || 0;
          }
        }
      }

      // 칼날 휘두르기: 휘두르는 도중에 아직 가까우면 맞아요
      if (e.swingT > 0) {
        e.swingT -= dt;
        e.swing = Math.sin(clamp(1 - e.swingT / 0.32, 0, 1) * Math.PI);
        if (!e.swingHit && e.swingT < 0.16) {
          e.swingHit = true;
          if (dist < def.reach + PL.radius + 0.4 && player.y - e.y < 2.3) hurtPlayer(def.meleeDamage * plan.dmgMul, e.x, e.z);
        }
      } else e.swing = 0;

      // 서로 겹치지 않게
      for (const o of enemies) {
        if (o === e || o.spawnT < 1) continue;
        const ox = e.x - o.x, oz = e.z - o.z;
        const od = Math.hypot(ox, oz);
        const min = def.radius + RU.ENEMIES[o.type].radius;
        if (od < min && od > 1e-4) {
          mx += (ox / od) * (min - od) * 2.5;
          mz += (oz / od) * (min - od) * 2.5;
        }
      }
      e.vx = damp(e.vx, mx * speed, 7, dt);
      e.vz = damp(e.vz, mz * speed, 7, dt);
      const feet = def.flying ? e.y - 0.4 : 0;
      const hit = LV.slide(lv, e, e.vx * dt, e.vz * dt, def.radius, feet);
      if ((hit.hitX || hit.hitZ) && def.attack !== 'melee') e.strafe = -e.strafe;
      // 플레이어와 겹치지 않게 적을 밀어내요
      const pdx = e.x - player.x, pdz = e.z - player.z;
      const pd = Math.hypot(pdx, pdz);
      const pmin = def.radius + PL.radius + 0.3;
      if (pd < pmin && pd > 1e-4 && Math.abs(player.y - e.y) < 1.6) LV.slide(lv, e, (pdx / pd) * (pmin - pd), (pdz / pd) * (pmin - pd), def.radius, feet);

      const ms = Math.hypot(e.vx, e.vz);
      e.moveAmt = ms / def.speed;
      e.phase += ms * dt * (e.type === 'brute' ? 1.6 : 2.4);
      const faceYaw = e.los || def.attack === 'melee' ? yawTo(dx, dz) : ms > 0.3 ? yawTo(e.vx, e.vz) : e.yaw;
      e.yaw += angleDiff(e.yaw, faceYaw) * Math.min(1, (def.attack === 'melee' ? 12 : 7) * dt);
      if (def.flying) {
        e.y = damp(e.y, def.hover + Math.sin(game.time * 2 + e.seed) * 0.15, 4, dt);
        const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
        const fv = -sy * e.vx - cy * e.vz;
        const rv = cy * e.vx - sy * e.vz;
        e.tilt = damp(e.tilt, -fv * 0.06, 6, dt);
        e.roll = damp(e.roll, -rv * 0.08, 6, dt);
      }
      if (e.type === 'brute') e.aimPitch = Math.atan2(peY - 0.4 - (e.y + 1.48), dist) * 0.8;
    }
  }

  function enemyShoot(e, def, plan) {
    const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
    let ox, oy, oz;
    if (e.type === 'brute') {
      e.gun = -e.gun;
      ox = e.x - sy * 0.95 + cy * 0.86 * e.gun;
      oy = e.y + 1.48;
      oz = e.z - cy * 0.95 - sy * 0.86 * e.gun;
    } else {
      ox = e.x - sy * 0.45;
      oy = e.y;
      oz = e.z - cy * 0.45;
    }
    // 중장갑은 움직임을 조금 예측해서 쏴요
    const tx0 = player.x, ty = player.y + 1.15, tz0 = player.z;
    const flight = Math.hypot(tx0 - ox, tz0 - oz) / def.shotSpeed;
    const lead = e.type === 'brute' ? 0.55 : 0.15;
    const err = 0.35 + Math.hypot(tx0 - ox, tz0 - oz) * 0.02;
    const tx = tx0 + player.vx * flight * lead + rnd(-err, err);
    const tz = tz0 + player.vz * flight * lead + rnd(-err, err);
    const dx = tx - ox, dy = ty + rnd(-0.25, 0.25) - oy, dz = tz - oz;
    const l = Math.hypot(dx, dy, dz) || 1;
    const col = e.type === 'brute' ? [1, 0.55, 0.12] : [1, 0.22, 0.15];
    shots.push({
      x: ox,
      y: oy,
      z: oz,
      vx: (dx / l) * def.shotSpeed,
      vy: (dy / l) * def.shotSpeed,
      vz: (dz / l) * def.shotSpeed,
      dmg: def.shotDamage * plan.dmgMul,
      life: 4,
      col,
      size: e.type === 'brute' ? 0.5 : 0.38,
    });
    flashes.push({ x: ox, y: oy, z: oz, r: col[0] * 1.5, g: col[1] * 1.5, b: col[2] * 1.5, radius: 5, life: 0.08, max: 0.08 });
    audio.play(e.type === 'brute' ? 'heavyZap' : 'zap', e);
  }

  /** 적에게 피해. 쓰러뜨리면 true */
  function damageEnemy(e, dmg, crit, dx, dz) {
    e.hp -= dmg;
    e.flash = 0.09;
    e.vx += dx * (e.type === 'brute' ? 0.4 : 2.2);
    e.vz += dz * (e.type === 'brute' ? 0.4 : 2.2);
    e.losT = 0;
    if (e.hp > 0) return false;
    killEnemy(e, crit);
    return true;
  }

  function killEnemy(e, crit) {
    const def = RU.ENEMIES[e.type];
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
    if (game.time - game.lastKill <= RU.COMBO_WINDOW) game.combo++;
    else game.combo = 1;
    game.lastKill = game.time;
    const pts = RU.killScore(e.type, crit, game.combo);
    game.score += pts;
    stats.kills++;
    if (crit) stats.crits++;
    if (wave) wave.killed++;
    hud.feed((crit ? '치명타! ' : '') + def.name + ' 처치 +' + pts, crit ? 'crit' : '');
    const cy = e.type === 'drone' ? e.y : e.y + (e.type === 'brute' ? 1.4 : 1.0);
    explosion(e.x, cy, e.z, def.color, e.type === 'brute' ? 1.8 : 1);
    audio.play(e.type === 'brute' ? 'bigExplode' : 'explode', e);
    const tints = { drone: [0.34, 0.36, 0.4], runner: [0.3, 0.31, 0.33], brute: [0.46, 0.38, 0.16] };
    const n = e.type === 'brute' ? 12 : 7;
    for (let k = 0; k < n; k++) {
      chunks.push({
        x: e.x + rnd(-0.3, 0.3),
        y: cy + rnd(-0.3, 0.3),
        z: e.z + rnd(-0.3, 0.3),
        vx: rnd(-4, 4),
        vy: rnd(2, 7),
        vz: rnd(-4, 4),
        rx: rnd(0, 6),
        ry: rnd(0, 6),
        wx: rnd(-10, 10),
        wy: rnd(-10, 10),
        s: rnd(0.1, e.type === 'brute' ? 0.32 : 0.2),
        tint: tints[e.type],
        hot: 1,
        life: rnd(2.5, 4),
      });
    }
    // 아이템 떨어뜨리기
    const dropChance = e.type === 'brute' ? 0.9 : 0.16;
    if (Math.random() < dropChance) {
      const needHealth = player.hp < PL.maxHp * 0.6;
      const kind = needHealth ? (Math.random() < 0.7 ? 'health' : 'ammo') : Math.random() < 0.35 ? 'health' : 'ammo';
      pickups.push({ x: e.x, z: e.z, kind, active: true, spot: false, life: 20, baseY: LV.maxHeightUnder(lv, e.x, e.z, 0.1) });
    }
  }

  /* ---------------- 적 탄 ---------------- */
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      let dead = false;
      for (let k = 0; k < 2 && !dead; k++) {
        const h = dt / 2;
        s.x += s.vx * h;
        s.y += s.vy * h;
        s.z += s.vz * h;
        s.life -= h;
        if (s.life <= 0) dead = true;
        else if (s.y < 0.02 || s.y > LV.WALL_H - 0.02 || LV.heightAtPos(lv, s.x, s.z) > s.y) {
          dead = true;
          sparks(s.x - s.vx * 0.01, s.y - s.vy * 0.01, s.z - s.vz * 0.01, -s.vx, -s.vy, -s.vz, 6, s.col, 3);
          flashes.push({ x: s.x, y: s.y, z: s.z, r: s.col[0], g: s.col[1], b: s.col[2], radius: 4, life: 0.12, max: 0.12 });
        } else if (game.state === 'playing') {
          const hx = s.x - player.x, hz = s.z - player.z;
          if (Math.hypot(hx, hz) < PL.radius + 0.24 && s.y > player.y - 0.1 && s.y < player.y + PL.height + 0.1) {
            dead = true;
            hurtPlayer(s.dmg, s.x - s.vx, s.z - s.vz);
            sparks(s.x, s.y, s.z, -s.vx, 0, -s.vz, 5, s.col, 3);
          }
        }
      }
      if (dead) {
        shots[i] = shots[shots.length - 1];
        shots.pop();
      }
    }
  }

  function hurtPlayer(dmg, sx, sz) {
    if (game.state !== 'playing') return;
    player.hp -= dmg;
    player.hurt = Math.min(1, player.hurt + dmg / 22);
    player.shake = Math.min(1, player.shake + dmg / 28);
    stats.taken += dmg;
    hud.damageFrom(yawTo(sx - player.x, sz - player.z));
    audio.play('hurt');
    if (player.hp <= 0) {
      player.hp = 0;
      die();
    }
  }

  /* ---------------- 아이템 ---------------- */
  function usePickup(p) {
    if (p.kind === 'health') {
      if (player.hp >= PL.maxHp) return false;
      const before = player.hp;
      player.hp = Math.min(PL.maxHp, player.hp + RU.PICKUPS.health.amount);
      hud.feed('체력 +' + Math.round(player.hp - before), 'good');
    } else {
      let got = false;
      for (const w of player.weapons) {
        const add = RU.PICKUPS.ammo[w.def.id];
        if (!add || w.reserve >= w.def.maxReserve) continue;
        w.reserve = Math.min(w.def.maxReserve, w.reserve + add);
        got = true;
      }
      if (!got) return false;
      hud.feed('탄약 보급: 소총 +' + RU.PICKUPS.ammo.rifle + ' · 산탄 +' + RU.PICKUPS.ammo.shotgun, 'ammo');
    }
    audio.play('pickup');
    return true;
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (!p.active) {
        p.t -= dt;
        if (p.t <= 0) p.active = true;
        continue;
      }
      if (!p.spot) {
        p.life -= dt;
        if (p.life <= 0) {
          pickups.splice(i, 1);
          continue;
        }
      }
      const near = Math.hypot(p.x - player.x, p.z - player.z) < 1.05 && Math.abs(player.y - (p.baseY || 0)) < 1.3;
      if (near && usePickup(p)) {
        if (p.spot) {
          p.active = false;
          p.t = RU.PICKUPS[p.kind].respawn;
        } else pickups.splice(i, 1);
      }
    }
  }

  /* ---------------- 효과 ---------------- */
  function emit(p) {
    if (particles.length >= 1400) return;
    p.max = p.life;
    if (p.vx === undefined) p.vx = 0;
    if (p.vy === undefined) p.vy = 0;
    if (p.vz === undefined) p.vz = 0;
    particles.push(p);
  }

  function sparks(x, y, z, nx, ny, nz, n, col, speed) {
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (let i = 0; i < n; i++) {
      const s = speed * rnd(0.4, 1.2);
      emit({
        kind: 'spark',
        x,
        y,
        z,
        vx: (nx + rnd(-0.7, 0.7)) * s,
        vy: (ny + rnd(-0.3, 0.9)) * s,
        vz: (nz + rnd(-0.7, 0.7)) * s,
        grav: 14,
        life: rnd(0.15, 0.4),
        size: 0.03,
        r: col[0],
        g: col[1],
        b: col[2],
        a: 1,
        bounce: true,
      });
    }
    emit({ x: x + nx * 0.05, y: y + ny * 0.05, z: z + nz * 0.05, life: 0.06, size: 0.35, r: col[0], g: col[1], b: col[2], a: 0.9 });
  }

  function puff(x, y, z) {
    emit({ layer: 'alpha', x, y, z, vx: rnd(-0.2, 0.2), vy: rnd(0.2, 0.5), vz: rnd(-0.2, 0.2), life: rnd(0.5, 0.8), size: 0.18, size1: 0.6, r: 0.42, g: 0.42, b: 0.44, a: 0.4 });
  }

  function explosion(x, y, z, col, k) {
    flashes.push({ x, y: y + 0.3, z, r: 2.4 * col[0], g: 1.6 * col[1] + 0.4, b: 0.6, radius: 10 * k, life: 0.35, max: 0.35 });
    emit({ x, y, z, life: 0.18, size: 2.2 * k, size1: 3.2 * k, r: 1, g: 0.75, b: 0.45, a: 1 });
    for (let i = 0; i < 18 * k; i++) {
      const a = Math.random() * Math.PI * 2, b = rnd(-0.3, 1);
      const s = rnd(3, 9) * Math.sqrt(k);
      emit({ kind: 'spark', x, y, z, vx: Math.cos(a) * s, vy: b * s, vz: Math.sin(a) * s, grav: 12, life: rnd(0.3, 0.8), size: 0.04, r: 1, g: rnd(0.5, 0.8), b: 0.3, a: 1, bounce: true });
    }
    for (let i = 0; i < 10 * k; i++) {
      emit({ x: x + rnd(-0.4, 0.4) * k, y: y + rnd(-0.3, 0.4) * k, z: z + rnd(-0.4, 0.4) * k, vx: rnd(-1.5, 1.5), vy: rnd(0, 2), vz: rnd(-1.5, 1.5), life: rnd(0.25, 0.5), size: rnd(0.6, 1.1) * k, size1: 0.2, r: col[0], g: col[1] * 0.8 + 0.2, b: 0.15, a: 0.9 });
    }
    for (let i = 0; i < 8 * k; i++) {
      emit({ layer: 'alpha', x: x + rnd(-0.5, 0.5), y: y + rnd(-0.2, 0.5), z: z + rnd(-0.5, 0.5), vx: rnd(-0.6, 0.6), vy: rnd(0.4, 1.4), vz: rnd(-0.6, 0.6), life: rnd(1, 1.8), size: 0.5 * k, size1: 1.8 * k, r: 0.12, g: 0.12, b: 0.13, a: 0.55 });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      if (p.kind === 'beam') continue;
      if (p.grav) p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce && p.y < 0.02) {
        p.y = 0.02;
        p.vy *= -0.4;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
    }
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      c.life -= dt;
      c.hot = Math.max(0, c.hot - dt * 0.8);
      if (c.life <= 0) {
        chunks[i] = chunks[chunks.length - 1];
        chunks.pop();
        continue;
      }
      c.vy -= 18 * dt;
      const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
      if (LV.heightAtPos(lv, nx, nz) > c.y) {
        c.vx *= -0.4;
        c.vz *= -0.4;
      } else {
        c.x = nx;
        c.z = nz;
      }
      c.y += c.vy * dt;
      const g = LV.heightAtPos(lv, c.x, c.z) + c.s * 0.35;
      if (c.y < g) {
        c.y = g;
        c.vy *= -0.3;
        c.vx *= 0.6;
        c.vz *= 0.6;
        c.wx *= 0.6;
        c.wy *= 0.6;
      }
      c.rx += c.wx * dt;
      c.ry += c.wy * dt;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
  }

  /* ---------------- 웨이브 ---------------- */
  function startWave(n) {
    const plan = RU.wavePlan(n);
    wave = { n, plan, queue: RU.spawnOrder(plan), spawned: 0, killed: 0, phase: 'intro', timer: 2.6, spawnT: 0 };
    let sub = '적 ' + plan.total + '기가 다가와요';
    if (n === 1) sub = '경비 로봇이 몰려와요. 원자로 홀을 지키세요';
    else if (n === 3) sub = '중장갑 로봇 출현! 적 ' + plan.total + '기';
    hud.banner('WAVE ' + n, sub, 2.6);
    audio.play('alarm');
  }

  function updateWave(dt) {
    if (!wave) return;
    if (wave.phase === 'intro') {
      wave.timer -= dt;
      if (wave.timer <= 0) wave.phase = 'fight';
    } else if (wave.phase === 'fight') {
      wave.spawnT -= dt;
      if (wave.queue.length && wave.spawnT <= 0 && enemies.length < wave.plan.maxAlive) {
        spawnEnemy(wave.queue.shift());
        wave.spawnT = wave.plan.spawnGap;
      }
      if (!wave.queue.length && !enemies.length) {
        wave.phase = 'clear';
        wave.timer = 5;
        stats.waves = wave.n;
        game.score += wave.plan.clearBonus;
        const before = player.hp;
        player.hp = Math.min(PL.maxHp, player.hp + 20);
        for (const w of player.weapons) if (w.reserve !== Infinity) w.reserve = Math.min(w.def.maxReserve, w.reserve + Math.ceil(w.def.mag * 0.5));
        hud.banner('웨이브 ' + wave.n + ' 클리어', '+' + wave.plan.clearBonus + '점 · 체력 +' + Math.round(player.hp - before) + ' · 탄약 보급', 3.2);
        audio.play('clear');
      }
    } else if (wave.phase === 'clear') {
      wave.timer -= dt;
      if (wave.timer <= 0) startWave(wave.n + 1);
    }
  }

  /* ---------------- 상태 바꾸기 ---------------- */
  function setState(s) {
    game.state = s;
    input.active = s === 'playing';
    if (game.onStateChange) game.onStateChange(s);
  }

  function newRun() {
    resetPlayer();
    enemies = [];
    shots = [];
    particles = [];
    chunks = [];
    flashes = [];
    pickups = lv.pickups.map((p) => ({ x: p.x, z: p.z, kind: p.kind, active: true, spot: true, t: 0, baseY: 0 }));
    stats = { shots: 0, hits: 0, kills: 0, crits: 0, taken: 0, waves: 0, started: game.time };
    game.score = 0;
    game.combo = 0;
    game.lastKill = -99;
    fieldCell = -1;
    wave = null;
    muzzle[0] = player.x;
    muzzle[1] = player.y + PL.eye - 0.2;
    muzzle[2] = player.z;
    hud.reset();
  }

  function start() {
    audio.unlock();
    audio.ambient(true);
    newRun();
    hud.show(true);
    setState('playing');
    startWave(1);
    if (!input.touch && !input.dragLook) input.requestLock();
  }

  function pause() {
    if (game.state !== 'playing') return;
    input.clearHeld();
    setState('paused');
    input.exitLock();
  }

  /** 다시 하기: 마우스를 잠글 수 있으면 잠근 다음에 이어 가요 */
  function resume() {
    if (game.state !== 'paused') return;
    audio.unlock();
    if (!input.touch && !input.dragLook && !input.locked) {
      game.pendingResume = true;
      input.requestLock();
      return;
    }
    setState('playing');
  }

  function die() {
    setState('dying');
    player.deadT = 0;
    audio.play('die');
    input.clearHeld();
  }

  function finish() {
    stats.time = game.time - stats.started;
    const result = {
      score: game.score,
      wave: wave ? wave.n : 1,
      waves: stats.waves,
      kills: stats.kills,
      crits: stats.crits,
      accuracy: stats.shots ? stats.hits / stats.shots : 0,
      time: stats.time,
      best: false,
    };
    if (result.score > 0 && (!store.best || result.score > store.best.score)) {
      result.best = true;
      store.best = { score: result.score, wave: result.wave, kills: result.kills, at: Date.now() };
      saveStore();
    }
    game.result = result;
    audio.ambient(false);
    input.exitLock();
    hud.show(false);
    setState('over');
  }

  function quit() {
    audio.ambient(false);
    input.exitLock();
    hud.show(false);
    enemies = [];
    shots = [];
    particles = [];
    chunks = [];
    flashes = [];
    setState('title');
  }

  /* ---------------- 한 프레임 ---------------- */
  function update(dt) {
    game.time += dt;
    if (input.pressed.has('Escape') || input.pressed.has('KeyP') || input.pressed.has('Pause')) {
      // 마우스가 잠겨 있으면 잠금이 풀리면서 일시정지돼요
      if (input.locked) input.exitLock();
      else pause();
      return;
    }
    if (game.hintT > 0) game.hintT -= dt;
    updatePlayer(dt);
    updateWeapon(dt);
    updateWave(dt);
    updateEnemies(dt);
    updateShots(dt);
    updatePickups(dt);
    updateParticles(dt);
    audio.setListener(player.x, player.z, player.yaw);
  }

  function updateDying(dt) {
    game.time += dt;
    player.deadT += dt;
    updateEnemies(dt);
    updateShots(dt);
    updateParticles(dt);
    player.hurt = Math.max(player.hurt, 0.6);
    if (player.deadT > 2.2) finish();
  }

  /* ---------------- 그리기 ---------------- */
  const lightList = [];
  function gatherLights(ex, ey, ez, t) {
    lightList.length = 0;
    const dyn = [];
    if (player.flashT > 0 && game.state !== 'title') {
      const k = player.flashT / 0.06;
      dyn.push({ x: muzzle[0] + fwd[0] * 0.3, y: muzzle[1], z: muzzle[2] + fwd[2] * 0.3, r: 2.4 * k, g: 1.6 * k, b: 0.8 * k, radius: 10, d: 0 });
    }
    for (const f of flashes) {
      const k = f.life / f.max;
      dyn.push({ x: f.x, y: f.y, z: f.z, r: f.r * k, g: f.g * k, b: f.b * k, radius: f.radius, d: Math.hypot(f.x - ex, f.z - ez) });
    }
    for (const s of shots) dyn.push({ x: s.x, y: s.y, z: s.z, r: s.col[0] * 1.3, g: s.col[1] * 1.3, b: s.col[2] * 1.3, radius: 4.5, d: Math.hypot(s.x - ex, s.z - ez) + 2 });
    dyn.sort((a, b) => a.d - b.d);
    const maxDyn = 5;
    for (let i = 0; i < dyn.length && lightList.length < maxDyn; i++) lightList.push(dyn[i]);
    // 고정 조명: 가까운 것부터. 경계에 있는 조명은 서서히 켜져서 깜빡임이 없어요
    const lamps = lv.lamps.map((l) => ({ l, d: Math.hypot(l.x - ex, l.y - ey, l.z - ez) })).sort((a, b) => a.d - b.d);
    const slots = R.MAXL - lightList.length;
    const cutoff = lamps[slots] ? lamps[slots].d : Infinity;
    for (let i = 0; i < Math.min(slots, lamps.length); i++) {
      const { l, d } = lamps[i];
      let k = Math.min(1, (cutoff - d) / 4);
      // 격납고 조명은 가끔 깜빡여요
      if (l.color[0] > 1.2) k *= 0.82 + 0.18 * Math.sin(t * 13 + l.x) * Math.sin(t * 7.3 + l.z);
      lightList.push({ x: l.x, y: l.y, z: l.z, r: l.color[0] * k, g: l.color[1] * k, b: l.color[2] * k, radius: 14 });
    }
    return lightList;
  }

  const VM_AMB = [0.55, 0.57, 0.62];
  const frameData = {
    view,
    proj,
    cam: [0, 0, 0],
    lights: null,
    spot: { pos: [0, 0, 0], dir: [0, 0, -1], col: [0.55, 0.56, 0.52] },
    amb: [0.2, 0.22, 0.27],
    fogCol: [0.03, 0.04, 0.055],
    fogDen: 0.038,
  };

  function resize() {
    const dpr = root.devicePixelRatio || 1;
    const q = store.settings.quality;
    let scale = q === 'high' ? Math.min(dpr, 2) : q === 'low' ? Math.min(dpr, 1) * 0.6 : Math.min(dpr, 1.25) * game.autoScale;
    if (input.touch && q === 'auto') scale *= 0.8;
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    R.resize(w, h);
  }

  function render(dt, t) {
    resize();
    const W = canvas.width, H = canvas.height;
    let ex, ey, ez, yaw, pitch, roll = 0;
    const playingView = game.state !== 'title';
    if (!playingView) {
      const a = t * 0.07;
      ex = 32 + Math.sin(a) * 10.5;
      ez = 32 + Math.cos(a) * 10.5;
      ey = 2.6 + Math.sin(t * 0.3) * 0.3;
      yaw = yawTo(32 - ex, 32 - ez) + 0.5;
      pitch = -0.08;
    } else {
      const bob = Math.sin(player.bobPhase * 2) * 0.035 * player.bobAmt;
      ex = player.x;
      ez = player.z;
      ey = player.y + PL.eye + bob - player.land * 0.12;
      const sh = player.shake * 0.03;
      yaw = player.yaw + (Math.random() - 0.5) * sh;
      pitch = player.pitch + (Math.random() - 0.5) * sh;
      if (game.state === 'dying' || game.state === 'over') {
        const k = Math.min(1, player.deadT / 0.9);
        ey = lerp(ey, player.y + 0.35, k * k);
        roll = k * 0.5;
        pitch = lerp(pitch, 0.1, k);
      }
    }
    m4.identity(view);
    if (roll) m4.rotateZ(view, -roll);
    m4.rotateX(view, -pitch);
    m4.rotateY(view, -yaw);
    m4.translate(view, -ex, -ey, -ez);
    m4.identity(camWorld);
    m4.translate(camWorld, ex, ey, ez);
    m4.rotateY(camWorld, yaw);
    m4.rotateX(camWorld, pitch);
    if (roll) m4.rotateZ(camWorld, roll);
    forward(yaw, pitch, fwd);

    const w = playingView ? curW() : null;
    const fovDeg = store.settings.fov * (w ? lerp(1, w.def.zoom, player.aim) : 1);
    m4.perspective(proj, (fovDeg * Math.PI) / 180, W / H, 0.04, 100);

    frameData.cam = [ex, ey, ez];
    frameData.lights = gatherLights(ex, ey, ez, t);
    frameData.spot.pos = [ex, ey, ez];
    frameData.spot.dir = [fwd[0], fwd[1], fwd[2]];
    frameData.spot.col = playingView ? [0.45, 0.46, 0.43] : [0, 0, 0];
    R.frame(frameData);
    R.drawWorld();

    for (const p of pickups) if (p.active) models.pickup(p, t);
    if (playingView) for (const e of enemies) models.enemy(e, t);
    else for (const e of demo) models.enemy(e, t);
    for (const c of chunks) models.debris(c);

    // 빛 효과
    for (const p of particles) {
      const k = p.life / p.max;
      if (p.kind === 'beam') {
        R.beam('add', p.x, p.y, p.z, p.x2, p.y2, p.z2, p.size, p.r, p.g, p.b, p.a * k);
        continue;
      }
      if (p.kind === 'spark') {
        R.beam('add', p.x, p.y, p.z, p.x - p.vx * 0.025, p.y - p.vy * 0.025, p.z - p.vz * 0.025, p.size, p.r, p.g, p.b, p.a * k);
        continue;
      }
      const size = p.size1 !== undefined ? lerp(p.size1, p.size, k) : p.size;
      R.sprite(p.layer || 'add', p.x, p.y, p.z, size, p.r, p.g, p.b, p.a * (p.layer === 'alpha' ? k : Math.min(1, k * 1.5)));
    }
    for (const s of shots) {
      R.sprite('add', s.x, s.y, s.z, s.size * 2.2, s.col[0], s.col[1], s.col[2], 0.55);
      R.sprite('add', s.x, s.y, s.z, s.size * 0.7, 1, 0.95, 0.85, 1);
      R.beam('add', s.x, s.y, s.z, s.x - s.vx * 0.04, s.y - s.vy * 0.04, s.z - s.vz * 0.04, s.size * 0.5, s.col[0], s.col[1], s.col[2], 0.6);
    }
    for (const p of pickups) {
      if (!p.active) continue;
      const c = p.kind === 'health' ? [0.25, 1, 0.5] : [1, 0.7, 0.15];
      R.sprite('add', p.x, 0.5 + (p.baseY || 0), p.z, 1.6, c[0], c[1], c[2], 0.16 + 0.05 * Math.sin(t * 3 + p.x));
    }
    const list = playingView ? enemies : demo;
    for (const e of list) {
      if (e.type === 'drone') {
        const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
        for (const s of [-1, 1]) R.sprite('add', e.x + cy * 0.47 * s, e.y - 0.2, e.z - sy * 0.47 * s, 0.5, 1, 0.5, 0.15, 0.5);
      }
      if (e.spawnT < 1) {
        const k = 1 - e.spawnT;
        R.beam('add', e.x, 0, e.z, e.x, 3.6, e.z, 1.4 * k + 0.2, 0.3, 0.85, 1, 0.5 * k);
      }
    }
    R.drawFx('alpha');
    R.drawFx('add');

    // 손에 든 총
    if (playingView && (game.state === 'playing' || game.state === 'paused')) {
      R.clearDepth();
      R.setAmbient(VM_AMB);
      const g = models.GUNS[w.def.id];
      const a = player.aim;
      const sinceShot = game.time - player.lastShot;
      const off = [lerp(g.hip[0], g.ads[0], a), lerp(g.hip[1], g.ads[1], a), lerp(g.hip[2], g.ads[2], a)];
      const bobK = player.bobAmt * (1 - a * 0.85);
      off[0] += Math.sin(player.bobPhase) * 0.012 * bobK + player.swayX * 0.5;
      off[1] += -Math.abs(Math.cos(player.bobPhase)) * 0.014 * bobK + player.swayY * 0.5 - player.land * 0.03;
      let tilt = 0, rollV = 0, yawV = 0;
      // 달릴 때 총을 내려요
      off[0] += player.sprint * 0.04;
      off[1] -= player.sprint * 0.04;
      tilt -= player.sprint * 0.35;
      yawV += player.sprint * 0.5;
      // 무기 바꾸기: 내렸다가 올리기
      if (player.switchTo >= 0) {
        const k = player.switchT > 0.17 ? (0.34 - player.switchT) / 0.17 : player.switchT / 0.17;
        off[1] -= k * 0.25;
        tilt -= k * 0.7;
      }
      // 재장전 동작
      if (player.reloading) {
        const pr = 1 - player.reloadT / player.reloadTotal;
        const dip = w.def.shellReload ? 0.6 + 0.4 * Math.sin(pr * Math.PI) : Math.sin(pr * Math.PI);
        off[1] -= dip * 0.06;
        rollV += dip * (w.def.shellReload ? 0.25 : 0.55);
        tilt += dip * 0.2;
      }
      const kickK = w.def.id === 'shotgun' ? 1.6 : w.def.id === 'pistol' ? 1.25 : 0.6;
      const pump = w.def.id === 'shotgun' && sinceShot > 0.22 && sinceShot < 0.62 ? Math.sin(((sinceShot - 0.22) / 0.4) * Math.PI) : 0;
      models.viewmodel(camWorld, { id: w.def.id, offset: off, kick: player.kick * kickK, tilt, roll: rollV, yaw: yawV, pump }, muzzle);
      if (player.flashT > 0) {
        const k = player.flashT / 0.06;
        const big = w.def.id === 'shotgun' ? 1.6 : w.def.id === 'pistol' ? 1 : 0.85;
        const mx = muzzle[0] + fwd[0] * 0.05, my = muzzle[1] + fwd[1] * 0.05, mz = muzzle[2] + fwd[2] * 0.05;
        R.sprite('overlay', mx, my, mz, 0.32 * big * (0.8 + Math.random() * 0.4), 1, 0.7, 0.35, 0.95 * k);
        R.sprite('overlay', mx, my, mz, 0.12 * big, 1, 0.95, 0.85, k);
        R.beam('overlay', mx, my, mz, mx + fwd[0] * 0.25 * big, my + fwd[1] * 0.25 * big, mz + fwd[2] * 0.25 * big, 0.1 * big, 1, 0.75, 0.4, 0.7 * k);
      }
      R.drawFx('overlay');
    } else R.resetFx();
  }

  /** HUD에 넘길 값 */
  function snapshot() {
    const w = curW();
    const plan = wave && wave.plan;
    const fovRad = (store.settings.fov * lerp(1, w.def.zoom, player.aim) * Math.PI) / 180;
    const hs = Math.hypot(player.vx, player.vz);
    let cone = w.def.spread + player.bloom + hs * 0.0032 + (player.onGround ? 0 : 0.03);
    cone *= lerp(1, w.def.pellets > 1 ? 0.75 : 0.28, player.aim);
    const spreadPx = (Math.tan(cone) / Math.tan(fovRad / 2)) * (canvas.clientHeight / 2);
    return {
      score: game.score,
      combo: game.time - game.lastKill <= RU.COMBO_WINDOW ? game.combo : 0,
      comboMul: RU.comboMul(game.combo),
      wave: wave ? wave.n : 1,
      left: wave ? wave.queue.length + enemies.length : 0,
      hp: player.hp,
      maxHp: PL.maxHp,
      ammo: w.ammo,
      reserve: w.reserve,
      weaponName: w.def.name,
      weaponId: w.def.id,
      caliber: w.def.caliber,
      slot: player.switchTo >= 0 ? player.switchTo : player.cur,
      spreadPx,
      aim: player.aim,
      reloading: player.reloading,
      reloadPct: player.reloading ? 1 - player.reloadT / player.reloadTotal : 0,
      hurt: player.hurt,
      time: game.time,
      yaw: player.yaw,
      px: player.x,
      pz: player.z,
      enemies: enemies.filter((e) => e.spawnT >= 1 && Math.hypot(e.x - player.x, e.z - player.z) < 26),
      pickups: pickups.filter((p) => p.active),
      touch: input.touch,
      hint: game.hintT > 0 ? game.hint : '',
      plan,
    };
  }

  function hint(msg, sec) {
    game.hint = msg;
    game.hintT = sec || 4;
  }

  let lastNow = 0;
  function loop(now) {
    root.requestAnimationFrame(loop);
    let dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
    lastNow = now;
    // 느린 기기는 해상도를 조금씩 낮춰요 (자동 화질)
    if (store.settings.quality === 'auto' && game.state === 'playing') {
      if (dt > 0.026) game.slowFrames++;
      else game.slowFrames = Math.max(0, game.slowFrames - 1);
      if (game.slowFrames > 90 && game.autoScale > 0.5) {
        game.autoScale = Math.max(0.5, game.autoScale - 0.1);
        game.slowFrames = 0;
      }
    }
    dt = Math.min(dt, 0.05);
    if (game.state === 'playing') update(dt);
    else if (game.state === 'dying') updateDying(dt);
    else if (game.state === 'title') {
      game.titleTime += dt;
      updateDemo(dt);
    }
    try {
      render(dt, game.state === 'title' ? game.titleTime : game.time);
    } catch (e) {
      if (!R.gl.isContextLost()) throw e;
    }
    if (game.state === 'playing' || game.state === 'dying' || game.state === 'paused') hud.update(snapshot(), dt);
    input.endFrame();
  }

  /* ---------------- 첫 화면 배경 ---------------- */
  function setupDemo() {
    const base = { spawnT: 1, flash: 0, windup: 0, swing: 0, moveAmt: 0, phase: 0, tilt: 0, roll: 0, aimPitch: 0 };
    demo.push(Object.assign({ type: 'brute', x: 32, y: 0, z: 39.5, yaw: 0.2, seed: 1 }, base));
    demo.push(Object.assign({ type: 'runner', x: 27.5, y: 0, z: 37, yaw: -0.5, seed: 2 }, base));
    demo.push(Object.assign({ type: 'drone', x: 27, y: 2.1, z: 29, yaw: 0, seed: 3, orbit: 0 }, base));
    demo.push(Object.assign({ type: 'drone', x: 37, y: 2.4, z: 33, yaw: 0, seed: 4, orbit: 2.4 }, base));
  }
  function updateDemo(dt) {
    const t = game.titleTime;
    for (const e of demo) {
      if (e.type === 'drone') {
        const a = t * 0.35 + e.orbit;
        const nx = 32 + Math.cos(a) * 6.5, nz = 32 + Math.sin(a) * 6.5;
        e.yaw = yawTo(nx - e.x, nz - e.z);
        e.x = nx;
        e.z = nz;
        e.y = 2.2 + Math.sin(t * 2 + e.seed) * 0.15;
        e.roll = 0.18;
      } else {
        e.phase += dt * 0.6;
        e.yaw += Math.sin(t * 0.4 + e.seed) * dt * 0.2;
      }
    }
  }

  /* ---------------- 시작 ---------------- */
  function init(opts) {
    canvas = opts.canvas;
    loadStore();
    R = SZ.renderer.create(canvas);
    if (!R) return false;
    models.bind(R);
    lv = LV.create();
    R.setLevel(lv);
    hud.init();
    hud.setLevel(lv);
    input.init(canvas, opts.touchRoot);
    audio.setVolume(store.settings.volume);
    resetPlayer();
    pickups = lv.pickups.map((p) => ({ x: p.x, z: p.z, kind: p.kind, active: true, spot: true, t: 0, baseY: 0 }));
    setupDemo();
    input.onLockChange = (locked) => {
      if (locked) {
        if (game.state === 'paused' && game.pendingResume) {
          game.pendingResume = false;
          setState('playing');
        }
      } else if (game.state === 'playing' && !input.dragLook && !input.touch) pause();
    };
    input.onLockError = () => {
      game.pendingResume = false;
      if (!input.everLocked) {
        // 포인터 잠금을 못 쓰는 곳: 마우스를 누른 채 끌어서 둘러봐요
        input.dragLook = true;
        if (game.state === 'paused') setState('playing');
        if (game.state === 'playing') hint('마우스를 누른 채 끌어서 둘러보세요 · Esc 일시정지', 6);
      } else if (game.onLockRetry) game.onLockRetry();
    };
    canvas.addEventListener('click', () => {
      if (game.state === 'playing' && !input.locked && !input.dragLook && !input.touch) input.requestLock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
    setState('title');
    root.requestAnimationFrame(loop);
    return true;
  }

  Object.assign(game, {
    init,
    start,
    pause,
    resume,
    quit,
    store,
    saveStore,
    DEFAULTS,
    player,
    resize: () => R && resize(),
    // 테스트·디버그용
    _debug: () => ({ enemies, shots, pickups, wave, stats, lv }),
    _spawn: (type, x, z) => spawnEnemy(type, { x, z }),
  });
  SZ.game = game;
})(window);

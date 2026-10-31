// 경기장 3D 표현: 타일(붕괴 연출), 중앙 단상, 높은 플랫폼, 움직이는 발판, 회전 막대, 바람 효과.
import * as THREE from 'three';
import { TILES, TILE, RAISED, MOVERS, moverState, DAIS, activeEvent, sweeperAngle, moversActive } from '../../../shared/src/arena.js';
import { SWEEPER } from '../../../shared/src/constants.js';
import { toon, addOutline } from '../game/materials.js';

const RING_COLORS = [
  [0x9b8cff, 0x9b8cff],
  [0x6fe3c4, 0xc8fff0],
  [0xffd84f, 0xffefa8],
  [0xff8fa8, 0xffd0dc],
];
const SIDE_COLORS = [0x6a5acd, 0x3fb39a, 0xe6a622, 0xe0607e];

function sectorShape(r0, r1, a0, a1, gapR, gapA) {
  const s = new THREE.Shape();
  const A0 = a0 + gapA, A1 = a1 - gapA;
  const R0 = r0 + gapR, R1 = r1 - gapR;
  const seg = Math.max(4, Math.ceil((A1 - A0) * R1 * 1.2));
  for (let i = 0; i <= seg; i++) {
    const a = A0 + ((A1 - A0) * i) / seg;
    s[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * R1, -Math.sin(a) * R1);
  }
  for (let i = seg; i >= 0; i--) {
    const a = A0 + ((A1 - A0) * i) / seg;
    s.lineTo(Math.cos(a) * R0, -Math.sin(a) * R0);
  }
  return s;
}

function stripeTexture(c1, c2) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 16;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ArenaView {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.tiles = [];
    this.lastTiles = null;
    this.buildTiles();
    this.buildMovers();
    this.buildSweeper();
    this.buildWind();
    this.onCrumble = null;
  }

  buildTiles() {
    const rockMat = toon(0x9a7462, { flatShading: true });
    const rockMat2 = toon(0x7d5c50, { flatShading: true });
    const thick = 0.9;
    for (const t of TILES) {
      const group = new THREE.Group();
      const topColor = RING_COLORS[t.ring][t.sector % 2];
      const topMat = toon(topColor, { unique: true, emissive: 0x000000 });
      const sideMat = toon(SIDE_COLORS[t.ring]);
      let mesh;
      if (t.ring === 0) {
        // 경사가 있는 중앙 단상 (선반 회전체)
        const pts = [];
        pts.push(new THREE.Vector2(0.001, DAIS.top));
        for (let i = 0; i <= 24; i++) {
          const r = DAIS.flatR + ((t.r1 - 0.06 - DAIS.flatR) * i) / 24;
          const k = Math.min(1, Math.max(0, (r - DAIS.flatR) / (DAIS.slopeR - DAIS.flatR)));
          pts.push(new THREE.Vector2(r, DAIS.top * 0.5 * (1 + Math.cos(Math.PI * k))));
        }
        pts.push(new THREE.Vector2(t.r1 - 0.06, -thick * 0.5));
        pts.push(new THREE.Vector2(t.r1 - 0.3, -thick));
        pts.push(new THREE.Vector2(0.001, -thick));
        mesh = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 48), topMat);
        // 단상 장식
        const ring = new THREE.Mesh(new THREE.TorusGeometry(DAIS.flatR - 0.3, 0.12, 8, 48), toon(0xffffff));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = DAIS.top + 0.02;
        group.add(ring);
        const star = new THREE.Mesh(new THREE.CircleGeometry(1.1, 5), toon(0xffd23f));
        star.rotation.x = -Math.PI / 2;
        star.rotation.z = Math.PI / 2;
        star.position.y = DAIS.top + 0.015;
        group.add(star);
        const under = new THREE.Mesh(new THREE.ConeGeometry(5.6, 9, 9), rockMat);
        under.rotation.x = Math.PI;
        under.position.y = -thick - 4.4;
        group.add(under);
      } else {
        const shape = sectorShape(t.r0, t.r1, t.a0, t.a1, 0.07, 0.006);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: thick - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, -thick + 0.08, 0);
        mesh = new THREE.Mesh(geo, [topMat, sideMat]);
        // 타일 아래 바위 덩어리
        const am = (t.a0 + t.a1) / 2, rm = (t.r0 + t.r1) / 2;
        const size = Math.min(t.r1 - t.r0, (t.a1 - t.a0) * rm) * 0.5;
        const rock = new THREE.Mesh(new THREE.ConeGeometry(size, 1.6 + size * 1.6, 6), t.sector % 2 ? rockMat : rockMat2);
        rock.rotation.x = Math.PI;
        rock.position.set(Math.cos(am) * rm, -thick - 0.7 - size * 0.8, Math.sin(am) * rm);
        group.add(rock);
      }
      mesh.receiveShadow = true;
      group.add(mesh);
      // 소속된 높은 플랫폼
      for (const p of RAISED) {
        if (p.tile !== t.index) continue;
        const colMat = toon(p.top > 1 ? 0x5ec8ff : 0xff9a3c);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, p.top + 0.02, 28), [toon(p.top > 1 ? 0x2f8fd8 : 0xd8742a), colMat, colMat]);
        col.position.set(p.x, p.top / 2, p.z);
        col.castShadow = true;
        col.receiveShadow = true;
        group.add(col);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r - 0.05, 0.09, 6, 32), toon(0xffffff));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(p.x, p.top + 0.02, p.z);
        group.add(rim);
      }
      this.root.add(group);
      this.tiles.push({ def: t, group, topMat, baseColor: new THREE.Color(topColor), state: TILE.OK, y: 0, vy: 0, rot: 0, hidden: false });
    }
  }

  buildMovers() {
    this.movers = MOVERS.map((m, i) => {
      const g = new THREE.Group();
      const top = toon(i ? 0x52d273 : 0xa66bff);
      const side = toon(0xffffff);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(m.r, m.r * 0.92, m.thick, 32), [side, top, toon(0xdedde8)]);
      disc.position.y = -m.thick / 2;
      disc.castShadow = true;
      disc.receiveShadow = true;
      g.add(disc);
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(m.r - 0.3, 0.1, 6, 32), toon(0xffd23f));
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.01;
      g.add(stripe);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(m.r * 0.6, 1.4, 12), toon(0xdedde8));
      cone.rotation.x = Math.PI;
      cone.position.y = -m.thick - 0.7;
      g.add(cone);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(m.r * 0.5, 0.18, 6, 24), new THREE.MeshBasicMaterial({ color: 0x8ff7ff }));
      glow.rotation.x = Math.PI / 2;
      glow.position.y = -m.thick - 1.3;
      g.add(glow);
      g.userData.glow = glow;
      this.root.add(g);
      return g;
    });
  }

  buildSweeper() {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.TorusGeometry(SWEEPER.r0 - 0.1, 0.22, 8, 64), toon(0xff4d5e));
    hub.rotation.x = Math.PI / 2;
    hub.position.y = 0.15;
    g.add(hub);
    const tex = stripeTexture('#ff4d5e', '#ffffff');
    tex.repeat.set(4, 1);
    const armMat = toon(0xffffff, { map: tex });
    const len = SWEEPER.r1 - SWEEPER.r0;
    for (let k = 0; k < 2; k++) {
      const arm = new THREE.Group();
      const h = SWEEPER.y1 - SWEEPER.y0;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(SWEEPER.halfWidth, SWEEPER.halfWidth, len, 12), armMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(SWEEPER.r0 + len / 2, SWEEPER.y0 + h / 2, 0);
      bar.scale.set(1, 1, h / (SWEEPER.halfWidth * 2));
      bar.castShadow = true;
      addOutline(bar, 0.04);
      arm.add(bar);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), toon(0xffd23f));
      knob.position.set(SWEEPER.r1, SWEEPER.y0 + h / 2, 0);
      arm.add(knob);
      arm.rotation.y = -k * Math.PI;
      g.add(arm);
    }
    g.visible = false;
    this.sweeper = g;
    this.root.add(g);
  }

  buildWind() {
    const n = this.quality === 'low' ? 60 : 140;
    const pos = new Float32Array(n * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.windLines = new THREE.LineSegments(geo, mat);
    this.windLines.frustumCulled = false;
    this.windSeeds = Array.from({ length: n }, () => ({ u: Math.random() * 60 - 30, v: Math.random() * 60 - 30, y: Math.random() * 4 + 0.2, len: 1 + Math.random() * 2.5, sp: 18 + Math.random() * 14 }));
    this.root.add(this.windLines);
  }

  /** 서버 타일 상태 반영 */
  setTiles(states) {
    for (let i = 0; i < this.tiles.length; i++) {
      const v = states[i] | 0;
      const tile = this.tiles[i];
      if (tile.state === v) continue;
      if (v === TILE.GONE && tile.state !== TILE.GONE) {
        tile.vy = 0;
        tile.rot = (Math.random() - 0.5) * 0.6;
        if (this.onCrumble) this.onCrumble(tile.def);
      }
      if (v !== TILE.GONE && tile.state === TILE.GONE) {
        tile.y = -18;
        tile.group.visible = true;
        tile.group.rotation.set(0, 0, 0);
        tile.hidden = false;
      }
      tile.state = v;
    }
  }

  /** 전체 초기화 (새 경기) */
  reset() {
    for (const tile of this.tiles) {
      tile.state = TILE.OK;
      tile.y = 0;
      tile.vy = 0;
      tile.group.visible = true;
      tile.group.position.set(0, 0, 0);
      tile.group.rotation.set(0, 0, 0);
      tile.topMat.emissive.setRGB(0, 0, 0);
      tile.hidden = false;
    }
  }

  update(dt, world, time) {
    // 타일
    for (const tile of this.tiles) {
      const g = tile.group;
      if (tile.state === TILE.GONE) {
        if (tile.hidden) continue;
        tile.vy -= 22 * dt;
        tile.y += tile.vy * dt;
        g.position.y = tile.y;
        g.rotation.x += tile.rot * dt;
        g.rotation.z += tile.rot * 0.5 * dt;
        if (tile.y < -70) { g.visible = false; tile.hidden = true; }
        tile.topMat.emissive.setRGB(0, 0, 0);
      } else {
        if (tile.y < 0) { tile.y = Math.min(0, tile.y + (0 - tile.y) * Math.min(1, dt * 4) + dt); }
        g.position.y = tile.y;
        if (tile.state === TILE.WARN) {
          const f = 0.5 + 0.5 * Math.sin(time * 18);
          tile.topMat.emissive.setRGB(0.9 * f, 0.15 * f, 0.05 * f);
          g.position.x = (Math.random() - 0.5) * 0.06;
          g.position.z = (Math.random() - 0.5) * 0.06;
        } else {
          tile.topMat.emissive.setRGB(0, 0, 0);
          g.position.x = 0;
          g.position.z = 0;
        }
      }
    }

    // 움직이는 발판
    const active = moversActive(world);
    const ms = {};
    for (let i = 0; i < MOVERS.length; i++) {
      const g = this.movers[i];
      moverState(MOVERS[i], world.t, ms);
      if (active) {
        g.visible = true;
        g.position.set(ms.x, ms.top, ms.z);
        g.userData.away = 0;
      } else if (g.visible) {
        g.userData.away = (g.userData.away || 0) + dt;
        g.position.y -= g.userData.away * 30 * dt;
        if (g.position.y < -60) g.visible = false;
      }
      g.userData.glow.material.color.setHSL(0.5, 1, 0.6 + 0.2 * Math.sin(time * 6 + i));
    }

    // 회전 막대: 공지 시간 동안 아래에서 올라오고, 끝나면 내려간다
    let sw = null;
    for (const e of world.events) if (e.type === 'sweeper' && world.t >= e.announce && world.t < e.end + 1) sw = e;
    if (sw) {
      this.sweeper.visible = true;
      let rise = 0;
      if (world.t < sw.start) rise = 1 - (world.t - sw.announce) / (sw.start - sw.announce);
      else if (world.t > sw.end) rise = world.t - sw.end;
      this.sweeper.position.y = -2.5 * Math.min(1, Math.max(0, rise));
      const a = world.t >= sw.start ? sweeperAngle(sw, world.t) : sw.phase || 0;
      this.sweeper.rotation.y = -a;
    } else this.sweeper.visible = false;

    // 바람
    const wind = activeEvent(world, 'wind');
    let windOn = null;
    for (const e of world.events) if (e.type === 'wind' && world.t >= e.announce && world.t < e.end) windOn = e;
    const target = wind ? 0.75 : windOn ? 0.25 : 0;
    const mat = this.windLines.material;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 3);
    this.windLines.visible = mat.opacity > 0.01;
    if (this.windLines.visible && windOn) {
      const dx = Math.cos(windOn.angle), dz = Math.sin(windOn.angle);
      const px = -dz, pz = dx;
      const arr = this.windLines.geometry.attributes.position.array;
      this.windSeeds.forEach((s, i) => {
        s.u += s.sp * dt * (wind ? 1 : 0.4);
        if (s.u > 30) s.u -= 60;
        const x = dx * s.u + px * s.v, z = dz * s.u + pz * s.v;
        arr[i * 6] = x; arr[i * 6 + 1] = s.y; arr[i * 6 + 2] = z;
        arr[i * 6 + 3] = x - dx * s.len; arr[i * 6 + 4] = s.y; arr[i * 6 + 5] = z - dz * s.len;
      });
      this.windLines.geometry.attributes.position.needsUpdate = true;
    }
  }
}

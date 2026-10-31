// 레이스 코스 3D 표현: 박스(정지/이동/경사), 범퍼, 회전 막대, 체크포인트 깃발, 결승 아치
import * as THREE from 'three';
import { RACE, boxCenter } from '../../../shared/src/course.js';
import { toon, addOutline } from '../game/materials.js';

function stripeTexture(c1, c2, n = 8) {
  const cv = document.createElement('canvas');
  cv.width = 16 * n; cv.height = 16;
  const g = cv.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function checkerTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#222' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function darker(hex, k = 0.72) { return new THREE.Color(hex).multiplyScalar(k).getHex(); }

export class CourseView {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.moving = [];
    this.sweepers = [];
    this.bumpers = [];
    const c = RACE;
    const _c = {};
    for (const b of c.boxes) {
      const h = b.y1 - b.y0;
      const geo = new THREE.BoxGeometry(b.w * 2, h, b.d * 2, 1, 1, b.ramp ? 8 : 1);
      if (b.ramp) {
        // 윗면 정점을 경사에 맞게 내린다
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) > 0) {
            const k = (pos.getZ(i) + b.d) / (b.d * 2);
            const top = b.ramp.h0 + (b.ramp.h1 - b.ramp.h0) * k;
            pos.setY(i, top - b.y0 - h / 2);
          }
        }
        geo.computeVertexNormals();
      }
      const top = toon(b.color), side = toon(darker(b.color));
      const mesh = new THREE.Mesh(geo, [side, side, top, side, side, side]);
      mesh.position.set(b.x, b.y0 + h / 2, b.z);
      mesh.castShadow = !!b.wall || !!b.move;
      mesh.receiveShadow = true;
      if (b.wall) addOutline(mesh, 0.04);
      this.root.add(mesh);
      // 바닥 아래 바위 장식
      if (!b.move && b.w * b.d > 10) {
        const rock = new THREE.Mesh(new THREE.ConeGeometry(Math.min(b.w, b.d) * 0.9, 5, 7), toon(0x9a7462));
        rock.rotation.x = Math.PI;
        rock.position.set(b.x, b.y0 - 2.5, b.z);
        this.root.add(rock);
      }
      if (b.move) {
        // 경고 줄무늬로 움직이는 물체 강조
        if (!b.wall) {
          const edge = new THREE.Mesh(new THREE.BoxGeometry(b.w * 2 + 0.05, 0.12, b.d * 2 + 0.05), toon(0xffffff, { map: stripeTexture('#2b2d42', '#ffd23f') }));
          edge.position.y = h / 2 - 0.08;
          mesh.add(edge);
        }
        this.moving.push({ b, mesh, h });
      }
      boxCenter(b, 0, _c);
    }
    for (const m of c.bumpers) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(m.r, m.r * 1.05, m.top, 24), toon(m.push > 0 ? 0xff4d6d : 0xdedde8));
      body.position.y = m.top / 2;
      body.castShadow = true;
      addOutline(body, 0.04);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(m.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(m.push > 0 ? 0xffd23f : 0xffffff));
      cap.position.y = m.top;
      g.add(body, cap);
      g.position.set(m.x, 0, m.z);
      this.root.add(g);
      this.bumpers.push({ m, g, pulse: 0 });
    }
    const armTex = stripeTexture('#ff4d5e', '#ffffff');
    armTex.repeat.set(3, 1);
    for (const s of c.sweepers) {
      const g = new THREE.Group();
      const len = s.r1 - s.r0;
      for (let k = 0; k < 2; k++) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(s.half, s.half, len, 10), toon(0xffffff, { map: armTex }));
        arm.rotation.z = Math.PI / 2;
        arm.position.set(s.r0 + len / 2, (s.y0 + s.y1) / 2, 0);
        arm.scale.set(1, 1, (s.y1 - s.y0) / (s.half * 2));
        arm.castShadow = true;
        addOutline(arm, 0.05);
        const holder = new THREE.Group();
        holder.rotation.y = -k * Math.PI;
        holder.add(arm);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), toon(0xffd23f));
        knob.position.set(s.r1, (s.y0 + s.y1) / 2, 0);
        holder.add(knob);
        g.add(holder);
      }
      g.position.set(s.x, s.base, s.z);
      this.root.add(g);
      this.sweepers.push({ s, g });
    }
    // 체크포인트 깃발
    for (let i = 1; i < c.checkpoints.length; i++) {
      const cp = c.checkpoints[i];
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), toon(0xffffff));
        pole.position.set(sx * 6.6, cp.y + 1.5, cp.z + 0.3);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), toon(0x3fa7ff, { side: THREE.DoubleSide }));
        flag.position.set(sx * 6.6 - sx * 0.55, cp.y + 2.6, cp.z + 0.3);
        this.root.add(pole, flag);
      }
    }
    // 결승 아치 + 체커 라인
    const fz = c.finishZ;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.2), toon(0xffffff, { map: (() => { const t = checkerTexture(); t.repeat.set(8, 0.6); return t; })() }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 3.02, fz);
    this.root.add(line);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.45, 10, 40, Math.PI), toon(0xff4d6d));
    arch.position.set(0, 3, fz);
    addOutline(arch, 0.04);
    this.root.add(arch);
    const sign = document.createElement('canvas');
    sign.width = 512; sign.height = 128;
    const sg = sign.getContext('2d');
    sg.fillStyle = '#ffd23f'; sg.fillRect(0, 0, 512, 128);
    sg.fillStyle = '#24264a'; sg.font = 'bold 84px "Black Han Sans", Jua, sans-serif'; sg.textAlign = 'center'; sg.fillText('GOAL', 256, 100);
    const signTex = new THREE.CanvasTexture(sign);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
    board.position.set(0, 10.3, fz);
    this.root.add(board);
  }

  bump(x, z) {
    for (const b of this.bumpers) if (Math.hypot(b.m.x - x, b.m.z - z) < b.m.r + 1.5) b.pulse = 1;
  }

  update(dt, world) {
    if (!this.root.visible) return;
    const _c = {};
    for (const mv of this.moving) {
      boxCenter(mv.b, world.t, _c);
      mv.mesh.position.x = _c.x;
      mv.mesh.position.z = _c.z;
    }
    for (const sw of this.sweepers) sw.g.rotation.y = -(world.t * sw.s.speed * sw.s.dir + sw.s.phase);
    for (const b of this.bumpers) {
      b.pulse = Math.max(0, b.pulse - dt * 4);
      const k = 1 + Math.sin(b.pulse * Math.PI) * 0.18;
      b.g.scale.set(k, 1 / k, k);
    }
  }
}

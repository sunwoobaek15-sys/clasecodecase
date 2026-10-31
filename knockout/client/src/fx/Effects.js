// 파티클(충돌/착지/탈락/우승 색종이)과 대시 잔상. 객체 풀을 사용해 GC를 최소화한다.
import * as THREE from 'three';

const MAX = 600;

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    this.scale = quality === 'low' ? 0.5 : 1;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: false });
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.parts = [];
    this.free = [];
    for (let i = 0; i < MAX; i++) {
      this.parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.2, grav: 10, drag: 1, color: new THREE.Color(), spin: 0 });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this.cursor = 0;

    // 링 효과 (착지/충돌 충격파)
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, max: 0.4, size: 1 });
    }
    // 대시 잔상
    this.ghosts = [];
  }

  spawn(x, y, z, o) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = o.vx; p.vy = o.vy; p.vz = o.vz;
    p.life = 0;
    p.max = o.life || 0.6;
    p.size = o.size || 0.15;
    p.grav = o.grav ?? 12;
    p.drag = o.drag ?? 1.5;
    p.color.set(o.color ?? 0xffffff);
    p.spin = Math.random() * 10;
  }

  burst(x, y, z, { count = 16, speed = 6, color = 0xffffff, colors = null, size = 0.15, life = 0.6, up = 2, grav = 12 } = {}) {
    const n = Math.max(2, Math.round(count * this.scale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, {
        vx: Math.cos(a) * r * s, vy: u * s * 0.6 + up, vz: Math.sin(a) * r * s,
        color: colors ? colors[i % colors.length] : color, size: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), grav,
      });
    }
  }

  ring(x, y, z, { size = 2, color = 0xffffff, life = 0.35 } = {}) {
    const r = this.rings.find((q) => !q.mesh.visible) || this.rings[0];
    r.mesh.visible = true;
    r.mesh.position.set(x, y + 0.05, z);
    r.mesh.material.color.set(color);
    r.t = 0; r.max = life; r.size = size;
  }

  hit(x, y, z, power, dash) {
    const k = Math.min(2, power / 10);
    this.burst(x, y, z, { count: 14 + k * 14, speed: 5 + k * 5, colors: dash ? [0xffd23f, 0xff4d6d, 0xffffff] : [0xffffff, 0xfff3a0], size: 0.12 + k * 0.06, life: 0.45 });
    this.ring(x, y - 0.6, z, { size: 1.5 + k * 1.5, color: dash ? 0xffd23f : 0xffffff });
  }

  land(x, y, z, strength = 1) {
    this.burst(x, y + 0.05, z, { count: 8 * strength, speed: 3, color: 0xf3efe6, size: 0.12, life: 0.4, up: 1, grav: 4 });
    this.ring(x, y, z, { size: 1 + strength * 0.5, color: 0xffffff, life: 0.3 });
  }

  elim(x, y, z, color) {
    this.burst(x, y, z, { count: 40, speed: 12, colors: [color, 0xffffff, 0xffd23f], size: 0.3, life: 1.2, up: 6, grav: 8 });
  }

  confetti(x, y, z) {
    this.burst(x, y + 3, z, { count: 60, speed: 9, colors: [0xff4d6d, 0x3fa7ff, 0xffd23f, 0x52d273, 0xa66bff], size: 0.13, life: 2.2, up: 7, grav: 6 });
  }

  /** 대시 잔상: 캐릭터 실루엣을 반투명으로 복제해 남긴다 */
  ghost(character, color) {
    if (this.scale < 1 && Math.random() < 0.5) return;
    let g = this.ghosts.find((q) => !q.mesh.visible);
    if (!g) {
      if (this.ghosts.length > 24) return;
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 4, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false }));
      this.scene.add(mesh);
      g = { mesh, t: 0 };
      this.ghosts.push(g);
    }
    g.mesh.material.color.set(color);
    const tor = character.torso;
    tor.getWorldPosition(this._p);
    tor.getWorldQuaternion(this._q);
    tor.getWorldScale(this._s);
    g.mesh.position.copy(this._p);
    g.mesh.quaternion.copy(this._q);
    g.mesh.scale.copy(this._s);
    g.mesh.visible = true;
    g.t = 0;
  }

  update(dt) {
    let n = 0;
    const m = this._m;
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      p.vy -= p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      const s = p.size * (0.3 + 0.7 * k);
      p.spin += dt * 6;
      this._e.set(p.spin, p.spin * 0.7, 0);
      this._q.setFromEuler(this._e);
      this._s.set(s, s, s);
      this._p.set(p.x, p.y, p.z);
      m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.max;
      if (k >= 1) { r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(0.3 + k * r.size);
      r.mesh.material.opacity = 0.8 * (1 - k);
    }
    for (const g of this.ghosts) {
      if (!g.mesh.visible) continue;
      g.t += dt;
      g.mesh.material.opacity = 0.45 * (1 - g.t / 0.3);
      if (g.t > 0.3) g.mesh.visible = false;
    }
  }
}

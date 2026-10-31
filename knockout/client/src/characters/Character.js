// 둥근 카툰 캐릭터: 계층형 3D 모델 + 절차적 애니메이션 (걷기/달리기/점프/대시/넉백/넘어짐/탈락/승리)
import * as THREE from 'three';
import { toon, addOutline } from '../game/materials.js';
import { colorHex } from '../../../shared/src/looks.js';
import { buildHat, buildOutfit, buildAccessory } from './Cosmetics.js';

const sphere = new THREE.SphereGeometry(1, 20, 14);
const bodyGeo = new THREE.CapsuleGeometry(0.5, 0.5, 8, 20);
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);

const white = toon(0xffffff);
const black = new THREE.MeshBasicMaterial({ color: 0x1d1f3a });
const blush = new THREE.MeshBasicMaterial({ color: 0xff8fb0, transparent: true, opacity: 0.7 });

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), k);
  return c.getHex();
}
function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

export class Character {
  constructor({ id, name, look, isLocal = false, castShadow = false }) {
    this.id = id;
    this.isLocal = isLocal;
    this.root = new THREE.Group();
    this.look = null;
    this.name = name;
    this.status = '';
    this.castShadow = castShadow;

    // 애니메이션 상태
    this.walkPhase = Math.random() * 10;
    this.squash = 1; this.squashV = 0;
    this.tumble = 0;
    this.leanX = 0; this.leanZ = 0;
    this.prevGrounded = true;
    this.emote = null;
    this.emoteT = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.time = Math.random() * 100;
    this.fallT = 0;
    this.outT = -1;

    this.build();
    this.setLook(look);
    this.setLabel(name, '');
  }

  build() {
    const r = this.root;
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    // 그림자는 월드 좌표로 따로 배치 (지면 높이에 붙임)
    this.shadowHolder = this.shadow;

    this.body = new THREE.Group(); // 기울기/스쿼시 피벗 (발바닥)
    r.add(this.body);

    this.torso = new THREE.Mesh(bodyGeo, white);
    this.torso.position.y = 0.92;
    this.torso.castShadow = this.castShadow;
    this.outline = addOutline(this.torso, 0.06);
    this.body.add(this.torso);

    this.belly = new THREE.Mesh(sphere, white);
    this.belly.scale.set(0.36, 0.4, 0.2);
    this.belly.position.set(0, 0.72, 0.36);
    this.body.add(this.belly);

    // 얼굴
    this.face = new THREE.Group();
    this.face.position.set(0, 1.18, 0.45);
    this.body.add(this.face);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.17, 0, 0);
      const w = new THREE.Mesh(sphere, white);
      w.scale.set(0.13, 0.16, 0.08);
      const p = new THREE.Mesh(sphere, black);
      p.scale.set(0.07, 0.09, 0.05);
      p.position.z = 0.055;
      const hl = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.scale.setScalar(0.025);
      hl.position.set(0.025, 0.035, 0.1);
      eye.add(w, p, hl);
      this.face.add(eye);
      this.eyes.push(eye);
      const ch = new THREE.Mesh(sphere, blush);
      ch.scale.set(0.07, 0.04, 0.02);
      ch.position.set(sx * 0.29, -0.13, -0.02);
      this.face.add(ch);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), black);
    this.mouth.rotation.z = Math.PI;
    this.mouth.position.set(0, -0.12, 0.02);
    this.face.add(this.mouth);

    // 팔 (어깨 피벗)
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.5, 1.0, 0);
      const hand = new THREE.Mesh(sphere, white);
      hand.scale.setScalar(0.15);
      hand.position.set(sx * 0.12, -0.32, 0);
      hand.castShadow = this.castShadow;
      addOutline(hand, 0.12);
      pivot.add(hand);
      pivot.userData.hand = hand;
      pivot.userData.side = sx;
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    // 다리 (엉덩이 피벗)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.22, 0.4, 0);
      const foot = new THREE.Mesh(sphere, white);
      foot.scale.set(0.17, 0.13, 0.24);
      foot.position.set(0, -0.3, 0.06);
      foot.castShadow = this.castShadow;
      addOutline(foot, 0.1);
      pivot.add(foot);
      pivot.userData.foot = foot;
      pivot.userData.side = sx;
      this.root.add(pivot);
      this.legs.push(pivot);
    }

    this.hatAnchor = new THREE.Group();
    this.hatAnchor.position.y = 1.62;
    this.body.add(this.hatAnchor);
    this.outfitAnchor = new THREE.Group();
    this.body.add(this.outfitAnchor);
    this.accAnchor = new THREE.Group();
    this.body.add(this.accAnchor);

    // 이름표
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 256; this.labelCanvas.height = 96;
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTex, depthTest: false, transparent: true }));
    this.label.scale.set(2.4, 0.9, 1);
    this.label.position.y = 2.45;
    this.label.renderOrder = 10;
    this.root.add(this.label);
  }

  setLook(look) {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.look = look;
    const base = colorHex(look.color);
    const bodyMat = toon(base);
    const bellyMat = toon(lighten(base, 0.45));
    const handMat = toon(lighten(base, 0.15));
    this.torso.material = bodyMat;
    this.belly.material = bellyMat;
    for (const a of this.arms) a.userData.hand.material = handMat;
    const footMat = toon(new THREE.Color(base).multiplyScalar(0.72).getHex());
    for (const l of this.legs) l.userData.foot.material = footMat;
    for (const anchor of [this.hatAnchor, this.outfitAnchor, this.accAnchor]) anchor.clear();
    const hat = buildHat(look.hat, base);
    if (hat) this.hatAnchor.add(hat);
    const outfit = buildOutfit(look.outfit, base);
    if (outfit) this.outfitAnchor.add(outfit);
    const acc = buildAccessory(look.acc, base);
    if (acc) this.accAnchor.add(acc);
    this.propeller = hat && hat.userData.spin;
    this.cape = outfit && outfit.userData.cape;
  }

  setLabel(name, status, color = '#ffffff') {
    if (name === this.name && status === this.status && this.labelDrawn) return;
    this.name = name;
    this.status = status;
    this.labelDrawn = true;
    const g = this.labelCanvas.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.font = '34px Jua, sans-serif';
    g.textAlign = 'center';
    const w = Math.min(240, g.measureText(name).width + 34);
    g.fillStyle = this.isLocal ? 'rgba(255,77,109,0.9)' : 'rgba(20,24,60,0.62)';
    roundRect(g, 128 - w / 2, 46, w, 44, 22);
    g.fillStyle = '#fff';
    g.fillText(name, 128, 80, 230);
    if (status) {
      g.font = '26px Jua, sans-serif';
      const sw = g.measureText(status).width + 22;
      g.fillStyle = color;
      roundRect(g, 128 - sw / 2, 6, sw, 34, 17);
      g.fillStyle = '#24264a';
      g.fillText(status, 128, 32);
    }
    this.labelTex.needsUpdate = true;
  }

  playEmote(id) { this.emote = id; this.emoteT = 0; }
  stopEmote() { this.emote = null; }
  squashImpulse(v) { this.squashV += v; }

  /**
   * s: { x,y,z, vx,vy,vz, yaw, grounded, dashing, stunned, out, groundY }
   */
  update(dt, s) {
    this.time += dt;
    const root = this.root;
    root.position.set(s.x, s.y, s.z);
    const hs = Math.hypot(s.vx, s.vz);

    // 탈락 연출: 떨어지며 빙글빙글 돌다 사라짐
    if (s.out) {
      if (this.outT < 0) this.outT = 0;
      this.outT += dt;
      const k = Math.max(0, 1 - this.outT / 0.6);
      root.scale.setScalar(k);
      root.visible = k > 0.01;
      this.shadow.visible = false;
      return;
    }
    this.outT = -1;
    root.visible = true;
    root.scale.setScalar(1);

    // 방향
    root.rotation.y = s.yaw;

    // 착지 스쿼시
    if (s.grounded && !this.prevGrounded) this.squashImpulse(-Math.min(4, 1 + (this.lastVy || 0) * -0.12));
    if (!s.grounded && this.prevGrounded && s.vy > 3) this.squashImpulse(3);
    this.prevGrounded = s.grounded;
    this.lastVy = s.vy;
    this.squashV += (1 - this.squash) * 260 * dt;
    this.squashV *= Math.exp(-14 * dt);
    this.squash += this.squashV * dt;
    let sy = this.squash;
    if (!s.grounded) sy *= 1 + Math.max(-0.12, Math.min(0.15, s.vy * 0.015));
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));

    // 로컬 공간 속도 (넉백 방향 기울기용)
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const fwd = s.vx * sn + s.vz * c;
    const side = s.vx * c - s.vz * sn;

    let targetLeanX = 0, targetLeanZ = 0;
    const falling = !s.grounded && s.y < -1.2;
    let armSwing = 0, legSwing = 0, armRaise = 0.15, armOut = 0.12;
    const t = this.time;

    if (this.emote) {
      this.emoteT += dt;
      this.applyEmote(dt, sy, sxz);
      this.prevGrounded = s.grounded;
      this.updateShadow(s);
      this.updateFace(dt, 'happy');
      return;
    }

    if (falling) {
      // 낙하: 굴러 떨어지며 팔다리를 허우적
      this.fallT += dt;
      this.tumble += dt * 7;
      this.body.rotation.set(this.tumble, 0, Math.sin(this.tumble * 0.7) * 0.5);
      for (const a of this.arms) { a.rotation.set(Math.sin(t * 30 + a.userData.side) * 1.2, 0, a.userData.side * (2.2 + Math.sin(t * 25) * 0.4)); }
      for (const l of this.legs) l.rotation.x = Math.sin(t * 28 + l.userData.side) * 0.9;
      this.body.scale.set(sxz, sy, sxz);
      this.updateShadow(s);
      this.updateFace(dt, 'scared');
      return;
    }
    this.fallT = 0;
    this.tumble = 0;

    let face = 'normal';
    if (s.stunned) {
      // 넉백: 밀려나는 방향 반대로 몸이 젖혀지고 팔을 휘젓는다
      targetLeanX = Math.max(-0.9, Math.min(0.9, -fwd * 0.07));
      targetLeanZ = Math.max(-0.9, Math.min(0.9, side * 0.07));
      armRaise = 2.4 + Math.sin(t * 26) * 0.5;
      armOut = 0.6;
      legSwing = Math.sin(t * 22) * 0.6;
      face = 'hurt';
    } else if (s.dashing) {
      targetLeanX = 0.55;
      armRaise = -0.9;
      armOut = 0.3;
      legSwing = 0.5;
      face = 'angry';
    } else if (!s.grounded) {
      targetLeanX = Math.max(-0.2, Math.min(0.25, fwd * 0.03));
      armRaise = s.vy > 0 ? 2.6 : 1.6 + Math.sin(t * 20) * 0.2;
      armOut = 0.4;
      legSwing = s.vy > 0 ? 0.4 : -0.2;
    } else if (hs > 0.5) {
      // 걷기/달리기 (속도에 따라 보폭과 빈도가 커진다)
      const run = Math.min(1, hs / 7.5);
      this.walkPhase += dt * (6 + run * 8);
      const ph = this.walkPhase;
      legSwing = Math.sin(ph) * (0.5 + run * 0.5);
      armSwing = Math.sin(ph) * (0.4 + run * 0.7);
      targetLeanX = run * 0.22;
      this.body.position.y = Math.abs(Math.sin(ph)) * 0.08 * (0.5 + run);
    } else {
      this.body.position.y = damp(this.body.position.y, 0, 12, dt);
      sy *= 1 + Math.sin(t * 2.4) * 0.015;
    }
    if (hs <= 0.5 || !s.grounded) this.body.position.y = damp(this.body.position.y, 0, 12, dt);

    this.leanX = damp(this.leanX, targetLeanX, 10, dt);
    this.leanZ = damp(this.leanZ, targetLeanZ, 10, dt);
    this.body.rotation.set(this.leanX, 0, this.leanZ);
    this.body.scale.set(sxz, sy, sxz);

    this.arms.forEach((a) => {
      const sd = a.userData.side;
      a.rotation.x = damp(a.rotation.x, armSwing * -sd + (s.dashing ? 0.9 : 0), 18, dt);
      a.rotation.z = damp(a.rotation.z, sd * (armOut + (armRaise > 1 ? armRaise : 0)), 14, dt);
    });
    this.legs.forEach((l, i) => {
      const sd = i ? 1 : -1;
      l.rotation.x = damp(l.rotation.x, legSwing * sd, 20, dt);
    });
    if (this.propeller) this.propeller.rotation.y += dt * (6 + hs * 3);
    if (this.cape) this.cape.rotation.x = damp(this.cape.rotation.x, Math.min(1.2, 0.1 + hs * 0.1 + (s.grounded ? 0 : 0.3)), 8, dt);
    this.updateShadow(s);
    this.updateFace(dt, face);
  }

  applyEmote(dt, sy, sxz) {
    const t = this.emoteT;
    const body = this.body;
    body.rotation.set(0, 0, 0);
    body.position.y = 0;
    let s = sy;
    switch (this.emote) {
      case 'jump': {
        const ph = (t * 2.2) % 1;
        body.position.y = Math.sin(ph * Math.PI) * 1.0;
        s = ph < 0.08 || ph > 0.92 ? 0.8 : 1.08;
        this.arms.forEach((a) => { a.rotation.set(0, 0, a.userData.side * 2.7); });
        break;
      }
      case 'spin':
        body.rotation.y = t * 9;
        body.position.y = 0.2 + Math.sin(t * 4) * 0.15;
        this.arms.forEach((a) => a.rotation.set(0, 0, a.userData.side * 1.5));
        break;
      case 'wave':
        this.arms[1].rotation.set(0, 0, 2.6 + Math.sin(t * 12) * 0.4);
        this.arms[0].rotation.set(0, 0, -0.2);
        body.rotation.z = Math.sin(t * 6) * 0.08;
        break;
      case 'flex':
        this.arms.forEach((a) => a.rotation.set(-0.3, 0, a.userData.side * (1.6 + Math.sin(t * 8) * 0.25)));
        s = 1 + Math.sin(t * 8) * 0.05;
        body.rotation.x = -0.1;
        break;
      case 'dance':
      default:
        body.rotation.z = Math.sin(t * 8) * 0.25;
        body.position.y = Math.abs(Math.sin(t * 8)) * 0.25;
        this.arms.forEach((a, i) => a.rotation.set(0, 0, a.userData.side * (1.2 + Math.sin(t * 8 + i * Math.PI) * 1.2)));
        this.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 8 + i * Math.PI) * 0.4));
        break;
    }
    body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
  }

  updateFace(dt, mode) {
    this.blinkT -= dt;
    let eyeY = 1;
    if (this.blinkT < 0) { eyeY = 0.1; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4; }
    if (mode === 'hurt') eyeY = 0.25;
    if (mode === 'angry') eyeY = 0.6;
    if (mode === 'happy') eyeY = 0.45 + 0.1 * Math.sin(this.time * 6);
    if (mode === 'scared') eyeY = 1.35;
    for (const e of this.eyes) e.scale.y = damp(e.scale.y, eyeY, 30, dt);
    const open = mode === 'scared' || mode === 'hurt' ? 1.8 : mode === 'happy' ? 1.4 : 1;
    this.mouth.scale.set(open, mode === 'happy' ? 1.4 : open, 1);
    this.mouth.rotation.z = mode === 'scared' || mode === 'hurt' ? 0 : Math.PI;
  }

  updateShadow(s) {
    const gy = s.groundY;
    if (gy === undefined || gy === -Infinity || s.y - gy > 12) { this.shadow.visible = false; return; }
    this.shadow.visible = true;
    this.shadow.position.set(s.x, gy + 0.03, s.z);
    const k = Math.max(0.3, 1 - (s.y - gy) * 0.12);
    this.shadow.scale.setScalar(k);
    this.shadow.material.opacity = k;
  }

  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    this.labelTex.dispose();
    this.label.material.dispose();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

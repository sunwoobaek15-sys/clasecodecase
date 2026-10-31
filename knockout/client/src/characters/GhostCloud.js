// 방해꾼(탈락자/완주자)의 번개 구름과 지면 조준 표시
import * as THREE from 'three';
import { toon } from '../game/materials.js';
import { colorHex } from '../../../shared/src/looks.js';

const puff = new THREE.IcosahedronGeometry(1, 1);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1d1f3a });

export class GhostCloud {
  constructor(id, look, name, isLocal) {
    this.id = id;
    this.root = new THREE.Group();
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(colorHex(look.color)), 0.35).getHex();
    // 내 구름은 조준점을 가리지 않도록 반투명하게
    const mat = toon(tint, { transparent: true, opacity: isLocal ? 0.35 : 0.92, depthWrite: !isLocal });
    for (const [x, y, z, s] of [[0, 0, 0, 1], [-0.9, -0.15, 0, 0.75], [0.9, -0.1, 0, 0.8], [0.3, 0.45, 0, 0.7], [-0.4, 0.35, 0.2, 0.6]]) {
      const m = new THREE.Mesh(puff, mat);
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      this.root.add(m);
    }
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat);
      e.position.set(sx * 0.3, 0.05, 0.93);
      this.root.add(e);
    }
    const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    bolt.rotation.x = Math.PI;
    bolt.position.y = -1.1;
    this.root.add(bolt);
    this.bolt = bolt;

    const ringMat = new THREE.MeshBasicMaterial({ color: isLocal ? 0xffe14d : colorHex(look.color), transparent: true, opacity: isLocal ? 0.85 : 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 28).rotateX(-Math.PI / 2), ringMat);
    this.ring.renderOrder = 2;
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12).rotateX(-Math.PI / 2), ringMat);
    this.ring.add(this.dot);

    // 이름표
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 48;
    const g = cv.getContext('2d');
    g.font = '30px Jua, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(20,24,60,0.55)';
    const w = Math.min(250, g.measureText(name).width + 40);
    g.fillRect(128 - w / 2, 4, w, 40);
    g.fillStyle = '#ffe14d';
    g.fillText('⚡' + name, 128, 35, 240);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.label.scale.set(2.4, 0.45, 1);
    this.label.position.y = 1.4;
    this.root.add(this.label);
    this.t = Math.random() * 10;
  }

  addTo(scene) { scene.add(this.root, this.ring); }

  update(dt, x, z, groundY, cdFrac, height) {
    this.t += dt;
    const gy = groundY === -Infinity ? 0 : groundY;
    this.root.position.set(x, gy + height + Math.sin(this.t * 2) * 0.25, z);
    this.root.rotation.z = Math.sin(this.t * 1.3) * 0.08;
    this.ring.position.set(x, gy + 0.06, z);
    const ready = cdFrac >= 1;
    this.ring.scale.setScalar(ready ? 1 + Math.sin(this.t * 6) * 0.08 : 0.6 + cdFrac * 0.4);
    this.bolt.visible = ready;
  }

  dispose() { this.root.removeFromParent(); this.ring.removeFromParent(); }
}

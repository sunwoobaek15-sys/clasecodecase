// 모자/의상/액세서리 3D 모델 (외형 전용)
import * as THREE from 'three';
import { toon, addOutline } from '../game/materials.js';

const dark = () => toon(0x2b2d42);

export function buildHat(id, base) {
  const g = new THREE.Group();
  switch (id) {
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 16), toon(0xffd23f));
      cone.position.y = 0.22;
      cone.rotation.z = -0.15;
      addOutline(cone, 0.06);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon(0xff4d6d));
      ball.position.set(0.08, 0.53, 0);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), toon(0x3fa7ff));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.05;
      g.add(cone, ball, band);
      break;
    }
    case 'crown': {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.22, 16, 1, true), toon(0xffc93c, { side: THREE.DoubleSide }));
      ring.position.y = 0.04;
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), toon(0xffc93c));
        sp.position.set(Math.cos(a) * 0.28, 0.22, Math.sin(a) * 0.28);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), toon([0xff4d6d, 0x3fa7ff, 0x52d273][i % 3]));
        gem.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3);
        g.add(sp, gem);
      }
      g.position.y = -0.04;
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), dark());
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 20), dark());
      top.position.y = 0.27;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 20), toon(0xff4d6d));
      band.position.y = 0.08;
      addOutline(top, 0.05);
      g.add(brim, top, band);
      g.position.y = -0.02;
      break;
    }
    case 'cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x3fa7ff));
      dome.position.y = -0.12;
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 18, 1, false, -Math.PI / 2, Math.PI), toon(0x1f7fd6));
      bill.position.set(0, -0.1, 0.28);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0xffffff));
      btn.position.y = 0.3;
      g.add(dome, bill, btn);
      break;
    }
    case 'beanie': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff7ac8));
      dome.position.y = -0.14;
      dome.scale.y = 1.1;
      const fold = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 24), toon(0xffffff));
      fold.rotation.x = Math.PI / 2;
      fold.position.y = -0.12;
      const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), toon(0xffffff));
      pom.position.y = 0.36;
      g.add(dome, fold, pom);
      break;
    }
    case 'horns': {
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 8), toon(0xfff2d6));
        h.position.set(sx * 0.26, 0.02, 0);
        h.rotation.z = -sx * 0.45;
        addOutline(h, 0.08);
        g.add(h);
      }
      break;
    }
    case 'propeller': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xffd23f));
      cap.position.y = -0.1;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), dark());
      stick.position.y = 0.32;
      const blades = new THREE.Group();
      blades.position.y = 0.43;
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.1), toon(i ? 0xff4d6d : 0x3fa7ff));
        b.rotation.y = i * Math.PI / 2;
        blades.add(b);
      }
      g.add(cap, stick, blades);
      g.userData.spin = blades;
      break;
    }
    default:
      return null;
  }
  return g;
}

export function buildOutfit(id, base) {
  const g = new THREE.Group();
  switch (id) {
    case 'scarf': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.1, 8, 24), toon(0xff4d6d));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.98;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.06), toon(0xff4d6d));
      tail.position.set(0.22, 0.78, 0.4);
      tail.rotation.z = 0.2;
      g.add(ring, tail);
      break;
    }
    case 'belt': {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 24, 1, true), toon(0x8a5a3c, { side: THREE.DoubleSide }));
      belt.position.y = 0.62;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), toon(0xffc93c));
      plate.rotation.x = Math.PI / 2;
      plate.position.set(0, 0.62, 0.52);
      g.add(belt, plate);
      break;
    }
    case 'cape': {
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.05, -0.38);
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9, 1, 4), toon(0xa62639, { side: THREE.DoubleSide }));
      cape.position.y = -0.45;
      pivot.add(cape);
      const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20, Math.PI), toon(0xffc93c));
      clasp.rotation.x = Math.PI / 2;
      clasp.rotation.z = Math.PI;
      clasp.position.y = 1.02;
      g.add(pivot, clasp);
      g.userData.cape = pivot;
      break;
    }
    case 'overalls': {
      const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.5, 0.35, 24, 1, true), toon(0x2f6fd0, { side: THREE.DoubleSide }));
      pants.position.y = 0.55;
      g.add(pants);
      for (const sx of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), toon(0x2f6fd0));
        strap.position.set(sx * 0.2, 0.9, 0.47);
        strap.rotation.x = -0.25;
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), toon(0xffd23f));
        btn.position.set(sx * 0.2, 0.75, 0.52);
        g.add(strap, btn);
      }
      break;
    }
    case 'stripes': {
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.508, 0.508, 0.07, 24, 1, true), toon(0xffffff, { side: THREE.DoubleSide }));
        s.position.y = 0.55 + i * 0.16;
        g.add(s);
      }
      break;
    }
    default:
      return null;
  }
  return g;
}

export function buildAccessory(id, base) {
  const g = new THREE.Group();
  switch (id) {
    case 'glasses': {
      for (const sx of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 16), dark());
        r.position.set(sx * 0.17, 1.18, 0.5);
        g.add(r);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), dark());
      bridge.position.set(0, 1.2, 0.5);
      g.add(bridge);
      break;
    }
    case 'shades': {
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.03, 14), new THREE.MeshBasicMaterial({ color: 0x15161f }));
        l.rotation.x = Math.PI / 2;
        l.position.set(sx * 0.17, 1.18, 0.5);
        g.add(l);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.03), new THREE.MeshBasicMaterial({ color: 0x15161f }));
      bar.position.set(0, 1.24, 0.49);
      g.add(bar);
      break;
    }
    case 'bowtie': {
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), toon(0xff4d6d));
        w.rotation.z = sx * Math.PI / 2;
        w.position.set(sx * 0.09, 0.9, 0.48);
        g.add(w);
      }
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0xd62f52));
      k.position.set(0, 0.9, 0.5);
      g.add(k);
      break;
    }
    case 'backpack': {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.3), toon(0xff9a3c));
      bag.position.set(0, 0.85, -0.5);
      addOutline(bag, 0.04);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.08), toon(0xe0782a));
      pocket.position.set(0, 0.72, -0.68);
      g.add(bag, pocket);
      break;
    }
    case 'mustache': {
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), dark());
        m.rotation.z = sx * (Math.PI / 2 - 0.35);
        m.position.set(sx * 0.08, 1.07, 0.5);
        g.add(m);
      }
      break;
    }
    default:
      return null;
  }
  return g;
}

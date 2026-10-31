// 렌더러, 조명, 하늘, 구름, 배경 섬
import * as THREE from 'three';
import { toon } from './materials.js';

export function createRenderer(container, quality) {
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
  const pr = quality === 'low' ? 1 : quality === 'medium' ? Math.min(1.5, devicePixelRatio) : Math.min(2, devicePixelRatio);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createScene(quality) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa9e2ff, 60, 170);

  // 그라데이션 하늘 돔
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(0x3a8ff0) }, mid: { value: new THREE.Color(0x9fe0ff) }, bottom: { value: new THREE.Color(0xfff1d6) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bottom, smoothstep(0.0, -0.5, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x8a7a9a, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.1);
  sun.position.set(18, 30, 12);
  if (quality === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 26;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  scene.add(sun.target);

  // 태양
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
  sunDisc.position.set(180, 160, -260);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const clouds = createClouds(scene, quality === 'low' ? 14 : 30);
  const islands = createIslands(scene, quality);

  return {
    scene,
    sun,
    update(dt, t) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 200) c.position.x = -200;
      }
      for (const isl of islands) isl.position.y = isl.userData.baseY + Math.sin(t * 0.4 + isl.userData.phase) * 0.8;
    },
  };
}

function createClouds(scene, count) {
  const mat = toon(0xffffff, { transparent: true, opacity: 0.95 });
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < puffs; k++) {
      const m = new THREE.Mesh(geo, mat);
      const s = 3 + Math.random() * 4;
      m.scale.set(s, s * 0.7, s);
      m.position.set((k - puffs / 2) * 3.5 + Math.random() * 2, Math.random() * 2, Math.random() * 3);
      g.add(m);
    }
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    const below = i % 3 === 0;
    g.position.set(Math.cos(ang) * dist, below ? -30 - Math.random() * 30 : -10 + Math.random() * 40, Math.sin(ang) * dist);
    g.userData.speed = 1 + Math.random() * 2;
    scene.add(g);
    list.push(g);
  }
  // 경기장 아래 깊은 구름바다
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: true }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -60;
  scene.add(sea);
  return list;
}

function createIslands(scene, quality) {
  const list = [];
  const rock = toon(0x9c7b6a);
  const grass = toon(0x6fdc6f);
  const trunk = toon(0x8a5a3c);
  const leaf = toon(0x3fbf5f);
  const n = quality === 'low' ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const r = 4 + Math.random() * 6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, 1.2, 10), grass);
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, r * 1.8, 10), rock);
    bottom.rotation.x = Math.PI;
    bottom.position.y = -r * 0.9 - 0.6;
    g.add(top, bottom);
    const trees = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < trees; k++) {
      const tr = new THREE.Group();
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), trunk);
      tk.position.y = 1.6;
      const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), leaf);
      lf.position.y = 3.2;
      tr.add(tk, lf);
      tr.position.set((Math.random() - 0.5) * r, 0, (Math.random() - 0.5) * r);
      g.add(tr);
    }
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 55 + Math.random() * 50;
    g.position.set(Math.cos(ang) * dist, -8 + Math.random() * 20, Math.sin(ang) * dist);
    g.userData.baseY = g.position.y;
    g.userData.phase = Math.random() * 6;
    scene.add(g);
    list.push(g);
  }
  return list;
}

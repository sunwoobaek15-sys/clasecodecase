// 모델을 짜 맞추는 도구: 이름 있는 부품(노드), 재질, 색
import { Mesh } from './geom.mjs';

/** 재질: 색은 꼭짓점 색으로 칠하고, 재질은 반짝임과 빛만 정해요 */
export const MATERIALS = [
  { name: 'metal', color: [1, 1, 1], metallic: 0.85, roughness: 0.35 },
  { name: 'polymer', color: [1, 1, 1], metallic: 0.05, roughness: 0.75 },
  { name: 'wood', color: [1, 1, 1], metallic: 0, roughness: 0.55 },
  { name: 'cloth', color: [1, 1, 1], metallic: 0, roughness: 0.95 },
  { name: 'glow_red', color: [0, 0, 0], emissive: [3, 0.32, 0.22] },
  { name: 'glow_orange', color: [0, 0, 0], emissive: [3, 1.25, 0.25] },
  { name: 'glow_cyan', color: [0, 0, 0], emissive: [0.5, 2.2, 3] },
  { name: 'glow_green', color: [0, 0, 0], emissive: [0.7, 3, 1.1] },
  { name: 'glow_amber', color: [0, 0, 0], emissive: [3, 2.1, 0.7] },
];
const MAT_INDEX = Object.fromEntries(MATERIALS.map((m, i) => [m.name, i]));

/** 색 (어두운 조명에서 보이도록 조금 밝게 잡았어요) */
export const C = {
  white: [1, 1, 1],
  hole: [0.025, 0.025, 0.03],
  black: [0.07, 0.07, 0.075],
  steelDark: [0.14, 0.145, 0.16],
  steel: [0.42, 0.43, 0.46],
  chrome: [0.7, 0.72, 0.75],
  gunmetal: [0.25, 0.26, 0.29],
  polymer: [0.15, 0.155, 0.165],
  polymerDark: [0.095, 0.1, 0.105],
  olive: [0.3, 0.32, 0.25],
  oliveDark: [0.2, 0.215, 0.17],
  brass: [0.86, 0.63, 0.26],
  copper: [0.78, 0.42, 0.24],
  wood: [0.52, 0.31, 0.15],
  woodDark: [0.3, 0.17, 0.08],
  amber: [0.98, 0.58, 0.12],
  shellRed: [0.72, 0.1, 0.08],
  glove: [0.13, 0.12, 0.11],
  glovePad: [0.24, 0.24, 0.26],
  sleeve: [0.16, 0.19, 0.24],
  sleeveDark: [0.09, 0.1, 0.12],
  // 로봇
  droneShell: [0.68, 0.7, 0.74],
  droneDark: [0.13, 0.14, 0.16],
  hazard: [0.96, 0.56, 0.1],
  runnerArmor: [0.3, 0.31, 0.35],
  runnerDark: [0.11, 0.11, 0.125],
  blade: [0.78, 0.8, 0.84],
  brutePaint: [0.95, 0.64, 0.07],
  bruteDark: [0.16, 0.16, 0.17],
  bruteSteel: [0.36, 0.37, 0.4],
};

/** 이름 있는 부품. t: 부모 안에서의 자리(관절), r: 기본 회전 */
export class Part {
  constructor(name, t = [0, 0, 0], r = [0, 0, 0]) {
    this.name = name;
    this.t = t;
    this.r = r;
    this.geo = {};
    this.children = [];
  }
  /** 재질 이름으로 메시 더하기 */
  add(mat, ...meshes) {
    if (!(mat in MAT_INDEX)) throw new Error('없는 재질: ' + mat);
    const g = (this.geo[mat] = this.geo[mat] || new Mesh());
    for (const m of meshes.flat()) if (m) g.merge(m);
    return this;
  }
  child(part) {
    this.children.push(part);
    return part;
  }
  tris() {
    let t = 0;
    for (const m of Object.values(this.geo)) t += m.tcount;
    for (const c of this.children) t += c.tris();
    return t;
  }
}

/** 부품 나무 → writeGLB에 넘길 장면 */
export function toScene(roots) {
  const nodes = [];
  const visit = (p) => {
    const idx = nodes.length;
    const node = { name: p.name, t: p.t, r: p.r, children: [], prims: [] };
    nodes.push(node);
    for (const [mat, mesh] of Object.entries(p.geo)) node.prims.push({ mesh, mat: MAT_INDEX[mat] });
    for (const c of p.children) node.children.push(visit(c));
    return idx;
  };
  const rootIdx = roots.map(visit);
  return { materials: MATERIALS, nodes, roots: rootIdx };
}

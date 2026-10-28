// GLB(glTF 2.0 바이너리) 파일 쓰기 — Blender 같은 3D 프로그램에서도 열려요.
// 꼭짓점: 위치(float), 법선(float), 색(COLOR_0, 0~255). 면: 16비트 번호.
import { quat } from './geom.mjs';

/**
 * scene = {
 *   materials: [{ name, color: [r,g,b], metallic, roughness, emissive: [r,g,b] | null }],
 *   nodes: [{ name, t: [x,y,z], r: [rx,ry,rz] (게임 순서 오일러), children: [번호], prims: [{ mesh, mat }] }],
 *   roots: [번호],
 * }
 */
export function writeGLB(scene, generator = 'SECTOR ZERO make-assets') {
  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const push = (typed, target) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      offset += pad;
    }
    chunks.push(bytes);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    offset += bytes.byteLength;
    return bufferViews.length - 1;
  };
  const accessor = (a) => {
    accessors.push(a);
    return accessors.length - 1;
  };

  const meshes = [];
  const nodes = scene.nodes.map((n) => {
    const node = { name: n.name };
    if (n.t && (n.t[0] || n.t[1] || n.t[2])) node.translation = n.t.map((v) => +v.toFixed(6));
    if (n.r && (n.r[0] || n.r[1] || n.r[2])) node.rotation = quat(n.r).map((v) => +v.toFixed(7));
    if (n.children && n.children.length) node.children = n.children;
    const prims = (n.prims || []).filter((p) => p.mesh && p.mesh.tcount > 0);
    if (prims.length) {
      node.mesh = meshes.length;
      meshes.push({
        name: n.name,
        primitives: prims.map(({ mesh, mat }) => {
          const vc = mesh.vcount;
          if (vc > 65535) throw new Error(n.name + ': 꼭짓점이 65535개를 넘어요 (' + vc + ')');
          const pos = new Float32Array(mesh.p);
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (let k = 0; k < pos.length; k += 3) {
            for (let j = 0; j < 3; j++) {
              lo[j] = Math.min(lo[j], pos[k + j]);
              hi[j] = Math.max(hi[j], pos[k + j]);
            }
          }
          const col = new Uint8Array(vc * 4);
          for (let k = 0; k < vc; k++) {
            for (let j = 0; j < 3; j++) col[k * 4 + j] = Math.max(0, Math.min(255, Math.round(mesh.c[k * 3 + j] * 255)));
            col[k * 4 + 3] = 255;
          }
          const attributes = {
            POSITION: accessor({ bufferView: push(pos, 34962), componentType: 5126, count: vc, type: 'VEC3', min: lo, max: hi }),
            NORMAL: accessor({ bufferView: push(new Float32Array(mesh.n), 34962), componentType: 5126, count: vc, type: 'VEC3' }),
            COLOR_0: accessor({ bufferView: push(col, 34962), componentType: 5121, normalized: true, count: vc, type: 'VEC4' }),
          };
          const indices = accessor({ bufferView: push(new Uint16Array(mesh.i), 34963), componentType: 5123, count: mesh.i.length, type: 'SCALAR' });
          return { attributes, indices, material: mat };
        }),
      });
    }
    return node;
  });

  const materials = scene.materials.map((m) => {
    const out = {
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: [...(m.color || [1, 1, 1]), 1],
        metallicFactor: m.metallic === undefined ? 0.2 : m.metallic,
        roughnessFactor: m.roughness === undefined ? 0.6 : m.roughness,
      },
    };
    if (m.emissive) {
      const k = Math.max(...m.emissive);
      out.emissiveFactor = k > 1 ? m.emissive.map((v) => v / k) : m.emissive;
      if (k > 1) out.extensions = { KHR_materials_emissive_strength: { emissiveStrength: k } };
    }
    return out;
  });

  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: scene.roots }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  if (materials.some((m) => m.extensions)) json.extensionsUsed = ['KHR_materials_emissive_strength'];

  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  if (jpad) {
    const t = new Uint8Array(jsonBytes.length + jpad);
    t.set(jsonBytes);
    t.fill(0x20, jsonBytes.length);
    jsonBytes = t;
  }
  const binLen = offset + ((4 - (offset % 4)) % 4);
  const total = 12 + 8 + jsonBytes.length + 8 + binLen;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // glTF
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON
  out.set(jsonBytes, 20);
  let o = 20 + jsonBytes.length;
  dv.setUint32(o, binLen, true);
  dv.setUint32(o + 4, 0x004e4942, true); // BIN
  o += 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

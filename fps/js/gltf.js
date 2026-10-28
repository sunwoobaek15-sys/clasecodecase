/* SECTOR ZERO — GLB(glTF 2.0) 읽기: 노드 이름·위치, 메시(위치·법선·uv·색·면), 재질, 그림을 꺼내요 (DOM·WebGL 없는 순수 로직) */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  const COMP = {
    5120: [Int8Array, 1, 127],
    5121: [Uint8Array, 1, 255],
    5122: [Int16Array, 2, 32767],
    5123: [Uint16Array, 2, 65535],
    5125: [Uint32Array, 4, 0],
    5126: [Float32Array, 4, 0],
  };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  /** base64 글자 → ArrayBuffer */
  function fromBase64(b64) {
    if (typeof root.atob === 'function') {
      const s = root.atob(b64);
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out.buffer;
    }
    const buf = Buffer.from(b64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  /** 4x4 행렬(열 우선) = 이동 × 회전(쿼터니언) × 크기 */
  function trs(t, q, s) {
    const [x, y, z, w] = q || [0, 0, 0, 1];
    const [sx, sy, sz] = s || [1, 1, 1];
    const m = new Float32Array(16);
    m[0] = (1 - 2 * (y * y + z * z)) * sx;
    m[1] = 2 * (x * y + z * w) * sx;
    m[2] = 2 * (x * z - y * w) * sx;
    m[4] = 2 * (x * y - z * w) * sy;
    m[5] = (1 - 2 * (x * x + z * z)) * sy;
    m[6] = 2 * (y * z + x * w) * sy;
    m[8] = 2 * (x * z + y * w) * sz;
    m[9] = 2 * (y * z - x * w) * sz;
    m[10] = (1 - 2 * (x * x + y * y)) * sz;
    m[12] = t ? t[0] : 0;
    m[13] = t ? t[1] : 0;
    m[14] = t ? t[2] : 0;
    m[15] = 1;
    return m;
  }

  function mul(a, b) {
    const r = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) r[c * 4 + i] = a[i] * b[c * 4] + a[4 + i] * b[c * 4 + 1] + a[8 + i] * b[c * 4 + 2] + a[12 + i] * b[c * 4 + 3];
    return r;
  }

  /**
   * GLB 바이트 → { nodes, meshes, materials, images, roots }
   * nodes[i] = { name, mesh, children, local(4x4) }, meshes[i] = [{ positions, normals, uvs, colors, indices, material }]
   */
  function parse(buffer) {
    const dv = new DataView(buffer);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB 파일이 아니에요');
    if (dv.getUint32(4, true) !== 2) throw new Error('glTF 2.0만 읽을 수 있어요');
    let o = 12, json = null, bin = null;
    while (o < dv.byteLength) {
      const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true);
      const data = new Uint8Array(buffer, o + 8, len);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
      else if (type === 0x004e4942) bin = data;
      o += 8 + len;
    }
    if (!json) throw new Error('GLB 안에 JSON이 없어요');

    const viewBytes = (vi) => {
      const v = json.bufferViews[vi];
      if (v.buffer !== 0 || !bin) throw new Error('외부 파일을 쓰는 glTF는 GLB로 묶어 주세요');
      return { bytes: new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength), stride: v.byteStride || 0 };
    };

    /** 접근자 → 실수 배열 (정수는 normalized면 0~1로) */
    function read(ai, asFloat) {
      const a = json.accessors[ai];
      const [Typed, bytesPer, maxv] = COMP[a.componentType];
      const n = SIZE[a.type];
      const out = asFloat ? new Float32Array(a.count * n) : new Typed(a.count * n);
      if (a.bufferView === undefined) return out;
      const { bytes, stride } = viewBytes(a.bufferView);
      const step = stride || bytesPer * n;
      const dview = new DataView(bytes.buffer, bytes.byteOffset + (a.byteOffset || 0));
      const get = {
        5120: (p) => dview.getInt8(p),
        5121: (p) => dview.getUint8(p),
        5122: (p) => dview.getInt16(p, true),
        5123: (p) => dview.getUint16(p, true),
        5125: (p) => dview.getUint32(p, true),
        5126: (p) => dview.getFloat32(p, true),
      }[a.componentType];
      const norm = asFloat && a.normalized && maxv;
      for (let i = 0; i < a.count; i++) {
        for (let k = 0; k < n; k++) {
          let v = get(i * step + k * bytesPer);
          if (norm) v = Math.max(-1, v / maxv);
          out[i * n + k] = v;
        }
      }
      return out;
    }

    const materials = (json.materials || []).map((m) => {
      const pbr = m.pbrMetallicRoughness || {};
      const strength = (m.extensions && m.extensions.KHR_materials_emissive_strength && m.extensions.KHR_materials_emissive_strength.emissiveStrength) || 1;
      return {
        name: m.name || '',
        color: pbr.baseColorFactor || [1, 1, 1, 1],
        metallic: pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor,
        roughness: pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor,
        emissive: (m.emissiveFactor || [0, 0, 0]).map((v) => v * strength),
        texture: pbr.baseColorTexture ? json.textures[pbr.baseColorTexture.index].source : null,
        doubleSided: !!m.doubleSided,
      };
    });

    const images = (json.images || []).map((im) => (im.bufferView !== undefined ? { mime: im.mimeType || 'image/png', bytes: viewBytes(im.bufferView).bytes } : null));

    const meshes = (json.meshes || []).map((m) =>
      m.primitives
        .filter((p) => (p.mode === undefined || p.mode === 4) && p.attributes.POSITION !== undefined)
        .map((p) => {
          const positions = read(p.attributes.POSITION, true);
          let indices = p.indices !== undefined ? read(p.indices, false) : null;
          if (!indices) {
            indices = new Uint32Array(positions.length / 3);
            for (let i = 0; i < indices.length; i++) indices[i] = i;
          }
          let colors = null;
          if (p.attributes.COLOR_0 !== undefined) {
            const c = read(p.attributes.COLOR_0, true);
            const n = SIZE[json.accessors[p.attributes.COLOR_0].type];
            colors = new Float32Array((positions.length / 3) * 3);
            for (let i = 0; i < colors.length / 3; i++) for (let k = 0; k < 3; k++) colors[i * 3 + k] = c[i * n + k];
          }
          return {
            positions,
            normals: p.attributes.NORMAL !== undefined ? read(p.attributes.NORMAL, true) : null,
            uvs: p.attributes.TEXCOORD_0 !== undefined ? read(p.attributes.TEXCOORD_0, true) : null,
            colors,
            indices,
            material: p.material === undefined ? -1 : p.material,
          };
        })
    );

    const nodes = (json.nodes || []).map((n, i) => ({
      name: n.name || 'node' + i,
      mesh: n.mesh === undefined ? -1 : n.mesh,
      children: n.children || [],
      local: n.matrix ? new Float32Array(n.matrix) : trs(n.translation, n.rotation, n.scale),
    }));
    const scene = (json.scenes || [])[json.scene || 0];
    const roots = scene ? scene.nodes : nodes.map((_, i) => i).filter((i) => !nodes.some((m) => m.children.includes(i)));
    return { nodes, meshes, materials, images, roots };
  }

  /** 각 노드의 월드 행렬 (가만히 있는 자세) */
  function worldMatrices(g) {
    const out = new Array(g.nodes.length);
    const walk = (i, parent) => {
      out[i] = parent ? mul(parent, g.nodes[i].local) : g.nodes[i].local;
      for (const c of g.nodes[i].children) walk(c, out[i]);
    };
    for (const r of g.roots) walk(r, null);
    return out;
  }

  /** 전체 크기 {lo, hi} (가만히 있는 자세) */
  function bounds(g) {
    const W = worldMatrices(g);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    g.nodes.forEach((n, i) => {
      if (n.mesh < 0 || !W[i]) return;
      const m = W[i];
      for (const p of g.meshes[n.mesh]) {
        const P = p.positions;
        for (let k = 0; k < P.length; k += 3) {
          const x = P[k], y = P[k + 1], z = P[k + 2];
          const v = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
          for (let j = 0; j < 3; j++) {
            lo[j] = Math.min(lo[j], v[j]);
            hi[j] = Math.max(hi[j], v[j]);
          }
        }
      }
    });
    return { lo, hi };
  }

  /** 삼각형 수 */
  function triangles(g) {
    let t = 0;
    for (const m of g.meshes) for (const p of m) t += p.indices.length / 3;
    return t;
  }

  SZ.gltf = { parse, fromBase64, trs, mul, worldMatrices, bounds, triangles };
})(typeof window !== 'undefined' ? window : globalThis);

/* SECTOR ZERO — WebGL 렌더러: 조명 셰이더, 맵 메시, 상자 그리기, 불꽃·빛 효과 */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});
  const { m4 } = SZ.math;

  const MAXL = 12;

  const LIT_VS = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec2 a_uv;
attribute vec3 a_col;
uniform mat4 u_vp;
uniform mat4 u_model;
varying vec3 v_wpos;
varying vec3 v_nrm;
varying vec2 v_uv;
varying vec3 v_col;
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  v_wpos = wp.xyz;
  v_nrm = mat3(u_model) * a_nrm;
  v_uv = a_uv;
  v_col = a_col;
  gl_Position = u_vp * wp;
}`;

  const LIT_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define MAXL ${MAXL}
uniform sampler2D u_tex;
uniform vec3 u_tint;
uniform vec3 u_emit;
uniform float u_glow;
uniform float u_spec;
uniform vec3 u_cam;
uniform vec3 u_amb;
uniform vec3 u_fogCol;
uniform float u_fogDen;
uniform vec4 u_lpos[MAXL];
uniform vec3 u_lcol[MAXL];
uniform vec3 u_spotPos;
uniform vec3 u_spotDir;
uniform vec3 u_spotCol;
varying vec3 v_wpos;
varying vec3 v_nrm;
varying vec2 v_uv;
varying vec3 v_col;
void main() {
  vec4 t = texture2D(u_tex, v_uv);
  vec3 base = t.rgb * u_tint * v_col;
  vec3 n = normalize(v_nrm);
  vec3 V = u_cam - v_wpos;
  float dist = length(V);
  V /= max(dist, 1e-4);
  vec3 diff = u_amb * (0.62 + 0.38 * n.y);
  vec3 spec = vec3(0.0);
  for (int i = 0; i < MAXL; i++) {
    vec3 L = u_lpos[i].xyz - v_wpos;
    float d = length(L);
    L /= max(d, 1e-4);
    float att = clamp(1.0 - d / u_lpos[i].w, 0.0, 1.0);
    att *= att;
    float ndl = max((dot(n, L) + 0.15) / 1.15, 0.0);
    diff += u_lcol[i] * ndl * att;
    spec += u_lcol[i] * pow(max(dot(n, normalize(L + V)), 0.0), 28.0) * att;
  }
  vec3 Ls = u_spotPos - v_wpos;
  float ds = length(Ls);
  Ls /= max(ds, 1e-4);
  float cone = smoothstep(0.8, 0.96, dot(-Ls, u_spotDir));
  float atts = clamp(1.0 - ds / 22.0, 0.0, 1.0);
  atts *= atts * cone;
  diff += u_spotCol * max(dot(n, Ls), 0.0) * atts;
  spec += u_spotCol * pow(max(dot(n, normalize(Ls + V)), 0.0), 28.0) * atts;
  vec3 col = base * diff + spec * u_spec;
  float g = max(u_glow, 1.0 - t.a);
  col = mix(col, t.rgb * u_tint * v_col * 1.5, g);
  col += u_emit;
  col = vec3(1.0) - exp(-col * 1.3);
  float fog = 1.0 - exp(-pow(dist * u_fogDen, 2.0));
  gl_FragColor = vec4(mix(col, u_fogCol, clamp(fog, 0.0, 1.0)), 1.0);
}`;

  const FX_VS = `
attribute vec3 a_pos;
attribute vec2 a_uv;
attribute vec4 a_col;
uniform mat4 u_vp;
uniform vec3 u_cam;
uniform float u_fogDen;
varying vec2 v_uv;
varying vec4 v_col;
void main() {
  float d = length(a_pos - u_cam);
  float fog = exp(-pow(d * u_fogDen, 2.0));
  v_uv = a_uv;
  v_col = vec4(a_col.rgb, a_col.a * fog);
  gl_Position = u_vp * vec4(a_pos, 1.0);
}`;

  const FX_FS = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
varying vec4 v_col;
void main() {
  gl_FragColor = vec4(v_col.rgb, v_col.a * texture2D(u_tex, v_uv).a);
}`;

  /* ---------- 메시 만들기 (위치3 법선3 uv2 색3 = 11개 float) ---------- */
  function MeshBuilder() {
    this.v = [];
    this.i = [];
  }
  /** 사각형: 네 점을 법선 쪽에서 봤을 때 반시계 순서가 되도록 자동으로 맞춰요 */
  MeshBuilder.prototype.quad = function (p, n, uv, c) {
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const base = this.v.length / 11;
    for (let k = 0; k < 4; k++) {
      const col = Array.isArray(c[0]) ? c[k] : c;
      this.v.push(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uv[k][0], uv[k][1], col[0], col[1], col[2]);
    }
    if (flip) this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  function createRenderer(canvas) {
    const opts = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;
    const aniso =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic');

    function shader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('셰이더 오류: ' + gl.getShaderInfoLog(s));
      return s;
    }
    function program(vs, fs, attrs, unis) {
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('셰이더 연결 오류: ' + gl.getProgramInfoLog(p));
      const u = {};
      unis.forEach((name) => (u[name] = gl.getUniformLocation(p, name)));
      return { p, u, attrs: attrs.length };
    }

    const lit = program(LIT_VS, LIT_FS, ['a_pos', 'a_nrm', 'a_uv', 'a_col'], [
      'u_vp', 'u_model', 'u_tex', 'u_tint', 'u_emit', 'u_glow', 'u_spec', 'u_cam', 'u_amb', 'u_fogCol', 'u_fogDen',
      'u_lpos', 'u_lcol', 'u_spotPos', 'u_spotDir', 'u_spotCol',
    ]);
    const fxp = program(FX_VS, FX_FS, ['a_pos', 'a_uv', 'a_col'], ['u_vp', 'u_tex', 'u_cam', 'u_fogDen']);

    /* ---------- 질감 ---------- */
    const tex = {};
    const texData = SZ.textures.build();
    Object.keys(texData).forEach((name) => {
      const { size, data } = texData[name];
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.generateMipmap(gl.TEXTURE_2D);
      const wrap = name === 'glow' ? gl.CLAMP_TO_EDGE : gl.REPEAT;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (aniso && name !== 'glow') gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      tex[name] = t;
    });

    function upload(builder) {
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.v), gl.STATIC_DRAW);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(builder.i), gl.STATIC_DRAW);
      return { vbo, ibo, count: builder.i.length };
    }

    /* ---------- 단위 상자 (-0.5..0.5) ---------- */
    const cube = (function () {
      const b = new MeshBuilder();
      const faces = [
        [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
        [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
        [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
        [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
        [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
        [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
      ];
      const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
      faces.forEach(([n, p]) => b.quad(p, n, uv, [1, 1, 1]));
      return upload(b);
    })();

    /* ---------- 맵 메시 ---------- */
    let world = [];
    const SPEC = { concrete: 0.12, panel: 0.45, floor: 0.3, hazard: 0.25, ceiling: 0.05, crate: 0.22, lamp: 0 };

    function setLevel(lv) {
      const L = SZ.level;
      const S = L.CELL, H = L.WALL_H;
      const b = {};
      const get = (m) => (b[m] = b[m] || new MeshBuilder());
      const hAt = (cx, cz) => L.heightAt(lv, cx, cz);
      // 바닥 모서리 그늘: 모서리에 닿은 네 칸 중 막힌 칸 수
      // 경고 줄무늬 바닥: 벽에 난 문(폭 1~2칸)과 원자로 바로 옆
      const isWallAt = (x, z) => hAt(x, z) >= H;
      const doorAlong = (cx, cz, dx, dz) => {
        let a = 1, b = 1;
        while (a <= 3 && !isWallAt(cx - dx * a, cz - dz * a)) a++;
        while (b <= 3 && !isWallAt(cx + dx * b, cz + dz * b)) b++;
        if (a + b - 1 > 2) return false;
        return isWallAt(cx - dx * (a + 1), cz - dz * (a + 1)) && isWallAt(cx + dx * (b + 1), cz + dz * (b + 1));
      };
      const nearReactor = (cx, cz) =>
        cx > 7 && cx < lv.w - 8 && cz > 7 && cz < lv.h - 8 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => L.charAt(lv, cx + ox, cz + oz) === '=');
      const hazardCell = (cx, cz) => doorAlong(cx, cz, 1, 0) || doorAlong(cx, cz, 0, 1) || nearReactor(cx, cz);
      const cornerAO = (vx, vz, above) => {
        let k = 0;
        for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (hAt(vx + ox, vz + oz) > above) k++;
        return 1 - k * 0.17;
      };
      for (let cz = 0; cz < lv.h; cz++) {
        for (let cx = 0; cx < lv.w; cx++) {
          const h = hAt(cx, cz);
          const ch = L.charAt(lv, cx, cz);
          const x0 = cx * S, x1 = x0 + S, z0 = cz * S, z1 = z0 + S;
          if (h < H) {
            const corners = [[x0, z0, cx, cz], [x1, z0, cx + 1, cz], [x1, z1, cx + 1, cz + 1], [x0, z1, cx, cz + 1]];
            if (h === 0) {
              get(hazardCell(cx, cz) ? 'hazard' : 'floor').quad(
                corners.map(([x, z]) => [x, 0, z]),
                [0, 1, 0],
                corners.map(([x, z]) => [x / S, z / S]),
                corners.map(([, , vx, vz]) => {
                  const a = cornerAO(vx, vz, 0);
                  return [a, a, a];
                })
              );
            } else {
              get('crate').quad(corners.map(([x, z]) => [x, h, z]), [0, 1, 0], corners.map(([x, z]) => [x / 1, z / 1]), [1, 1, 1]);
            }
            get('ceiling').quad(
              corners.map(([x, z]) => [x, H, z]),
              [0, -1, 0],
              corners.map(([x, z]) => [x / S, z / S]),
              corners.map(([, , vx, vz]) => {
                const a = 0.55 + 0.45 * cornerAO(vx, vz, H - 0.01);
                return [a, a, a];
              })
            );
            if (ch === 'L') {
              const lamp = lv.lamps.find((l) => L.cellOf(l.x) === cx && L.cellOf(l.z) === cz);
              const c = lamp.color.map((v) => Math.min(1, v * 0.85));
              const mx = x0 + S / 2, mz = z0 + S / 2, hw = 0.55, hd = 0.28, y0 = H - 0.12;
              get('lamp').quad([[mx - hw, y0, mz - hd], [mx + hw, y0, mz - hd], [mx + hw, y0, mz + hd], [mx - hw, y0, mz + hd]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
              const dark = [0.08, 0.08, 0.09];
              get('lamp').quad([[mx - hw, y0, mz - hd], [mx + hw, y0, mz - hd], [mx + hw, H, mz - hd], [mx - hw, H, mz - hd]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], dark);
              get('lamp').quad([[mx - hw, y0, mz + hd], [mx + hw, y0, mz + hd], [mx + hw, H, mz + hd], [mx - hw, H, mz + hd]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], dark);
              get('lamp').quad([[mx - hw, y0, mz - hd], [mx - hw, y0, mz + hd], [mx - hw, H, mz + hd], [mx - hw, H, mz - hd]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], dark);
              get('lamp').quad([[mx + hw, y0, mz - hd], [mx + hw, y0, mz + hd], [mx + hw, H, mz + hd], [mx + hw, H, mz - hd]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], dark);
            }
          }
          if (h <= 0) continue;
          // 옆면: 이웃 칸이 더 낮으면 그 높이부터 이 칸 높이까지
          const mat = L.MATERIAL[ch] || 'concrete';
          const texW = mat === 'crate' ? 1 : S;
          const isWall = h >= H;
          const sides = [
            [1, 0, [[x1, z1], [x1, z0]]],
            [-1, 0, [[x0, z0], [x0, z1]]],
            [0, 1, [[x0, z1], [x1, z1]]],
            [0, -1, [[x1, z0], [x0, z0]]],
          ];
          for (const [ox, oz, [[ax, az], [bx, bz]]] of sides) {
            const nx = cx + ox, nz = cz + oz;
            if (nx < 0 || nz < 0 || nx >= lv.w || nz >= lv.h) continue;
            const hn = hAt(nx, nz);
            if (hn >= h) continue;
            const n = [ox, 0, oz];
            // 보는 사람 기준 오른쪽으로 u가 늘도록
            const uOf = (x, z) => (ox === 1 ? -z : ox === -1 ? z : oz === 1 ? x : -x) / texW;
            const vOf = (y) => (h - y) / texW;
            const bands = isWall
              ? [[hn, hn + 0.9, 0.58, 1], [hn + 0.9, h - 0.6, 1, 1], [h - 0.6, h, 1, 0.72]]
              : [[hn, h, 0.6, 1]];
            for (const [ya, yb, ca, cb] of bands) {
              if (yb <= ya) continue;
              get(mat).quad(
                [[ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az]],
                n,
                [[uOf(ax, az), vOf(ya)], [uOf(bx, bz), vOf(ya)], [uOf(bx, bz), vOf(yb)], [uOf(ax, az), vOf(yb)]],
                [[ca, ca, ca], [ca, ca, ca], [cb, cb, cb], [cb, cb, cb]]
              );
            }
          }
        }
      }
      world.forEach((m) => {
        gl.deleteBuffer(m.vbo);
        gl.deleteBuffer(m.ibo);
      });
      world = Object.keys(b).map((mat) => Object.assign(upload(b[mat]), { mat }));
    }

    /* ---------- 상태 ---------- */
    let boundMesh = null;
    let boundTex = null;
    let current = null;
    const IDENT = m4.create();

    function use(prog) {
      if (current === prog) return;
      gl.useProgram(prog.p);
      current = prog;
      boundMesh = null;
    }
    function bindMesh(mesh) {
      if (boundMesh === mesh) return;
      if (!mesh.vbo) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 24);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 44, 32);
      boundMesh = mesh;
    }
    function bindTex(name) {
      const t = typeof name === 'string' ? tex[name] || tex.white : name || tex.white;
      if (boundTex === t) return;
      gl.bindTexture(gl.TEXTURE_2D, t);
      boundTex = t;
    }
    function enableAttribs(n) {
      for (let i = 0; i < 4; i++) {
        if (i < n) gl.enableVertexAttribArray(i);
        else gl.disableVertexAttribArray(i);
      }
    }

    const vp = m4.create();
    const lpos = new Float32Array(MAXL * 4);
    const lcol = new Float32Array(MAXL * 3);
    const frameInfo = { cam: [0, 0, 0], fogDen: 0.045, right: [1, 0, 0], up: [0, 1, 0] };

    function resize(w, h) {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    }

    /**
     * 한 프레임 시작. f = {view, proj, cam:[x,y,z], lights:[{x,y,z,r,g,b,radius}], spot:{pos,dir,col}, amb, fogCol, fogDen}
     */
    function frame(f) {
      m4.multiply(vp, f.proj, f.view);
      frameInfo.cam = f.cam;
      frameInfo.fogDen = f.fogDen;
      frameInfo.right = [f.view[0], f.view[4], f.view[8]];
      frameInfo.up = [f.view[1], f.view[5], f.view[9]];
      gl.clearColor(f.fogCol[0], f.fogCol[1], f.fogCol[2], 1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      boundTex = null;
      current = null;
      use(lit);
      enableAttribs(4);
      lpos.fill(0);
      lcol.fill(0);
      for (let i = 0; i < MAXL; i++) {
        const l = f.lights[i];
        if (!l) {
          lpos[i * 4 + 3] = 0.001;
          continue;
        }
        lpos[i * 4] = l.x;
        lpos[i * 4 + 1] = l.y;
        lpos[i * 4 + 2] = l.z;
        lpos[i * 4 + 3] = l.radius;
        lcol[i * 3] = l.r;
        lcol[i * 3 + 1] = l.g;
        lcol[i * 3 + 2] = l.b;
      }
      const u = lit.u;
      gl.uniformMatrix4fv(u.u_vp, false, vp);
      gl.uniform1i(u.u_tex, 0);
      gl.uniform3fv(u.u_cam, f.cam);
      gl.uniform3fv(u.u_amb, f.amb);
      gl.uniform3fv(u.u_fogCol, f.fogCol);
      gl.uniform1f(u.u_fogDen, f.fogDen);
      gl.uniform4fv(u.u_lpos, lpos);
      gl.uniform3fv(u.u_lcol, lcol);
      gl.uniform3fv(u.u_spotPos, f.spot.pos);
      gl.uniform3fv(u.u_spotDir, f.spot.dir);
      gl.uniform3fv(u.u_spotCol, f.spot.col);
    }

    function setMaterial(model, texName, tint, emit, spec, glow) {
      const u = lit.u;
      gl.uniformMatrix4fv(u.u_model, false, model);
      bindTex(texName);
      gl.uniform3f(u.u_tint, tint[0], tint[1], tint[2]);
      if (emit) gl.uniform3f(u.u_emit, emit[0], emit[1], emit[2]);
      else gl.uniform3f(u.u_emit, 0, 0, 0);
      gl.uniform1f(u.u_spec, spec || 0);
      gl.uniform1f(u.u_glow, glow || 0);
    }

    const WHITE = [1, 1, 1];
    function drawWorld() {
      use(lit);
      enableAttribs(4);
      for (const m of world) {
        bindMesh(m);
        setMaterial(IDENT, m.mat === 'lamp' ? 'white' : m.mat, WHITE, null, SPEC[m.mat], m.mat === 'lamp' ? 1 : 0);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      }
    }

    /** 상자 하나: model은 단위 상자를 옮기고 늘린 행렬 */
    function box(model, texName, tint, emit, spec, glow) {
      use(lit);
      enableAttribs(4);
      bindMesh(cube);
      setMaterial(model, texName, tint, emit, spec, glow);
      gl.drawElements(gl.TRIANGLES, cube.count, gl.UNSIGNED_SHORT, 0);
    }

    /** 주변광만 잠깐 바꾸기 (손에 든 총을 더 잘 보이게) */
    function setAmbient(a) {
      use(lit);
      gl.uniform3fv(lit.u.u_amb, a);
    }

    function clearDepth() {
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    /* ---------- GLB 모델 ---------- */
    const uintExt = gl.getExtension('OES_element_index_uint');
    const GRAIN_TINT = 1.12; // grain 질감이 살짝 어두워서 색을 보정해요

    /** 법선이 없는 메시: 면 법선을 꼭짓점마다 모아서 */
    function computeNormals(P, I) {
      const N = new Float32Array(P.length);
      for (let k = 0; k < I.length; k += 3) {
        const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const i of [a, b, c]) {
          N[i] += nx;
          N[i + 1] += ny;
          N[i + 2] += nz;
        }
      }
      for (let i = 0; i < N.length; i += 3) {
        const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
        N[i] /= l;
        N[i + 1] /= l;
        N[i + 2] /= l;
      }
      return N;
    }

    /** 그림(PNG·JPEG) → 질감 (2의 거듭제곱 크기로 맞춰서). 다 읽히면 prim.tex에 넣어요 */
    function imageTexture(img, prims) {
      if (!img || typeof root.Blob !== 'function') return;
      const url = URL.createObjectURL(new Blob([img.bytes], { type: img.mime }));
      const im = new Image();
      im.onload = () => {
        const pot = (v) => Math.min(1024, Math.pow(2, Math.round(Math.log2(Math.max(1, v)))));
        const cv = document.createElement('canvas');
        cv.width = pot(im.width);
        cv.height = pot(im.height);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        boundTex = null;
        for (const p of prims) p.tex = t;
        URL.revokeObjectURL(url);
      };
      im.onerror = () => URL.revokeObjectURL(url);
      im.src = url;
    }

    /** 메시 조각 하나 → GPU (우리 셰이더 형식: 위치3 법선3 uv2 색3) */
    function buildPrim(p, mat) {
      const n = p.positions.length / 3;
      const P = p.positions;
      const N = p.normals || computeNormals(P, p.indices);
      const data = new Float32Array(n * 11);
      for (let i = 0; i < n; i++) {
        const o = i * 11;
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
        data[o] = x;
        data[o + 1] = y;
        data[o + 2] = z;
        data[o + 3] = nx;
        data[o + 4] = ny;
        data[o + 5] = nz;
        if (p.uvs) {
          data[o + 6] = p.uvs[i * 2];
          data[o + 7] = p.uvs[i * 2 + 1];
        } else {
          // uv가 없으면 가장 많이 향한 축으로 비춰서 결을 입혀요
          const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
          const uv = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
          data[o + 6] = uv[0] * 8;
          data[o + 7] = uv[1] * 8;
        }
        data[o + 8] = p.colors ? p.colors[i * 3] : 1;
        data[o + 9] = p.colors ? p.colors[i * 3 + 1] : 1;
        data[o + 10] = p.colors ? p.colors[i * 3 + 2] : 1;
      }
      let idx, type;
      if (n <= 65535) {
        idx = p.indices instanceof Uint16Array ? p.indices : Uint16Array.from(p.indices);
        type = gl.UNSIGNED_SHORT;
      } else if (uintExt) {
        idx = p.indices instanceof Uint32Array ? p.indices : Uint32Array.from(p.indices);
        type = gl.UNSIGNED_INT;
      } else return null;
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      boundMesh = null;
      const m = mat || { color: [1, 1, 1, 1], metallic: 0, roughness: 1, emissive: [0, 0, 0], texture: null };
      const em = m.emissive || [0, 0, 0];
      const emMax = Math.max(em[0], em[1], em[2]);
      const baseMax = Math.max(m.color[0], m.color[1], m.color[2]);
      // 바탕색이 거의 검고 스스로 빛나면 '빛나는 조각', 아니면 빛을 살짝 더해요
      const glow = emMax > 0.2 && baseMax < 0.1;
      return {
        vbo,
        ibo,
        count: idx.length,
        type,
        glow,
        tint: glow ? em.slice(0, 3) : [m.color[0] * GRAIN_TINT, m.color[1] * GRAIN_TINT, m.color[2] * GRAIN_TINT],
        emitAdd: !glow && emMax > 0 ? em.map((v) => v * 0.6) : null,
        spec: Math.max(0.05, Math.min(0.9, m.metallic * 0.55 + (1 - m.roughness) * 0.45)),
        tex: null,
        texIndex: m.texture,
      };
    }

    /** 읽은 GLB → 그릴 수 있는 모델 { nodes, prims, roots, byName, rest(가만히 있는 월드 행렬), center/size(노드별) } */
    function createModel(g) {
      const prims = g.meshes.map((mesh) => mesh.map((p) => buildPrim(p, g.materials[p.material])));
      // 그림 질감은 다 읽히면 붙어요 (그동안은 결 질감)
      g.images.forEach((img, ii) => {
        const users = [];
        prims.forEach((list) => list.forEach((p) => p && p.texIndex === ii && users.push(p)));
        if (users.length) imageTexture(img, users);
      });
      const rest = SZ.gltf.worldMatrices(g);
      const nodes = g.nodes.map((n) => {
        const out = { name: n.name, mesh: n.mesh, children: n.children, local: n.local, center: [0, 0, 0], size: [0, 0, 0] };
        if (n.mesh >= 0) {
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (const p of g.meshes[n.mesh]) {
            for (let k = 0; k < p.positions.length; k += 3) {
              for (let j = 0; j < 3; j++) {
                lo[j] = Math.min(lo[j], p.positions[k + j]);
                hi[j] = Math.max(hi[j], p.positions[k + j]);
              }
            }
          }
          out.center = lo.map((v, j) => (v + hi[j]) / 2);
          out.size = lo.map((v, j) => hi[j] - v);
        }
        return out;
      });
      const byName = new Map();
      nodes.forEach((n, i) => byName.set(n.name, i));
      return { nodes, prims, roots: g.roots, byName, rest };
    }

    const stack = [];
    for (let i = 0; i < 40; i++) stack.push(m4.create());

    /**
     * 모델 그리기. base: 월드 행렬, opts = { em: 전체에 더할 빛, ov: {노드이름: {x,y,z,rx,ry,rz,em,hide}} }
     * ov는 그 노드 자리(관절)에서 더 옮기고 돌려요. em은 빛나는 조각에만 더해요.
     * start를 주면 그 노드만(자식 포함) 그리고, skipLocal이면 그 노드 자신의 자리 대신 base를 써요.
     */
    function drawModel(model, base, opts, start, skipLocal) {
      use(lit);
      enableAttribs(4);
      if (start === undefined) for (const r of model.roots) drawNode(model, r, base, opts, 0, false);
      else drawNode(model, start, base, opts, 0, !!skipLocal);
    }

    function drawNode(model, i, parent, opts, depth, skipLocal) {
      const node = model.nodes[i];
      const ov = opts && opts.ov && opts.ov[node.name];
      if (ov && ov.hide) return;
      const M = stack[Math.min(depth, stack.length - 1)];
      if (skipLocal) m4.copy(M, parent);
      else m4.multiply(M, parent, node.local);
      if (ov) {
        if (ov.x || ov.y || ov.z) m4.translate(M, ov.x || 0, ov.y || 0, ov.z || 0);
        if (ov.ry) m4.rotateY(M, ov.ry);
        if (ov.rx) m4.rotateX(M, ov.rx);
        if (ov.rz) m4.rotateZ(M, ov.rz);
      }
      if (node.mesh >= 0) drawPrims(model.prims[node.mesh], M, opts && opts.em, ov && ov.em, opts && opts.tint);
      if (!(opts && opts.noChildren)) for (const c of node.children) drawNode(model, c, M, opts, depth + 1, false);
    }

    const emSum = [0, 0, 0];
    const tintMul = [0, 0, 0];
    /** tint: 빛나지 않는 조각의 색에 곱할 값 (같은 모델을 다른 색으로, 예: 지휘관) */
    function drawPrims(list, M, em, glowEm, tint) {
      for (const p of list) {
        if (!p) continue;
        bindMesh(p);
        let col = p.tint;
        if (tint && !p.glow) {
          tintMul[0] = col[0] * tint[0];
          tintMul[1] = col[1] * tint[1];
          tintMul[2] = col[2] * tint[2];
          col = tintMul;
        }
        let e = em || null;
        const extra = p.glow ? glowEm : p.emitAdd;
        if (extra) {
          emSum[0] = (em ? em[0] : 0) + extra[0];
          emSum[1] = (em ? em[1] : 0) + extra[1];
          emSum[2] = (em ? em[2] : 0) + extra[2];
          e = emSum;
        }
        setMaterial(M, p.tex || 'grain', col, e, p.spec, p.glow ? 1 : 0);
        gl.drawElements(gl.TRIANGLES, p.count, p.type, 0);
      }
    }

    /* ---------- 효과 (빛 점·광선) ---------- */
    const FX_STRIDE = 9;
    function fxLayer(maxQuads, additive, depthTest) {
      const data = new Float32Array(maxQuads * 4 * FX_STRIDE);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      return { data, vbo, n: 0, max: maxQuads, additive, depthTest };
    }
    const fxIndex = (function () {
      const max = 2400;
      const idx = new Uint16Array(max * 6);
      for (let q = 0; q < max; q++) {
        idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
      }
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      return ibo;
    })();
    const layers = { alpha: fxLayer(600, false, true), add: fxLayer(2400, true, true), overlay: fxLayer(48, true, false) };

    function pushVert(L, x, y, z, u, v, r, g, b, a) {
      const o = L.n * 4 * FX_STRIDE + L._k * FX_STRIDE;
      const d = L.data;
      d[o] = x;
      d[o + 1] = y;
      d[o + 2] = z;
      d[o + 3] = u;
      d[o + 4] = v;
      d[o + 5] = r;
      d[o + 6] = g;
      d[o + 7] = b;
      d[o + 8] = a;
      L._k++;
    }

    /** 카메라를 향한 빛 점 */
    function sprite(layer, x, y, z, size, r, g, b, a) {
      const L = layers[layer];
      if (L.n >= L.max) return;
      const R = frameInfo.right, U = frameInfo.up;
      const s = size * 0.5;
      const rx = R[0] * s, ry = R[1] * s, rz = R[2] * s;
      const ux = U[0] * s, uy = U[1] * s, uz = U[2] * s;
      L._k = 0;
      pushVert(L, x - rx - ux, y - ry - uy, z - rz - uz, 0, 1, r, g, b, a);
      pushVert(L, x + rx - ux, y + ry - uy, z + rz - uz, 1, 1, r, g, b, a);
      pushVert(L, x + rx + ux, y + ry + uy, z + rz + uz, 1, 0, r, g, b, a);
      pushVert(L, x - rx + ux, y - ry + uy, z - rz + uz, 0, 0, r, g, b, a);
      L.n++;
    }

    /** 두 점을 잇는 빛줄기 (총알 궤적) */
    function beam(layer, x1, y1, z1, x2, y2, z2, width, r, g, b, a) {
      const L = layers[layer];
      if (L.n >= L.max) return;
      const c = frameInfo.cam;
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      const vx = c[0] - x1, vy = c[1] - y1, vz = c[2] - z1;
      let px = dy * vz - dz * vy, py = dz * vx - dx * vz, pz = dx * vy - dy * vx;
      const pl = Math.hypot(px, py, pz) || 1;
      const s = width * 0.5 / pl;
      px *= s;
      py *= s;
      pz *= s;
      L._k = 0;
      pushVert(L, x1 - px, y1 - py, z1 - pz, 0, 0.5, r, g, b, a);
      pushVert(L, x1 + px, y1 + py, z1 + pz, 1, 0.5, r, g, b, a);
      pushVert(L, x2 + px, y2 + py, z2 + pz, 1, 0.5, r, g, b, a);
      pushVert(L, x2 - px, y2 - py, z2 - pz, 0, 0.5, r, g, b, a);
      L.n++;
    }

    function drawFx(layer) {
      const L = layers[layer];
      if (!L.n) return;
      use(fxp);
      enableAttribs(3);
      gl.uniformMatrix4fv(fxp.u.u_vp, false, vp);
      gl.uniform1i(fxp.u.u_tex, 0);
      gl.uniform3fv(fxp.u.u_cam, frameInfo.cam);
      gl.uniform1f(fxp.u.u_fogDen, frameInfo.fogDen);
      bindTex('glow');
      gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.data.subarray(0, L.n * 4 * FX_STRIDE));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fxIndex);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FX_STRIDE * 4, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, FX_STRIDE * 4, 12);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, FX_STRIDE * 4, 20);
      boundMesh = null;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, L.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      if (L.depthTest) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      gl.drawElements(gl.TRIANGLES, L.n * 6, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      L.n = 0;
    }

    function resetFx() {
      Object.keys(layers).forEach((k) => (layers[k].n = 0));
    }

    return { gl, canvas, resize, setLevel, frame, drawWorld, box, createModel, drawModel, clearDepth, setAmbient, sprite, beam, drawFx, resetFx, MAXL };
  }

  SZ.renderer = { create: createRenderer, MeshBuilder };
})(typeof window !== 'undefined' ? window : globalThis);

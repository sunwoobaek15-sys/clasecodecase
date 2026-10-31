// 3인칭 카메라: 부드러운 추적, 자동 줌, 가장자리/낙하 시 시야 조정, 흔들림
import * as THREE from 'three';

function damp(a, b, r, dt) { return a + (b - a) * (1 - Math.exp(-r * dt)); }
function dampAngle(a, b, r, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-r * dt));
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.5;
    this.userPitch = 0.5;
    this.dist = 13;
    this.target = new THREE.Vector3(0, 1, 0);
    this.shakeAmt = 0;
    this.mode = 'menu';
    this.orbitT = 0;
    this.tmp = new THREE.Vector3();
    this.manualT = 0;
  }

  /** 마우스/터치 드래그 회전 */
  rotate(dx, dy) {
    this.yaw -= dx;
    this.userPitch = Math.max(0.12, Math.min(1.25, this.userPitch + dy));
    this.manualT = 2;
  }

  shake(a) { this.shakeAmt = Math.min(0.8, this.shakeAmt + a); }

  snapTo(focus) {
    this.target.set(focus.x, focus.y + 1.2, focus.z);
    // 경기장 중앙을 바라보는 방향으로 시작
    this.yaw = Math.atan2(focus.x, focus.z);
  }

  /** forward/right 벡터 (월드 XZ) */
  basis() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  }

  update(dt, opts) {
    const cam = this.camera;
    let tx, ty, tz, wantDist, wantPitch;
    this.manualT = Math.max(0, this.manualT - dt);

    if (opts.mode === 'menu' || opts.mode === 'lobby' || opts.mode === 'results') {
      this.orbitT += dt;
      const f = opts.focus || { x: 0, y: 0, z: 0 };
      if (opts.mode === 'menu') { wantDist = 36; wantPitch = 0.55; this.yaw += dt * 0.06; }
      else if (opts.mode === 'lobby') { wantDist = opts.dist || 10.5; wantPitch = 0.18; this.yaw = dampAngle(this.yaw, opts.yaw ?? 0, 2, dt); }
      else { wantDist = 7.5; wantPitch = 0.22; if (this.manualT <= 0) this.yaw += dt * 0.15; }
      tx = f.x; ty = f.y + (opts.mode === 'menu' ? 0 : 1.1); tz = f.z;
      this.target.set(damp(this.target.x, tx, 3, dt), damp(this.target.y, ty, 3, dt), damp(this.target.z, tz, 3, dt));
    } else {
      const f = opts.focus;
      tx = f.x; ty = f.y + 1.2; tz = f.z;
      wantPitch = this.userPitch;
      // 낙하 중이면 카메라는 경기장 높이 근처에 머물며 아래를 내려다본다
      if (f.y < -0.8) {
        ty = Math.max(-2.5, f.y + 1.2) ;
        wantPitch = Math.max(wantPitch, 0.95);
      }
      // 자동 줌: 주변 플레이어가 모두 보이도록
      let spread = 0;
      for (const o of opts.others || []) {
        const d = Math.hypot(o.x - f.x, o.z - f.z);
        if (d < 15) spread = Math.max(spread, d);
      }
      const r = Math.hypot(f.x, f.z);
      wantDist = 10.5 + spread * 0.42 + Math.max(0, r - 11) * 0.5;
      if (opts.overview) { tx = 0; ty = 0; tz = 0; wantDist = 34; wantPitch = 0.9; }
      wantDist = Math.min(opts.overview ? 34 : 19, wantDist);
      // 가장자리에서는 낭떠러지가 보이도록 살짝 위에서 본다
      if (r > 12.5 && !opts.overview) wantPitch = Math.max(wantPitch, 0.55 + (r - 12.5) * 0.04);
      const k = opts.overview ? 3 : 9;
      this.target.set(damp(this.target.x, tx, k, dt), damp(this.target.y, ty, opts.falling ? 3 : 6, dt), damp(this.target.z, tz, k, dt));
    }

    this.dist = damp(this.dist, wantDist, 2.2, dt);
    this.pitch = damp(this.pitch, wantPitch, 3.5, dt);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + sp * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt *= Math.exp(-9 * dt);
    }
    this.tmp.copy(this.target);
    if (opts.lookOffset) this.tmp.add(opts.lookOffset);
    cam.lookAt(this.tmp);
  }
}

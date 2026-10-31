// 클라이언트 예측(로컬 플레이어) + 서버 보정(reconciliation) + 원격 플레이어 보간(interpolation)
import { DT } from '../../../shared/src/constants.js';
import { SP, FLAG, PHASE } from '../../../shared/src/messages.js';
import { createWorld, applyEvents, moverShift } from '../../../shared/src/arena.js';

const _shift = {};
import { createPlayerState, stepPlayer } from '../../../shared/src/physics.js';

const INTERP_DELAY = 0.1;
const now = () => performance.now() / 1000;

export function applySnapToState(st, a) {
  st.x = a[SP.X]; st.y = a[SP.Y]; st.z = a[SP.Z];
  st.vx = a[SP.VX]; st.vy = a[SP.VY]; st.vz = a[SP.VZ];
  st.yaw = a[SP.YAW];
  const f = a[SP.FLAGS];
  st.grounded = !!(f & FLAG.GROUNDED);
  st.alive = !(f & FLAG.OUT);
  st.jumpCut = !!(f & FLAG.JUMPCUT);
  st.jumpHeld = !!(f & FLAG.JUMPHELD);
  st.dashT = a[SP.DASHT]; st.dashCd = a[SP.DASHCD]; st.stun = a[SP.STUN];
  st.coyote = a[SP.COYOTE]; st.jumpBuf = a[SP.JUMPBUF];
  st.mover = a[14] ?? -1;
}

export class NetSync {
  constructor() {
    this.world = createWorld();
    this.reset();
  }

  reset() {
    this.snaps = [];
    this.offset = null;
    this.phase = PHASE.LOBBY;
    this.local = null;
    this.localId = null;
    this.pending = [];
    this.seq = this.seq || 0;
    this.localT = 0;
    this.vis = { x: 0, y: 0, z: 0 };
    this.lastAck = 0;
    this.corrections = 0;
    this.ghost = null;
    this.world.t = 0;
  }

  setTiles(str) {
    for (let i = 0; i < this.world.tiles.length; i++) this.world.tiles[i] = +str[i] || 0;
  }

  setEvents(list) { applyEvents(this.world, list || []); }

  serverNow() {
    if (this.offset === null) return this.snaps.length ? this.snaps[this.snaps.length - 1].mt : 0;
    return now() + this.offset;
  }

  latest() { return this.snaps[this.snaps.length - 1]; }

  onSnapshot(m, localId, rtt) {
    const t = now();
    const players = new Map();
    for (const a of m.p) players.set(a[SP.ID], a);
    const ghosts = new Map();
    for (const g of m.g || []) ghosts.set(g[0], g);
    const snap = { mt: m.mt, ph: m.ph, players, ghosts, recv: t };
    // 내 방해꾼 조준점: 로컬 예측값을 서버 값 쪽으로 보정
    const myG = ghosts.get(localId);
    if (myG) {
      if (!this.ghost || Math.hypot(this.ghost.x - myG[1], this.ghost.z - myG[2]) > 3) this.ghost = { x: myG[1], z: myG[2], cd: myG[3] };
      else { this.ghost.x += (myG[1] - this.ghost.x) * 0.15; this.ghost.z += (myG[2] - this.ghost.z) * 0.15; this.ghost.cd = myG[3]; }
    } else this.ghost = null;
    const prevPhase = this.phase;
    this.phase = m.ph;
    this.snaps.push(snap);
    while (this.snaps.length > 40) this.snaps.shift();

    // 시계 동기화: 가장 지연이 적은 샘플 쪽으로 빠르게, 그 외에는 천천히 따라간다
    const sample = m.mt - t;
    if (m.ph !== PHASE.PLAYING || this.offset === null || prevPhase !== PHASE.PLAYING) this.offset = sample;
    else if (sample > this.offset) this.offset += (sample - this.offset) * 0.5;
    else this.offset += (sample - this.offset) * 0.03;

    this.localId = localId;
    const me = players.get(localId);
    if (!me) { this.local = null; return; }
    if (!this.local) { this.local = createPlayerState(); this.local.key = localId; }

    const predicting = m.ph === PHASE.PLAYING && !(me[SP.FLAGS] & FLAG.OUT);
    if (!predicting) {
      applySnapToState(this.local, me);
      this.pending.length = 0;
      this.localT = m.mt;
      this.vis.x = this.vis.y = this.vis.z = 0;
      return;
    }
    if (prevPhase !== PHASE.PLAYING) {
      this.localT = this.predictTarget(rtt);
      this.pending.length = 0;
    }

    // 서버 보정: 서버 상태에서 아직 확인되지 않은 입력을 다시 시뮬레이션
    const ack = m.ack;
    this.lastAck = ack;
    while (this.pending.length && this.pending[0].seq <= ack) this.pending.shift();
    const L = this.local;
    const ox = L.x, oy = L.y, oz = L.z;
    applySnapToState(L, me);
    const w = this.world;
    const keepT = w.t;
    for (const p of this.pending) {
      w.t = p.t;
      stepPlayer(L, p.input, DT, w);
    }
    w.t = keepT;
    const dx = ox - L.x, dy = oy - L.y, dz = oz - L.z;
    const err = Math.hypot(dx, dy, dz);
    if (err > 0.02) this.corrections++;
    if (err > 4) { this.vis.x = this.vis.y = this.vis.z = 0; }
    else { this.vis.x += dx; this.vis.y += dy; this.vis.z += dz; }
  }

  predictTarget(rtt) {
    return this.serverNow() + rtt + DT * 1.5;
  }

  canPredict() {
    return this.phase === PHASE.PLAYING && this.local && this.local.alive;
  }

  /** 고정 틱마다 호출: 입력을 기록·예측하고 서버로 보낼 배열을 돌려준다 */
  tickLocal(input, rtt) {
    // 예측 시계를 서버 기준 목표 시각 쪽으로 부드럽게 보정
    const target = this.predictTarget(rtt);
    this.localT += DT;
    const drift = target - this.localT;
    if (Math.abs(drift) > 0.5) this.localT = target;
    else this.localT += drift * 0.05;
    this.world.t = this.localT;
    const seq = ++this.seq;
    const ev = stepPlayer(this.local, input, DT, this.world);
    this.pending.push({ seq, input, t: this.localT });
    if (this.pending.length > 180) this.pending.shift();
    return { ev, packet: [seq, Math.round(input.mx * 1000) / 1000, Math.round(input.mz * 1000) / 1000, input.buttons] };
  }

  /** 방해꾼 입력: 조준점을 로컬에서 바로 움직이고 서버로 보낼 패킷을 만든다 */
  tickGhost(input, speed, bounds) {
    const seq = ++this.seq;
    if (this.ghost) {
      this.ghost.x += input.mx * speed * DT;
      this.ghost.z += input.mz * speed * DT;
      if (bounds) {
        this.ghost.x = Math.min(bounds.x1, Math.max(bounds.x0, this.ghost.x));
        this.ghost.z = Math.min(bounds.z1, Math.max(bounds.z0, this.ghost.z));
      } else {
        const r = Math.hypot(this.ghost.x, this.ghost.z);
        if (r > 18) { this.ghost.x *= 18 / r; this.ghost.z *= 18 / r; }
      }
      this.ghost.cd = Math.max(0, this.ghost.cd - DT);
    }
    return [seq, Math.round(input.mx * 1000) / 1000, Math.round(input.mz * 1000) / 1000, input.buttons];
  }

  sampleGhost(id) {
    const snaps = this.snaps;
    if (!snaps.length) return null;
    const last = snaps[snaps.length - 1];
    const renderT = last.ph === PHASE.PLAYING ? this.serverNow() - INTERP_DELAY : last.mt;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].mt <= renderT) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    if (!a) a = snaps[0];
    const ga = a.ghosts.get(id);
    const gb = b && b.ghosts.get(id);
    if (!ga) return gb ? { x: gb[1], z: gb[2], cd: gb[3] } : null;
    if (!gb || b.mt <= a.mt) return { x: ga[1], z: ga[2], cd: ga[3] };
    const k = Math.min(1, Math.max(0, (renderT - a.mt) / (b.mt - a.mt)));
    return { x: ga[1] + (gb[1] - ga[1]) * k, z: ga[2] + (gb[2] - ga[2]) * k, cd: gb[3] };
  }

  decayVisual(dt) {
    const k = Math.exp(-10 * dt);
    this.vis.x *= k; this.vis.y *= k; this.vis.z *= k;
  }

  displayTime() {
    return this.canPredict() ? this.localT : this.serverNow();
  }

  /** 원격 플레이어의 보간 상태 */
  sample(id, out) {
    const snaps = this.snaps;
    if (!snaps.length) return null;
    const last = snaps[snaps.length - 1];
    let renderT = this.serverNow() - INTERP_DELAY;
    if (last.ph !== PHASE.PLAYING) renderT = last.mt;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].mt <= renderT) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    }
    if (!a) a = snaps[0];
    const pa = a.players.get(id);
    if (!pa) return null;
    const pb = b && b.players.get(id);
    out.flags = (pb || pa)[SP.FLAGS];
    out.mover = (pb || pa)[14] ?? -1;
    if (pb && b.mt > a.mt) {
      const k = Math.min(1, Math.max(0, (renderT - a.mt) / (b.mt - a.mt)));
      out.x = pa[SP.X] + (pb[SP.X] - pa[SP.X]) * k;
      out.y = pa[SP.Y] + (pb[SP.Y] - pa[SP.Y]) * k;
      out.z = pa[SP.Z] + (pb[SP.Z] - pa[SP.Z]) * k;
      out.vx = pa[SP.VX] + (pb[SP.VX] - pa[SP.VX]) * k;
      out.vy = pa[SP.VY] + (pb[SP.VY] - pa[SP.VY]) * k;
      out.vz = pa[SP.VZ] + (pb[SP.VZ] - pa[SP.VZ]) * k;
      let dy = pb[SP.YAW] - pa[SP.YAW];
      dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      out.yaw = pa[SP.YAW] + dy * k;
    } else {
      // 최신 스냅샷 이후는 속도로 짧게 외삽
      const ex = last.ph === PHASE.PLAYING ? Math.min(0.12, Math.max(0, renderT - a.mt)) : 0;
      out.x = pa[SP.X] + pa[SP.VX] * ex;
      out.y = pa[SP.Y] + (pa[SP.FLAGS] & FLAG.GROUNDED ? 0 : pa[SP.VY] * ex);
      out.z = pa[SP.Z] + pa[SP.VZ] * ex;
      out.vx = pa[SP.VX]; out.vy = pa[SP.VY]; out.vz = pa[SP.VZ];
      out.yaw = pa[SP.YAW];
    }
    // 움직이는 발판 위의 원격 플레이어는 표시 시각의 발판 위치에 맞춘다
    if (out.mover >= 0 && out.flags & FLAG.GROUNDED && this.phase === PHASE.PLAYING) {
      const sh = moverShift(this.world, out.mover, renderT, this.displayTime(), _shift);
      if (sh.rot !== undefined && !this.world.course) {
        const c = Math.cos(sh.rot), s = Math.sin(sh.rot);
        const x = out.x * c - out.z * s, z = out.x * s + out.z * c;
        out.x = x; out.z = z;
      } else { out.x += sh.dx; out.z += sh.dz; }
      if (sh.y !== null) out.y = sh.y;
    }
    return out;
  }
}

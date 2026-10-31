// 한 라운드의 권위 시뮬레이션: 물리, 충돌, 이벤트, 레이스(체크포인트·결승), 탈락, 방해꾼 폭탄, 종료 판정.
// type: 'race' | 'survival' | 'final' | 'classic'
import { DT, PHYS, GHOST } from '../../../shared/src/constants.js';
import { createWorld, applyEvents, groundAt } from '../../../shared/src/arena.js';
import { RACE, checkpointFor } from '../../../shared/src/course.js';
import { stepPlayer, resolvePlayerCollisions, createPlayerState, EV } from '../../../shared/src/physics.js';
import { FLAG, BTN } from '../../../shared/src/messages.js';
import { EventDirector } from './EventDirector.js';
import { BotBrain, GhostBrain } from './Bot.js';

const r2 = (v) => Math.round(v * 100) / 100;
const _g = { h: 0, vx: 0, vz: 0, mover: -1 };

export class Match {
  /**
   * roster: 이번 라운드에 관여하는 모든 플레이어. p.roundActive가 false면 처음부터 방해꾼(유령).
   * 이전 버전 호환: roundActive가 정의되지 않았으면 모두 참가자.
   */
  constructor(roster, { rand = Math.random, events = true, type = 'classic', quota = 1 } = {}) {
    this.rand = rand;
    this.type = type;
    this.quota = quota;
    this.eventsEnabled = events && type !== 'race';
    this.players = roster.filter((p) => p.roundActive !== false);
    this.world = createWorld();
    if (type === 'race') this.world.course = RACE;
    this.director = new EventDirector(rand, { offset: type === 'final' ? 40 : 0 });
    this.pairCd = new Map();
    this.t = 0;
    this.tick = 0;
    this.over = false;
    this.fx = [];
    this.elims = [];
    this.finishOrder = [];
    this.ghosts = new Map();
    this.bombs = [];
    this.bombId = 1;

    const n = this.players.length;
    const offset = rand() * Math.PI * 2;
    this.players.forEach((p, i) => {
      let x, z, yaw;
      if (type === 'race') {
        const cols = 4, row = Math.floor(i / cols), col = i % cols;
        x = (col - (Math.min(cols, n - row * cols) - 1) / 2) * 2.4;
        z = -2.5 + row * 2.4;
        yaw = 0;
      } else {
        const a = offset + (i / n) * Math.PI * 2;
        x = Math.cos(a) * 11; z = Math.sin(a) * 11;
        yaw = Math.atan2(-x, -z);
      }
      p.state = createPlayerState(x, z, yaw);
      p.state.key = p.id;
      p.rank = 0;
      p.elimAt = 0;
      p.finished = false;
      p.forfeited = false;
      p.progress = z;
      p.cp = 0;
      p.resetInputs();
      p.bot = p.isBot ? new BotBrain(rand) : null;
    });
    for (const p of roster) if (p.roundActive === false) this.addGhost(p);
  }

  addGhost(p) {
    if (this.ghosts.has(p.id)) return;
    const start = this.world.course ? { x: 0, z: Math.max(10, p.state ? p.state.z : 10) } : { x: 0, z: 0 };
    this.ghosts.set(p.id, { p, x: start.x, z: start.z, cd: 2.5, brain: p.isBot ? new GhostBrain(this.rand) : null });
    p.resetInputs();
  }

  aliveCount() {
    return this.players.filter((p) => p.state.alive).length;
  }

  activeRacers() {
    return this.players.filter((p) => !p.finished && !p.forfeited);
  }

  /** frozen: 소개/카운트다운/결과 중에는 입력을 받지 않는다 */
  step(frozen = false) {
    this.tick++;
    const world = this.world;
    if (!frozen) {
      this.t += DT;
      world.t = this.t;
      if (this.eventsEnabled) this.director.update(this.t, world.tiles);
      if (this.director.changed) applyEvents(world, this.director.list());
    }
    const zero = { mx: 0, mz: 0, buttons: 0 };
    const stepped = [];
    for (const p of this.players) {
      // 탈락·완주한 선수의 입력은 방해꾼(stepGhosts)이 처리한다 — 여기서 먼저 꺼내면 입력이 사라진다
      if (!p.state.alive && !frozen) continue;
      let input;
      if (frozen) { if (!p.isBot && p.connected) p.takeInput(); input = zero; }
      else if (p.isBot) input = this.type === 'race' ? p.bot.thinkRace(p, this.players, world, DT) : p.bot.think(p, this.players, world, DT);
      else if (!p.connected) input = zero;
      else input = p.takeInput();
      if (!p.state.alive) continue;
      const ev = stepPlayer(p.state, input, DT, world);
      if (ev & EV.SWEPT) this.fx.push({ k: 'swept', id: p.id, x: r2(p.state.x), y: r2(p.state.y + 0.8), z: r2(p.state.z) });
      stepped.push(p.state);
    }
    resolvePlayerCollisions(stepped, this.pairCd, DT, (a, b, power, x, y, z, dash) => {
      this.fx.push({ k: 'hit', a: a.key, b: b.key, x: r2(x), y: r2(y), z: r2(z), pw: r2(power), d: dash ? 1 : 0 });
    });

    if (!frozen) {
      this.stepGhosts();
      this.stepBombs();
    }

    if (this.type === 'race') this.stepRace();
    else this.stepElimination();
  }

  stepRace() {
    const c = RACE;
    for (const p of this.players) {
      const s = p.state;
      if (p.finished || p.forfeited) continue;
      if (!s.alive) {
        // 레이스에서는 떨어져도 탈락하지 않고 체크포인트에서 다시 시작
        const cp = c.checkpoints[p.cp];
        const nx = cp.x + (this.rand() - 0.5) * 4;
        p.state = createPlayerState(nx, cp.sz, 0);
        p.state.key = p.id;
        p.state.y = cp.y;
        this.fx.push({ k: 'respawn', id: p.id, x: r2(nx), y: cp.y, z: cp.sz });
        continue;
      }
      if (s.grounded) {
        const cp = checkpointFor(c, s.z);
        if (cp > p.cp) p.cp = cp;
      }
      if (s.z > p.progress && s.y > -1) p.progress = s.z;
      if (s.grounded && s.z >= c.finishZ && s.y >= 2.5) {
        p.finished = true;
        p.finishAt = this.t;
        this.finishOrder.push(p);
        s.alive = false;
        this.fx.push({ k: 'finish', id: p.id, n: this.finishOrder.length, x: r2(s.x), y: r2(s.y), z: r2(s.z) });
        this.addGhost(p);
      }
    }
    if (!this.over) {
      const left = this.activeRacers().length;
      if (this.finishOrder.length >= this.quota || this.t >= c.timeLimit || left === 0) this.over = true;
    }
  }

  stepElimination() {
    // 같은 틱에 떨어진 플레이어는 같은 순위를 공유한다 (동시 탈락 처리)
    const fallen = this.players.filter((p) => !p.state.alive && !p.rank);
    if (fallen.length) {
      const rank = this.aliveCount() + 1;
      for (const p of fallen) {
        p.rank = rank;
        p.elimAt = this.t;
        this.elims.push({ id: p.id, rank, at: r2(this.t), x: r2(p.state.x), z: r2(p.state.z) });
        this.addGhost(p);
      }
    }
    if (this.over) return;
    const alive = this.players.filter((p) => p.state.alive);
    if (this.type === 'survival') {
      if (alive.length <= this.quota) this.over = true;
    } else if (alive.length === 0 || (alive.length === 1 && this.players.length > 1)) {
      this.over = true;
      for (const p of alive) p.rank = 1;
    }
  }

  // ---------- 방해꾼 ----------
  stepGhosts() {
    const b = this.world.course ? this.world.course.bounds : null;
    for (const g of this.ghosts.values()) {
      g.cd = Math.max(0, g.cd - DT);
      const p = g.p;
      let input;
      if (g.brain) input = g.brain.think(g, this.players, this.world, DT);
      else if (p.connected) input = p.takeInput();
      else input = { mx: 0, mz: 0, buttons: 0 };
      g.x += (input.mx || 0) * GHOST.speed * DT;
      g.z += (input.mz || 0) * GHOST.speed * DT;
      if (b) { g.x = Math.min(b.x1, Math.max(b.x0, g.x)); g.z = Math.min(b.z1, Math.max(b.z0, g.z)); }
      else { const r = Math.hypot(g.x, g.z); if (r > 18) { g.x *= 18 / r; g.z *= 18 / r; } }
      if (input.buttons & BTN.DASH && g.cd <= 0) {
        g.cd = GHOST.cooldown;
        groundAt(this.world, g.x, g.z, 50, _g);
        const y = _g.h === -Infinity ? 0 : _g.h;
        this.bombs.push({ id: this.bombId++, owner: p.id, x: g.x, z: g.z, y, at: this.t + GHOST.fuse });
        this.fx.push({ k: 'bw', id: p.id, x: r2(g.x), y: r2(y), z: r2(g.z), f: GHOST.fuse });
      }
    }
  }

  stepBombs() {
    if (!this.bombs.length) return;
    const keep = [];
    for (const bomb of this.bombs) {
      if (this.t < bomb.at) { keep.push(bomb); continue; }
      this.fx.push({ k: 'bx', id: bomb.owner, x: r2(bomb.x), y: r2(bomb.y), z: r2(bomb.z) });
      for (const p of this.players) {
        const s = p.state;
        if (!s.alive) continue;
        if (Math.abs(s.y - bomb.y) > 2.5) continue;
        let dx = s.x - bomb.x, dz = s.z - bomb.z;
        let d = Math.hypot(dx, dz);
        if (d > GHOST.radius) continue;
        if (d < 0.2) { const a = this.rand() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); d = 1; }
        const k = 1 - (d / GHOST.radius) * 0.4;
        s.vx += (dx / d) * GHOST.push * k;
        s.vz += (dz / d) * GHOST.push * k;
        s.vy = Math.max(s.vy, GHOST.pop * k);
        s.grounded = false;
        s.mover = -1;
        s.jumping = false;
        s.jumpCut = false;
        s.dashT = 0;
        s.stun = Math.max(s.stun, GHOST.stun);
      }
    }
    this.bombs = keep;
  }

  /** 기권(나가기) 처리 */
  forfeit(player) {
    player.forfeited = true;
    this.ghosts.delete(player.id);
    if (!player.state.alive) return;
    player.state.alive = false;
    player.state.y = PHYS.elimY - 1;
  }

  /**
   * 라운드 결과: qualified(통과 id 목록), groups(탈락 그룹, 먼저 탈락한 순서 — 같은 그룹은 같은 순위)
   */
  outcome() {
    if (this.type === 'race') {
      const finished = this.finishOrder.map((p) => p.id);
      const rest = this.players.filter((p) => !p.finished).sort((a, b) => (a.forfeited - b.forfeited) || b.progress - a.progress);
      const qualified = [...finished];
      while (qualified.length < this.quota && rest.length && !rest[0].forfeited) qualified.push(rest.shift().id);
      // 진행도가 낮은 사람이 먼저 탈락한 것으로 취급
      const groups = rest.reverse().map((p) => [p.id]);
      return { qualified, groups };
    }
    const byRank = new Map();
    for (const p of this.players) if (p.rank) { if (!byRank.has(p.rank)) byRank.set(p.rank, []); byRank.get(p.rank).push(p.id); }
    if (this.type === 'survival') {
      let qualified = this.players.filter((p) => p.state.alive).map((p) => p.id);
      const ranks = [...byRank.keys()].sort((a, b) => b - a);
      // 마지막 생존자들이 동시에 떨어져 아무도 안 남으면 마지막 탈락 그룹이 통과
      if (!qualified.length && ranks.length) qualified = byRank.get(ranks.pop());
      return { qualified, groups: ranks.map((r) => byRank.get(r)) };
    }
    const ranks = [...byRank.keys()].sort((a, b) => b - a);
    const winners = byRank.get(1) || this.players.filter((p) => p.state.alive).map((p) => p.id);
    return { qualified: winners, groups: ranks.filter((r) => r !== 1).map((r) => byRank.get(r)) };
  }

  snapshotPlayers() {
    return this.players.map((p) => {
      const s = p.state;
      let f = 0;
      if (s.grounded) f |= FLAG.GROUNDED;
      if (s.dashT > 0) f |= FLAG.DASHING;
      if (s.stun > 0) f |= FLAG.STUNNED;
      if (!s.alive) f |= FLAG.OUT;
      if (!p.connected) f |= FLAG.DISCONNECTED;
      if (s.jumpCut) f |= FLAG.JUMPCUT;
      if (s.jumpHeld) f |= FLAG.JUMPHELD;
      if (p.finished) f |= FLAG.FINISHED;
      if (s.jumping) f |= FLAG.JUMPING;
      return [p.id, r2(s.x), r2(s.y), r2(s.z), r2(s.vx), r2(s.vy), r2(s.vz), r2(s.yaw), f, r2(s.dashT), r2(s.dashCd), r2(s.stun), r2(s.coyote), r2(s.jumpBuf), s.mover, r2(s.hitCd || 0)];
    });
  }

  snapshotGhosts() {
    const out = [];
    for (const g of this.ghosts.values()) out.push([g.p.id, r2(g.x), r2(g.z), r2(g.cd)]);
    return out;
  }
}

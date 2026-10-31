// 한 경기의 권위 시뮬레이션: 물리, 충돌, 이벤트, 탈락, 승리 판정.
import { DT, PHYS } from '../../../shared/src/constants.js';
import { createWorld, applyEvents } from '../../../shared/src/arena.js';
import { stepPlayer, resolvePlayerCollisions, createPlayerState, EV } from '../../../shared/src/physics.js';
import { FLAG } from '../../../shared/src/messages.js';
import { EventDirector } from './EventDirector.js';
import { BotBrain } from './Bot.js';

const r2 = (v) => Math.round(v * 100) / 100;

export class Match {
  constructor(participants, { rand = Math.random, events = true } = {}) {
    this.eventsEnabled = events;
    this.players = participants;
    this.world = createWorld();
    this.director = new EventDirector(rand);
    this.pairCd = new Map();
    this.t = 0;
    this.tick = 0;
    this.over = false;
    this.fx = [];
    this.elims = [];
    this.finalRanks = null;
    const n = participants.length;
    const offset = rand() * Math.PI * 2;
    participants.forEach((p, i) => {
      const a = offset + (i / n) * Math.PI * 2;
      const x = Math.cos(a) * 11, z = Math.sin(a) * 11;
      p.state = createPlayerState(x, z, Math.atan2(-x, -z));
      p.state.key = p.id;
      p.rank = 0;
      p.elimAt = 0;
      p.resetInputs();
      if (p.isBot) p.bot = new BotBrain(rand);
    });
  }

  aliveCount() {
    return this.players.filter((p) => p.state.alive).length;
  }

  /** frozen: 카운트다운 중에는 입력을 받지 않는다 */
  step(frozen = false) {
    this.tick++;
    const world = this.world;
    if (!frozen) {
      this.t += DT;
      world.t = this.t;
      if (this.eventsEnabled) this.director.update(this.t, world.tiles);
      if (this.director.changed) applyEvents(world, this.director.list());
    }
    const stepped = [];
    for (const p of this.players) {
      let input;
      if (p.isBot) input = frozen ? { mx: 0, mz: 0, buttons: 0 } : p.bot.think(p, this.players, world, DT);
      else if (!p.connected) input = { mx: 0, mz: 0, buttons: 0 };
      else input = p.takeInput();
      if (frozen) input = { mx: 0, mz: 0, buttons: 0 };
      if (!p.state.alive) continue;
      const ev = stepPlayer(p.state, input, DT, world);
      if (ev & EV.SWEPT) this.fx.push({ k: 'swept', id: p.id, x: r2(p.state.x), y: r2(p.state.y + 0.8), z: r2(p.state.z) });
      stepped.push(p.state);
    }
    resolvePlayerCollisions(stepped, this.pairCd, DT, (a, b, power, x, y, z, dash) => {
      this.fx.push({ k: 'hit', a: a.key, b: b.key, x: r2(x), y: r2(y), z: r2(z), pw: r2(power), d: dash ? 1 : 0 });
    });

    // 탈락 판정: 같은 틱에 떨어진 플레이어는 같은 순위를 공유한다 (동시 탈락 처리)
    const fallen = this.players.filter((p) => !p.state.alive && !p.rank);
    if (fallen.length) {
      const rank = this.aliveCount() + 1;
      for (const p of fallen) {
        p.rank = rank;
        p.elimAt = this.t;
        this.elims.push({ id: p.id, rank, at: r2(this.t), x: r2(p.state.x), z: r2(p.state.z) });
      }
    }

    const alive = this.players.filter((p) => p.state.alive);
    if (!this.over && (alive.length === 0 || (alive.length === 1 && this.players.length > 1))) {
      this.over = true;
      for (const p of alive) p.rank = 1;
    }
  }

  /** 기권(나가기) 처리 */
  forfeit(player) {
    if (!player.state.alive) return;
    player.state.alive = false;
    player.state.y = PHYS.elimY - 1;
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
      return [p.id, r2(s.x), r2(s.y), r2(s.z), r2(s.vx), r2(s.vy), r2(s.vz), r2(s.yaw), f, r2(s.dashT), r2(s.dashCd), r2(s.stun), r2(s.coyote), r2(s.jumpBuf), s.mover];
    });
  }
}

// 경기장 랜덤 이벤트와 경기장 축소(서든데스) 일정을 관리한다.
export { EVENT_INFO } from '../../../shared/src/events.js';
import { RINGS, RING_START, TILE, TILE_COUNT } from '../../../shared/src/arena.js';


const ANNOUNCE = 2.5;
const SHRINK = [
  { at: 70, ring: 3 },
  { at: 100, ring: 2 },
  { at: 130, ring: 1 },
];
const FINAL_AT = 180;

export class EventDirector {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.events = [];
    this.nextId = 1;
    this.nextRandomAt = 7;
    this.shrinkIdx = 0;
    this.finalScheduled = false;
    this.permanentGone = new Set();
    this.changed = true;
    this.tilesChanged = true;
  }

  add(type, start, duration, extra = {}) {
    const e = { id: this.nextId++, type, announce: start - ANNOUNCE, start, end: start + duration, ...extra };
    this.events.push(e);
    this.changed = true;
    return e;
  }

  update(t, tiles) {
    // 경기장 축소 일정
    if (this.shrinkIdx < SHRINK.length && t >= SHRINK[this.shrinkIdx].at - ANNOUNCE - 0.5) {
      const s = SHRINK[this.shrinkIdx++];
      const ids = [];
      for (let i = 0; i < RINGS[s.ring].n; i++) ids.push(RING_START[s.ring] + i);
      this.add('shrink', s.at, 9999, { tiles: ids, permanent: true, movers: s.ring === 1 });
    }
    if (!this.finalScheduled && t >= FINAL_AT - 5) {
      this.finalScheduled = true;
      const e = this.add('final', FINAL_AT, 9999, { tiles: [0], permanent: true });
      e.announce = FINAL_AT - 5;
    }

    // 랜덤 이벤트 (한 번에 하나)
    const busy = this.events.some((e) => !e.permanent && t < e.end);
    if (!busy && t >= this.nextRandomAt - ANNOUNCE && t < SHRINK[2].at - 6) {
      const r = this.rand();
      const start = this.nextRandomAt;
      if (r < 0.36) {
        this.add('sweeper', start, 13, { dir: this.rand() < 0.5 ? 1 : -1, phase: this.rand() * Math.PI });
      } else if (r < 0.68) {
        this.add('wind', start, 7, { angle: this.rand() * Math.PI * 2 });
      } else {
        const candidates = [];
        for (let i = RING_START[1]; i < TILE_COUNT; i++) if (tiles[i] === TILE.OK && !this.permanentGone.has(i)) candidates.push(i);
        const chosen = [];
        const count = Math.min(candidates.length, 3 + Math.floor(this.rand() * 2));
        while (chosen.length < count) {
          const i = candidates.splice(Math.floor(this.rand() * candidates.length), 1)[0];
          chosen.push(i);
        }
        if (chosen.length) this.add('tiles', start, 9, { tiles: chosen });
      }
      this.nextRandomAt = start + 14 + this.rand() * 5;
    }

    // 타일 상태 반영
    for (const e of this.events) {
      if (!e.tiles) continue;
      for (const i of e.tiles) {
        let want;
        if (this.permanentGone.has(i)) want = TILE.GONE;
        else if (t >= e.end) want = TILE.OK;
        else if (t >= e.start) want = TILE.GONE;
        else if (t >= e.announce) want = TILE.WARN;
        else continue;
        if (e.permanent && t >= e.start) this.permanentGone.add(i);
        if (t >= e.end && e.type === 'tiles' && tiles[i] === TILE.OK) continue;
        if (tiles[i] !== want) { tiles[i] = want; this.tilesChanged = true; }
      }
    }

    // 지난 이벤트 정리
    const before = this.events.length;
    this.events = this.events.filter((e) => e.permanent || t < e.end + 1);
    if (this.events.length !== before) this.changed = true;
  }

  /** 클라이언트에 보낼 이벤트 목록. 클라이언트는 announce 시각부터 경고를 표시한다. */
  list() {
    return this.events.map((e) => ({ ...e }));
  }
}

import crypto from 'node:crypto';
import { sanitizeLook } from '../../../shared/src/looks.js';
import { createPlayerState } from '../../../shared/src/physics.js';

let nextId = 1;

export class Player {
  constructor({ name, look, isBot = false }) {
    this.id = 'p' + (nextId++).toString(36);
    this.token = crypto.randomBytes(16).toString('hex');
    this.name = name;
    this.look = sanitizeLook(look);
    this.isBot = isBot;
    this.ready = false;
    this.conn = null;
    this.connected = isBot;
    this.disconnectedAt = 0;
    this.inMatch = false;
    this.rank = 0;
    this.elimAt = 0;
    this.rematchVote = false;
    this.inputQueue = [];
    this.lastInput = { mx: 0, mz: 0, buttons: 0 };
    this.lastSeq = 0;
    this.state = createPlayerState();
    this.state.key = this.id;
    this.bot = null;
  }

  send(msg) {
    if (this.conn && this.conn.readyState === 1) this.conn.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  publicInfo() {
    return {
      id: this.id, name: this.name, look: this.look, ready: this.ready, isBot: this.isBot,
      connected: this.connected, inMatch: this.inMatch, rematch: this.rematchVote,
    };
  }

  pushInputs(list) {
    if (!Array.isArray(list)) return;
    for (const raw of list.slice(0, 8)) {
      if (!Array.isArray(raw)) continue;
      const seq = raw[0] | 0;
      if (seq <= this.lastQueuedSeq) continue;
      let mx = Number(raw[1]) || 0, mz = Number(raw[2]) || 0;
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
      this.inputQueue.push({ seq, mx, mz, buttons: (raw[3] | 0) & 3 });
      this.lastQueuedSeq = seq;
    }
    // 지연이 쌓이지 않도록 큐 길이를 제한 (입력 속도 조작 방지)
    while (this.inputQueue.length > 10) {
      const dropped = this.inputQueue.shift();
      // 버려지는 입력의 대시는 다음 입력에 합쳐 손실을 막는다
      if (dropped.buttons & 2) this.inputQueue[0].buttons |= 2;
    }
  }

  takeInput() {
    const inp = this.inputQueue.shift();
    if (inp) {
      this.lastInput = inp;
      this.lastSeq = inp.seq;
      this.starved = 0;
      return inp;
    }
    // 입력이 잠깐 늦으면 마지막 입력을 유지하되(대시는 반복 안 함),
    // 오래 끊기면(새로고침/네트워크 정지) 멈춰 선다 — 혼자 낭떠러지로 달려가지 않도록
    this.starved = (this.starved || 0) + 1;
    if (this.starved > 8) return { seq: this.lastSeq, mx: 0, mz: 0, buttons: 0 };
    this.lastInput = { seq: this.lastSeq, mx: this.lastInput.mx, mz: this.lastInput.mz, buttons: this.lastInput.buttons & 1 };
    return this.lastInput;
  }

  resetInputs() {
    this.inputQueue.length = 0;
    this.lastInput = { mx: 0, mz: 0, buttons: 0 };
  }
}
Player.prototype.lastQueuedSeq = 0;

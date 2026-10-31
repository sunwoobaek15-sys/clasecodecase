// WebAudio로 합성하는 효과음 (외부 파일 불필요, 가벼움)
import { settings } from '../settings.js';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.lastPlay = {};
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.comp = this.ctx.createDynamicsCompressor();
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.setVolume(settings.sfx);
  }

  setVolume(v) { if (this.master) this.master.gain.value = v * 0.6; }

  // 같은 소리가 한 프레임에 몰리지 않도록 제한
  gate(name, ms) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < ms) return false;
    this.lastPlay[name] = now;
    return true;
  }

  tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, f0 = 1000, f1 = f0, q = 1, type = 'bandpass', delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  click() { this.tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.07, vol: 0.18 }); }
  jump(v = 1) { if (this.gate('jump', 40)) this.tone({ type: 'square', f0: 280, f1: 620, dur: 0.14, vol: 0.09 * v }); }
  land(v = 1) { if (this.gate('land', 50)) this.noise({ dur: 0.1, vol: 0.22 * v, f0: 400, f1: 120, type: 'lowpass' }); }
  dash(v = 1) {
    if (!this.gate('dash', 40)) return;
    this.noise({ dur: 0.25, vol: 0.28 * v, f0: 600, f1: 3000, q: 2 });
    this.tone({ type: 'sawtooth', f0: 180, f1: 420, dur: 0.18, vol: 0.06 * v });
  }
  hit(power = 8, v = 1) {
    if (!this.gate('hit', 30)) return;
    const k = Math.min(1.6, power / 10);
    this.tone({ type: 'sine', f0: 220 + 60 * k, f1: 60, dur: 0.22, vol: 0.35 * v * (0.6 + k * 0.4) });
    this.noise({ dur: 0.12, vol: 0.25 * v * k, f0: 2500, f1: 500, q: 0.8 });
    this.tone({ type: 'square', f0: 900, f1: 1400, dur: 0.06, vol: 0.05 * v, delay: 0.01 });
  }
  boing(v = 1) { if (this.gate('boing', 60)) this.tone({ type: 'sine', f0: 150, f1: 520, dur: 0.3, vol: 0.25 * v }); }
  fall(v = 1) { this.tone({ type: 'sine', f0: 1200, f1: 180, dur: 1.0, vol: 0.12 * v }); }
  elim(v = 1) {
    this.noise({ dur: 0.5, vol: 0.3 * v, f0: 300, f1: 60, type: 'lowpass' });
    this.tone({ type: 'triangle', f0: 400, f1: 90, dur: 0.5, vol: 0.18 * v, delay: 0.05 });
  }
  countdown(final = false) {
    if (final) { this.tone({ type: 'square', f0: 880, dur: 0.5, vol: 0.14 }); this.tone({ type: 'square', f0: 1320, dur: 0.5, vol: 0.08 }); }
    else this.tone({ type: 'square', f0: 520, dur: 0.18, vol: 0.12 });
  }
  start() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.16, delay: i * 0.07 }));
  }
  end() {
    this.tone({ type: 'square', f0: 1500, f1: 1400, dur: 0.6, vol: 0.08 });
    this.tone({ type: 'square', f0: 1900, f1: 1800, dur: 0.6, vol: 0.05, delay: 0.02 });
  }
  win() {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: i === seq.length - 1 ? 0.7 : 0.16, vol: 0.18, delay: i * 0.12 }));
    this.noise({ dur: 1.2, vol: 0.06, f0: 6000, f1: 3000, delay: 0.8 });
  }
  lose() {
    [392, 330, 262].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.14, delay: i * 0.2 }));
  }
  warn() {
    if (!this.gate('warn', 300)) return;
    for (let i = 0; i < 3; i++) this.tone({ type: 'square', f0: 740, f1: 600, dur: 0.14, vol: 0.08, delay: i * 0.2 });
  }
  crumble(v = 1) { if (this.gate('crumble', 120)) this.noise({ dur: 0.8, vol: 0.25 * v, f0: 500, f1: 80, type: 'lowpass' }); }
  bombWarn(v = 1) {
    if (!this.gate('bombWarn', 80)) return;
    this.tone({ type: 'sawtooth', f0: 900, f1: 1300, dur: 0.12, vol: 0.06 * v });
    this.tone({ type: 'sawtooth', f0: 900, f1: 1300, dur: 0.12, vol: 0.06 * v, delay: 0.25 });
  }
  boom(v = 1) {
    if (!this.gate('boom', 40)) return;
    this.noise({ dur: 0.6, vol: 0.4 * v, f0: 1800, f1: 60, type: 'lowpass' });
    this.tone({ type: 'sine', f0: 140, f1: 40, dur: 0.5, vol: 0.4 * v });
    this.noise({ dur: 0.15, vol: 0.25 * v, f0: 5000, f1: 2000, q: 0.7 });
  }
  finish() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.16, delay: i * 0.08 }));
  }
  respawn() { this.tone({ type: 'sine', f0: 300, f1: 900, dur: 0.25, vol: 0.12 }); }
  qualify() { [659, 784, 1046].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.16, vol: 0.09, delay: i * 0.1 })); }
  wind() { this.noise({ dur: 2.5, vol: 0.12, f0: 300, f1: 900, q: 0.6 }); }
}

export const sfx = new Sfx();

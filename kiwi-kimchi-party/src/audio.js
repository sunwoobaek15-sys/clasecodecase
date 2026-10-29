/* 효과음: 외부 사운드 파일 없이 Web Audio API 로 직접 합성한다. */
(function (KK) {
  'use strict';

  let ac = null;
  let master = null;
  let enabled = true;
  let noiseBuf = null;

  function ctx() {
    if (!enabled) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.55;
        master.connect(ac.destination);
      } catch (e) {
        ac = null;
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, dur, o) {
    o = o || {};
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, o) {
    o = o || {};
    const a = ctx();
    if (!a) return;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + (o.delay || 0);
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = o.freq || 1200;
    f.Q.value = 0.8;
    const g = a.createGain();
    g.gain.setValueAtTime(o.vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sounds = {
    click: () => tone(700, 0.07, { type: 'triangle', vol: 0.12 }),
    jump: () => tone(360, 0.16, { type: 'square', to: 720, vol: 0.06 }),
    doubleJump: () => tone(540, 0.15, { type: 'square', to: 1080, vol: 0.05 }),
    collect: (n) => {
      const base = 620 * Math.pow(2, Math.min(n || 0, 12) / 12);
      tone(base, 0.09, { type: 'triangle', vol: 0.16 });
      tone(base * 1.5, 0.13, { type: 'triangle', vol: 0.12, delay: 0.06 });
    },
    heart: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.12, { type: 'sine', vol: 0.15, delay: i * 0.06 })),
    hit: () => {
      tone(220, 0.25, { type: 'sawtooth', to: 70, vol: 0.12 });
      noise(0.16, { vol: 0.18, freq: 500 });
    },
    land: () => noise(0.05, { vol: 0.05, freq: 300 }),
    count: () => tone(520, 0.12, { type: 'triangle', vol: 0.18 }),
    go: () => tone(1040, 0.28, { type: 'triangle', vol: 0.18 }),
    mix: () => noise(0.09, { vol: 0.14, freq: 700 + Math.random() * 500 }),
    pour: () => noise(0.25, { vol: 0.06, freq: 3000 }),
    whoosh: () => noise(0.3, { vol: 0.1, freq: 900 }),
    success: () => [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.15, delay: i * 0.08 })),
    fanfare: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: i * 0.11 }));
      [523, 659, 784].forEach((f) => tone(f, 0.7, { type: 'sine', vol: 0.08, delay: 0.48 }));
    },
    fail: () => [392, 330, 262].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.14, delay: i * 0.16 })),
    badge: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, { type: 'sine', vol: 0.12, delay: i * 0.07 })),
  };

  KK.audio = {
    play(name, arg) {
      if (!enabled || !sounds[name]) return;
      try {
        sounds[name](arg);
      } catch (e) {
        /* 소리가 실패해도 게임은 계속 진행 */
      }
    },
    setEnabled(on) {
      enabled = !!on;
      if (ac) (enabled ? ac.resume() : ac.suspend()).catch(() => {});
    },
    get enabled() {
      return enabled;
    },
    unlock() {
      ctx();
    },
  };
})(window.KK);

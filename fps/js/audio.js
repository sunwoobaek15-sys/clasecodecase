/* SECTOR ZERO — 소리: 총소리·폭발·경보를 Web Audio로 직접 만듭니다 (음원 파일 없음). 적 소리는 방향과 거리에 따라 들려요. */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let ambient = null;
  let volume = 0.8;
  let listener = { x: 0, z: 0, yaw: 0 };

  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** 소리 나는 곳 → 출력 노드 (거리 감쇠 + 좌우 위치) */
  function out(at, gain) {
    const g = ctx.createGain();
    let k = gain === undefined ? 1 : gain;
    let dest = master;
    if (at) {
      const dx = at.x - listener.x, dz = at.z - listener.z;
      const d = Math.hypot(dx, dz);
      k *= 1 / (1 + d * 0.11);
      if (ctx.createStereoPanner && d > 0.5) {
        // 왼쪽에 있는 소리는 왼쪽 스피커로
        const ang = Math.atan2(-dx, -dz) - listener.yaw;
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-0.85, Math.min(0.85, -Math.sin(ang)));
        p.connect(master);
        dest = p;
      }
    }
    g.connect(dest);
    g.gain.value = k;
    return g;
  }

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function noise(dest, t, dur, o) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    env(g, t, o.gain || 0.3, o.attack || 0.002, dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function tone(dest, t, dur, o) {
    const osc = ctx.createOscillator();
    osc.type = o.wave || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    const g = ctx.createGain();
    env(g, t, o.gain || 0.2, o.attack || 0.003, dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + (o.attack || 0.003) + 0.05);
  }

  const SOUNDS = {
    pistol(d, t) {
      noise(d, t, 0.12, { freq: 1900, q: 0.6, gain: 0.55, freqTo: 600 });
      tone(d, t, 0.1, { freq: 160, freqTo: 50, gain: 0.5, wave: 'triangle' });
      noise(d, t + 0.01, 0.25, { type: 'lowpass', freq: 900, gain: 0.12 });
    },
    rifle(d, t) {
      const r = 0.9 + Math.random() * 0.2;
      noise(d, t, 0.08, { freq: 2300 * r, q: 0.5, gain: 0.45, freqTo: 800 });
      tone(d, t, 0.07, { freq: 130 * r, freqTo: 45, gain: 0.45, wave: 'triangle' });
      noise(d, t + 0.01, 0.18, { type: 'lowpass', freq: 700, gain: 0.09 });
    },
    shotgun(d, t) {
      noise(d, t, 0.3, { type: 'lowpass', freq: 2600, freqTo: 300, gain: 0.8 });
      tone(d, t, 0.2, { freq: 110, freqTo: 38, gain: 0.8, wave: 'triangle' });
      noise(d, t + 0.02, 0.5, { type: 'lowpass', freq: 500, gain: 0.15 });
      // 펌프 소리
      noise(d, t + 0.36, 0.05, { type: 'highpass', freq: 2500, gain: 0.22 });
      noise(d, t + 0.48, 0.06, { type: 'highpass', freq: 1800, gain: 0.25 });
    },
    empty(d, t) {
      noise(d, t, 0.03, { type: 'highpass', freq: 3500, gain: 0.25 });
    },
    reload(d, t) {
      noise(d, t + 0.05, 0.04, { type: 'highpass', freq: 2200, gain: 0.25 });
      noise(d, t + 0.35, 0.06, { type: 'bandpass', freq: 1400, gain: 0.3 });
    },
    reloadEnd(d, t) {
      noise(d, t, 0.05, { type: 'highpass', freq: 2800, gain: 0.3 });
      tone(d, t, 0.04, { freq: 900, gain: 0.08, wave: 'square' });
    },
    shell(d, t) {
      noise(d, t, 0.05, { type: 'bandpass', freq: 1700, q: 2, gain: 0.3 });
    },
    swap(d, t) {
      noise(d, t, 0.06, { type: 'highpass', freq: 1600, gain: 0.18 });
      noise(d, t + 0.12, 0.04, { type: 'highpass', freq: 2600, gain: 0.2 });
    },
    hit(d, t) {
      tone(d, t, 0.05, { freq: 1500, freqTo: 900, gain: 0.12, wave: 'square' });
    },
    crit(d, t) {
      tone(d, t, 0.07, { freq: 2100, freqTo: 1500, gain: 0.14, wave: 'square' });
      tone(d, t + 0.03, 0.06, { freq: 2800, gain: 0.08, wave: 'sine' });
    },
    zap(d, t) {
      tone(d, t, 0.18, { freq: 980, freqTo: 240, gain: 0.22, wave: 'sawtooth' });
      noise(d, t, 0.1, { freq: 3000, gain: 0.08 });
    },
    heavyZap(d, t) {
      tone(d, t, 0.22, { freq: 520, freqTo: 120, gain: 0.3, wave: 'sawtooth' });
      noise(d, t, 0.14, { type: 'lowpass', freq: 1500, gain: 0.15 });
    },
    charge(d, t) {
      tone(d, t, 0.3, { freq: 300, freqTo: 1200, gain: 0.07, wave: 'sine', attack: 0.2 });
    },
    swing(d, t) {
      noise(d, t, 0.14, { freq: 900, freqTo: 3000, q: 1.5, gain: 0.2 });
    },
    explode(d, t) {
      noise(d, t, 0.7, { type: 'lowpass', freq: 1800, freqTo: 120, gain: 0.8 });
      tone(d, t, 0.45, { freq: 90, freqTo: 30, gain: 0.7, wave: 'sine' });
      noise(d, t + 0.05, 0.25, { freq: 3200, q: 0.4, gain: 0.12 });
    },
    bigExplode(d, t) {
      noise(d, t, 1.1, { type: 'lowpass', freq: 1400, freqTo: 70, gain: 1 });
      tone(d, t, 0.8, { freq: 70, freqTo: 24, gain: 0.9, wave: 'sine' });
    },
    spawn(d, t) {
      tone(d, t, 0.6, { freq: 180, freqTo: 900, gain: 0.12, wave: 'sine', attack: 0.3 });
      noise(d, t + 0.5, 0.2, { freq: 2400, q: 0.8, gain: 0.12 });
    },
    hurt(d, t) {
      tone(d, t, 0.18, { freq: 140, freqTo: 60, gain: 0.5, wave: 'triangle' });
      noise(d, t, 0.12, { type: 'lowpass', freq: 800, gain: 0.35 });
    },
    impact(d, t) {
      noise(d, t, 0.06, { freq: 2500 + Math.random() * 1500, q: 1.2, gain: 0.12 });
    },
    pickup(d, t) {
      tone(d, t, 0.08, { freq: 660, gain: 0.15, wave: 'square' });
      tone(d, t + 0.07, 0.08, { freq: 880, gain: 0.15, wave: 'square' });
      tone(d, t + 0.14, 0.14, { freq: 1320, gain: 0.12, wave: 'square' });
    },
    step(d, t) {
      noise(d, t, 0.05, { type: 'lowpass', freq: 380 + Math.random() * 120, gain: 0.12 });
    },
    land(d, t) {
      noise(d, t, 0.1, { type: 'lowpass', freq: 300, gain: 0.3 });
    },
    alarm(d, t) {
      for (let i = 0; i < 3; i++) {
        tone(d, t + i * 0.42, 0.18, { freq: 740, gain: 0.12, wave: 'square' });
        tone(d, t + i * 0.42 + 0.2, 0.18, { freq: 554, gain: 0.12, wave: 'square' });
      }
    },
    clear(d, t) {
      [523, 659, 784, 1047].forEach((f, i) => tone(d, t + i * 0.09, 0.3, { freq: f, gain: 0.12, wave: 'triangle' }));
    },
    die(d, t) {
      tone(d, t, 1.4, { freq: 220, freqTo: 40, gain: 0.4, wave: 'sawtooth' });
      noise(d, t, 1.2, { type: 'lowpass', freq: 600, freqTo: 80, gain: 0.3 });
    },
    click(d, t) {
      tone(d, t, 0.03, { freq: 1200, gain: 0.06, wave: 'square' });
    },
  };

  const audio = {
    /** 사용자가 처음 누를 때 불러야 소리가 나요 (브라우저 규칙) */
    unlock() {
      ensure();
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    setListener(x, z, yaw) {
      listener.x = x;
      listener.z = z;
      listener.yaw = yaw;
    },
    /** name: SOUNDS 이름, at: {x,z} 이면 그 자리에서 나는 소리, gain: 크기 배율 */
    play(name, at, gain) {
      if (!ctx || ctx.state !== 'running' || !SOUNDS[name] || volume <= 0) return;
      try {
        SOUNDS[name](out(at, gain), ctx.currentTime + 0.005);
      } catch (e) {
        /* 소리는 실패해도 게임은 계속 */
      }
    },
    /** 낮게 웅웅거리는 시설 소음 */
    ambient(on) {
      if (!ctx) return;
      if (on && !ambient) {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 220;
        const oscs = [55, 55.7, 110.3].map((fr, i) => {
          const o = ctx.createOscillator();
          o.type = i === 2 ? 'triangle' : 'sawtooth';
          o.frequency.value = fr;
          o.connect(f);
          o.start();
          return o;
        });
        f.connect(g);
        g.connect(master);
        ambient = { g, oscs };
      } else if (!on && ambient) {
        const a = ambient;
        ambient = null;
        a.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => a.oscs.forEach((o) => o.stop()), 1500);
      }
    },
  };

  SZ.audio = audio;
})(typeof window !== 'undefined' ? window : globalThis);

/* SAVE CITY — 소리: 효과음과 배경 음악을 Web Audio로 직접 만듭니다 (음원 파일 없음) */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let sfxOn = true;
  let musicOn = false;
  let unlocked = false;
  let musicTimer = null;
  let nextNote = 0;
  let step = 0;

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
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.55;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, start, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, start + dur);
    const peak = o.gain || 0.15;
    const attack = o.attack || 0.006;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(o.dest || sfxGain);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  const SFX = {
    tap: (t) => tone(700, t, 0.05, { gain: 0.08 }),
    toggle: (t) => tone(520, t, 0.06, { type: 'square', gain: 0.035 }),
    open: (t) => tone(520, t, 0.09, { gain: 0.08, slideTo: 820 }),
    coin: (t) => {
      tone(988, t, 0.08, { type: 'square', gain: 0.06 });
      tone(1319, t + 0.075, 0.26, { type: 'square', gain: 0.06 });
    },
    success: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.075, 0.28, { type: 'triangle', gain: 0.16 })),
    build: (t) => {
      tone(150, t, 0.2, { gain: 0.3, slideTo: 60 });
      tone(880, t + 0.1, 0.2, { type: 'triangle', gain: 0.1 });
      tone(1175, t + 0.18, 0.28, { type: 'triangle', gain: 0.09 });
    },
    upgrade: (t) => {
      tone(392, t, 0.32, { type: 'sawtooth', gain: 0.04, slideTo: 1175 });
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + 0.12 + i * 0.06, 0.22, { type: 'triangle', gain: 0.09 }));
    },
    unlock: (t) => [784, 1047, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.1, i === 3 ? 0.55 : 0.2, { type: 'triangle', gain: 0.14 })),
    error: (t) => {
      tone(233, t, 0.12, { type: 'square', gain: 0.05 });
      tone(185, t + 0.13, 0.18, { type: 'square', gain: 0.05 });
    },
  };

  /* 배경 음악: C–G–Am–F 아르페지오, 92 BPM */
  const EIGHTH = 60 / 92 / 2;
  const CHORDS = [
    [48, 52, 55],
    [43, 47, 50],
    [45, 48, 52],
    [41, 45, 48],
  ];
  const PATTERN = [0, 1, 2, 3, 2, 1, 2, 1];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function scheduleMusic() {
    while (nextNote < ctx.currentTime + 0.3) {
      const chord = CHORDS[Math.floor(step / 8) % 4];
      const i = step % 8;
      const idx = PATTERN[i];
      const note = (idx === 3 ? chord[0] + 12 : chord[idx]) + 24;
      tone(midi(note), nextNote, EIGHTH * 1.7, { type: 'triangle', gain: 0.045, attack: 0.012, dest: musicGain });
      if (i === 0 || i === 4) tone(midi(chord[0]), nextNote, EIGHTH * 3.6, { gain: 0.07, attack: 0.03, dest: musicGain });
      if (i === 6 && step % 32 === 30) tone(midi(note + 12), nextNote, EIGHTH * 3, { type: 'sine', gain: 0.025, dest: musicGain });
      nextNote += EIGHTH;
      step++;
    }
  }

  function startMusic() {
    if (musicTimer || !unlocked || !ensure()) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(0.0001, t);
    musicGain.gain.linearRampToValueAtTime(0.85, t + 1.5);
    nextNote = t + 0.1;
    step = 0;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 100);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    if (ctx && musicGain) {
      const t = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setValueAtTime(musicGain.gain.value, t);
      musicGain.gain.linearRampToValueAtTime(0, t + 0.35);
    }
  }

  function syncMusic() {
    const visible = !root.document || root.document.visibilityState !== 'hidden';
    if (musicOn && visible) startMusic();
    else stopMusic();
  }

  SC.audio = {
    /** 첫 터치/클릭 때 호출: 브라우저는 사용자 동작 뒤에만 소리를 허용합니다. */
    unlock() {
      unlocked = true;
      if (ensure()) syncMusic();
    },
    configure(o) {
      sfxOn = o.sfx !== false;
      musicOn = o.sound === true;
      syncMusic();
    },
    play(name) {
      if (!sfxOn || !unlocked || !SFX[name] || !ensure()) return;
      try {
        SFX[name](ctx.currentTime + 0.01);
      } catch (e) {
        /* 소리 실패는 게임 진행에 영향 없음 */
      }
    },
    syncVisibility: syncMusic,
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    get musicPlaying() {
      return !!musicTimer;
    },
    get supported() {
      return !!(root.AudioContext || root.webkitAudioContext);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

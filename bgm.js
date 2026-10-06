// bgm.js — 코드로 직접 연주하는 배경음악 "맑은 아침" (음원 파일·저작권 음악 없음)
// F장조 108BPM, 우쿨렐레 스트럼 + 마림바 멜로디. 처음엔 꺼져 있고, 사용자가 켜야 소리가 납니다.
(function (root) {
  'use strict';
  const N = null;
  const SONG = {
    bpm: 108, swing: 0.12,
    ch: [[65, 69, 72, 77], [65, 70, 74, 77], [65, 69, 74, 77], [64, 67, 72, 76]], // F Bb Dm C
    root: [41, 34, 38, 36],
    mel: [
      [77, N, 81, N, 84, N, 81, 79], [77, N, 74, N, 77, 79, 81, N], [81, N, 84, N, 86, N, 84, 81], [79, N, N, 76, 79, N, N, N],
      [77, 79, 81, N, 84, N, 89, N], [86, N, 84, N, 82, N, 81, N], [81, N, 79, N, 77, N, 74, 76], [77, N, N, N, N, N, N, N],
    ],
  };
  let ctx = null, master = null, noise = null, timer = null, step = 0, next = 0, playing = false, vol = 0.5;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 0.4;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function osc(f, t, dur, type, g, cut, att) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + att); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(v); v.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function nz(t, g, type, f, dur, q) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(v); v.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(t, g) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(v); v.connect(master); o.start(t); o.stop(t + 0.26);
  }
  const marimba = (m, t, g) => { osc(hz(m), t, 0.45, 'sine', g, 6000, 0.002); osc(hz(m) * 4, t, 0.07, 'sine', g * 0.35, 9000, 0.002); };
  const uke = (ch, t, g, up) => (up ? [...ch].reverse() : ch).forEach((m, i) => {
    const tt = t + i * 0.012;
    osc(hz(m), tt, 0.35, 'triangle', g, 4200, 0.003);
    osc(hz(m) * 2, tt, 0.15, 'sine', g * 0.25, 6000, 0.003);
  });
  const bass = (m, t, dur, g) => { osc(hz(m), t, dur, 'triangle', g, 800, 0.008); osc(hz(m), t, dur * 0.7, 'sine', g * 0.9, 400, 0.008); };

  function sched() {
    const e = 60 / SONG.bpm / 2;
    while (next < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 8) % 8, pos = step % 8, c = SONG.ch[bar % 4], r = SONG.root[bar % 4] + 12, mn = SONG.mel[bar][pos];
      const t = next + (pos % 2 ? e * SONG.swing : 0);
      if ([0, 2, 3, 5, 6, 7].includes(pos)) uke(c, t, pos === 0 ? 0.05 : 0.035, pos === 3 || pos === 7);
      if (pos === 0 || pos === 3 || pos === 4 || pos === 6) bass(r, t, e * 1.2, 0.15);
      if (pos === 0 || pos === 4) kick(t, 0.32);
      if (pos === 4) nz(t, 0.08, 'bandpass', 2500, 0.08, 1.5);
      nz(t, pos % 2 ? 0.035 : 0.05, 'bandpass', 7000, 0.05, 1);
      if (mn) marimba(mn, t, 0.14);
      next += e; step++;
    }
  }
  function start() {
    if (!(window.AudioContext || window.webkitAudioContext)) return false;
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(vol * 0.55, ctx.currentTime + 1.0); // 부드럽게 시작
    next = ctx.currentTime + 0.08; step = 0;
    clearInterval(timer); timer = setInterval(sched, 25);
    playing = true;
    return true;
  }
  function stop() {
    clearInterval(timer); playing = false;
    if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  }
  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    if (master && playing) master.gain.setTargetAtTime(vol * 0.55, ctx.currentTime, 0.05);
  }
  root.T04Bgm = { start, stop, setTheme() {}, setVolume, isPlaying: () => playing };
})(typeof globalThis !== 'undefined' ? globalThis : this);

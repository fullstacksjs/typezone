// Tiny WebAudio synth for game feedback. No assets required.

let ctx = null;
let master = null;
let muted = localStorage.getItem('tz-muted') === '1';

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = null, dur = 0.1, type = 'square', vol = 0.3, delay = 0 }) {
  if (muted) return;
  const c = ensure();
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, filter = 800 }) {
  if (muted) return;
  const c = ensure();
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  key: (pitch = 0) => tone({ freq: 600 + pitch * 30, dur: 0.035, type: 'triangle', vol: 0.12 }),
  miss: () => tone({ freq: 140, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.2 }),
  coin: (golden, diamond = false) => {
    tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.12 });
    tone({ freq: diamond ? 2349 : golden ? 1760 : 1319, dur: 0.18, type: 'square', vol: 0.12, delay: 0.07 });
  },
  armor: () => tone({ freq: 900, to: 500, dur: 0.1, type: 'square', vol: 0.15 }),
  kill: () => {
    noise({ dur: 0.18, vol: 0.25, filter: 2200 });
    tone({ freq: 520, to: 1040, dur: 0.12, type: 'triangle', vol: 0.18 });
  },
  send: () => tone({ freq: 220, to: 440, dur: 0.15, type: 'sawtooth', vol: 0.12 }),
  baseHit: () => {
    noise({ dur: 0.35, vol: 0.5, filter: 500 });
    tone({ freq: 110, to: 50, dur: 0.3, type: 'sine', vol: 0.4 });
  },
  enemyHit: () => noise({ dur: 0.2, vol: 0.18, filter: 400 }),
  spell: () => {
    tone({ freq: 300, to: 1200, dur: 0.3, type: 'sine', vol: 0.2 });
    tone({ freq: 450, to: 1800, dur: 0.3, type: 'sine', vol: 0.1, delay: 0.05 });
  },
  ult: () => {
    noise({ dur: 0.6, vol: 0.5, filter: 4000 });
    tone({ freq: 80, to: 40, dur: 0.6, type: 'sawtooth', vol: 0.3 });
  },
  airdrop: () => [660, 880, 660].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.15, delay: i * 0.1 })),
  claim: () => [784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.07 })),
  switch: () => tone({ freq: 700, to: 900, dur: 0.06, type: 'triangle', vol: 0.12 }),
  count: (go) => tone({ freq: go ? 880 : 440, dur: go ? 0.4 : 0.15, type: 'square', vol: 0.2 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'square', vol: 0.15, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.2, delay: i * 0.15 })),
  denied: () => tone({ freq: 200, dur: 0.08, type: 'square', vol: 0.12 }),
};

export function unlockAudio() {
  ensure();
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('tz-muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

export const isMuted = () => muted;

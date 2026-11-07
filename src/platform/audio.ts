// Tiny WebAudio synth for UI and minigame sounds. No audio files, no network.
import { getSettings } from './settings';

let ctx: AudioContext | null = null;
let lastSale = 0;

function ac(): AudioContext | null {
  const s = getSettings();
  if (s.muted || s.volume <= 0) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.15, slide = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  const v = gain * getSettings().volume;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.2, delay = 0, lowpass = 1200) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = gain * getSettings().volume;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  sale() {
    const now = performance.now();
    if (now - lastSale < 60) return;
    lastSale = now;
    tone(880 + Math.random() * 120, 0.06, 'square', 0.05);
  },
  buy() {
    tone(520, 0.07, 'triangle', 0.12);
    tone(780, 0.09, 'triangle', 0.1, 0, 0.05);
  },
  milestone() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.08, 0, i * 0.07));
  },
  unlock() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, 0, i * 0.08));
  },
  error() {
    tone(160, 0.12, 'sawtooth', 0.06);
  },
  coin() {
    tone(988, 0.05, 'square', 0.07);
    tone(1319, 0.12, 'square', 0.07, 0, 0.05);
  },
  pop() {
    noise(0.05, 0.25, 0, 3000);
    tone(220, 0.06, 'square', 0.06, 200);
  },
  land(perfect: boolean) {
    noise(0.09, 0.3, 0, 900);
    if (perfect) tone(1200, 0.12, 'triangle', 0.08, 300, 0.02);
  },
  bail() {
    noise(0.35, 0.35, 0, 500);
    tone(180, 0.3, 'sawtooth', 0.07, -120);
  },
  roll() {
    noise(0.12, 0.05, 0, 400);
  },
};

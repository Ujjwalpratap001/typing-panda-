// Original synthesized sound effects (WebAudio) — no external audio files.
import { settings } from './settings.js';
let ctx = null;
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol * settings.volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
export function playClick(force) {
  if (!force && !settings.soundOn) return;
  const k = settings.clickSound;
  if (k === 'off') return;
  if (k === 'click') tone(1800 + Math.random() * 200, 0.03, 'square', 0.08);
  else if (k === 'beep') tone(880, 0.06, 'sine', 0.15);
  else if (k === 'pop') tone(500, 0.07, 'triangle', 0.25, -250);
  else tone(180, 0.09, 'triangle', 0.4, -80);
}
export function playError(force) { if ((force || settings.soundOn) && settings.errorSound) tone(130, 0.14, 'sawtooth', 0.14); }
export function playTick() { if (settings.soundOn && settings.timerWarn) tone(1200, 0.05, 'sine', 0.12); }
export function playPreview() { playClick(true); setTimeout(() => playError(true), 250); setTimeout(() => { const o = settings.soundOn; tone(1200, 0.05, 'sine', 0.12); }, 500); }

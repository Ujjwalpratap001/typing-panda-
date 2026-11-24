// Replay: re-runs the recorded keystrokes through a fresh engine. Nothing is simulated.
import { h, openModal, toast } from './util.js';
import { settings } from './settings.js';
import { replayEngine } from './engine.js';
import { paintWord } from './typing-ui.js';

export function replayModal(r) {
  if (!r.events || !r.events.length || !r.words) { toast('No replay data is stored for this result.', 'err'); return; }
  const total = Math.max(1, r.endT || r.duration * 1000);
  const wordsEl = h('div', { class: 'words' }), view = h('div', { class: 'words-view', style: '--lines:4' }, wordsEl);
  const play = h('button', { class: 'btn sm primary' }, 'Play'), restart = h('button', { class: 'btn sm' }, 'Restart');
  const speed = h('select', { 'aria-label': 'Replay speed', style: 'width:auto' }, [0.5, 1, 2, 4].map(s => h('option', { value: s, selected: s === 1 }, s + '×')));
  const slider = h('input', { type: 'range', min: 0, max: total, value: 0, 'aria-label': 'Replay position' }), label = h('span', { class: 'muted' }, '0.0s');
  const sig = [];
  let t = 0, playing = false, last = 0, raf = 0, els = [];
  function show(tt) {
    const e = replayEngine(r.words, r.opts, r.events, tt, r.endT);
    const words = r.opts.zen ? e.typed.concat([e.cur]) : e.words;
    while (els.length < words.length) { const el = h('div', { class: 'word' }); els.push(el); wordsEl.append(el); }
    words.forEach((_, i) => {
      const s = (i < e.wi ? e.typed[i] : i === e.wi ? e.cur : '') + '|' + (i === e.wi) + '|' + (i < e.wi);
      if (sig[i] !== s) { sig[i] = s; paintWord(els[i], e, i, settings, i === e.wi); els[i].style.opacity = ''; }
    });
    const cur = els[e.wi];
    if (cur) { cur.classList.add('active'); const row = cur.offsetHeight || 1; wordsEl.style.transform = `translateY(${-Math.max(0, Math.round(cur.offsetTop / row) - 1) * row}px)`; }
    label.textContent = (tt / 1000).toFixed(1) + 's / ' + (total / 1000).toFixed(1) + 's';
  }
  function frame(now) {
    if (!playing) return;
    t = Math.min(total, t + (now - last) * +speed.value); last = now;
    slider.value = t; show(t);
    if (t >= total) { playing = false; play.textContent = 'Play'; return; }
    raf = requestAnimationFrame(frame);
  }
  const setPlaying = on => { playing = on; play.textContent = on ? 'Pause' : (t >= total ? 'Replay' : 'Play'); if (on) { if (t >= total) t = 0; last = performance.now(); raf = requestAnimationFrame(frame); } };
  play.addEventListener('click', () => setPlaying(!playing));
  restart.addEventListener('click', () => { t = 0; slider.value = 0; show(0); setPlaying(true); });
  slider.addEventListener('input', () => { t = +slider.value; show(t); });
  openModal({ title: 'Replay', wide: true, onClose: () => { playing = false; cancelAnimationFrame(raf); }, content: h('div', { style: '--fs:22px' }, view, h('div', { class: 'row', style: 'margin-top:.8rem' }, play, restart, speed, h('div', { style: 'flex:1;min-width:140px' }, slider), label)) });
  show(0);
}

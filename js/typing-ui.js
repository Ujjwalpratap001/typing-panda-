// The typing surface: renders words, moves the caret, reads the hidden input and feeds the engine.
import { h, esc } from './util.js';
import { settings } from './settings.js';
import { TypingEngine } from './engine.js';
import { playClick, playError, playTick } from './sound.js';

export function engineOptsFrom(test) {
  const s = settings;
  return {
    zen: !!test.zen, limitMs: test.limitMs ?? null, stopOnError: s.stopOnError, confidence: s.confidence, freedom: s.freedom,
    strictSpace: s.strictSpace, quickEnd: s.quickEnd, lazy: s.lazyMode, minBurst: +s.minBurst || 0,
    failOn: s.difficulty === 'expert' ? 'word' : s.difficulty === 'master' ? 'letter' : null
  };
}

// Draws one word from the engine state (shared by live typing and replay).
export function paintWord(el, eng, i, S, active) {
  const zen = eng.o.zen, committed = i < eng.wi, isCur = i === eng.wi;
  const typed = committed ? eng.typed[i] : isCur ? eng.cur : '';
  const target = zen ? typed : (eng.words[i] ?? '');
  const blind = S.blindMode;
  let html = '';
  for (let k = 0; k < target.length; k++) {
    const c = target[k];
    if (k < typed.length) {
      const ok = zen || eng.eq(typed[k], c);
      if (ok || blind) html += `<span class="ok">${esc(c)}</span>`;
      else if (S.indicateTypos === 'replace') html += `<span class="bad">${esc(typed[k])}</span>`;
      else html += `<span class="bad"${S.indicateTypos === 'below' ? ` data-typo="${esc(typed[k])}"` : ''}>${esc(c)}</span>`;
    } else html += `<span>${esc(c)}</span>`;
  }
  if (!zen && typed.length > target.length && !S.hideExtra) for (let k = target.length; k < typed.length; k++) html += `<span class="${blind ? 'ok' : 'extra'}">${esc(typed[k])}</span>`;
  el.innerHTML = html;
  const wrong = committed && !zen && !blind && !eng.same(typed, target);
  el.className = 'word' + (active ? ' active' : '') + (wrong ? ' wrong' : '') + (S.highlight === 'word' ? ' hl-word' : '');
}

// opts: { mount, test:{words,limitMs,zen}, moreWords?, onStart, onTick(live, t), onFinish(engine, info), onTarget(ch), engineOpts? }
export function createTyping(opts) {
  const S = settings, test = opts.test;
  const engine = new TypingEngine(test.words, opts.engineOpts || engineOptsFrom(test));
  const zen = engine.o.zen;
  let startPerf = 0, startedAt = 0, timer = 0, lastTick = 0, composing = false, destroyed = false, focusLoss = 0, lastWarn = -1;
  let wordEls = [];

  const wordsEl = h('div', { class: 'words' });
  const caret = h('div', { class: 'caret ' + S.caretStyle + (S.caretBlink ? ' blink' : '') + (S.smoothCaret ? '' : ' nosmooth') });
  const view = h('div', { class: 'words-view' }, wordsEl);
  const input = h('input', { class: 'hidden-input', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Typing input. Type the words shown.' });
  const box = h('div', { class: 'typing-box unfocused', tabindex: '-1' }, view, input, h('div', { class: 'focus-msg' }, 'Click here or start typing to focus'));
  if (S.funbox && S.funbox !== 'none') box.classList.add('fb-' + S.funbox);
  opts.mount.append(box);

  const makeWordEl = i => { const el = h('div', { class: 'word' }); wordEls[i] = el; paintWord(el, engine, i, S, i === engine.wi); return el; };
  function build() {
    wordsEl.innerHTML = ''; wordEls = [];
    const frag = document.createDocumentFragment();
    if (zen) frag.append(makeWordEl(0)); else engine.words.forEach((_, i) => frag.append(makeWordEl(i)));
    wordsEl.append(frag, caret);
  }
  const paint = i => { if (wordEls[i]) paintWord(wordEls[i], engine, i, S, i === engine.wi && !engine.ended); };

  function place() {
    const w = wordEls[engine.wi];
    if (!w) { caret.style.opacity = 0; return; }
    const idx = engine.cur.length, letters = w.children;
    let x, wd;
    if (idx < letters.length) { const l = letters[idx]; x = w.offsetLeft + l.offsetLeft; wd = l.offsetWidth; }
    else if (letters.length) { const l = letters[letters.length - 1]; x = w.offsetLeft + l.offsetLeft + l.offsetWidth; wd = l.offsetWidth; }
    else { x = w.offsetLeft; wd = 14; }
    const y = w.offsetTop, row = w.offsetHeight || 1;
    caret.style.left = x + 'px'; caret.style.top = y + 'px';
    if (S.caretStyle === 'block' || S.caretStyle === 'outline' || S.caretStyle === 'underline') caret.style.width = wd + 'px';
    const line = Math.round(y / row);
    wordsEl.style.transform = `translateY(${-Math.max(0, line - 1) * row}px)`;
    if (opts.onTarget) {
      const cw = zen ? '' : (engine.words[engine.wi] || '');
      opts.onTarget(zen ? '' : idx < cw.length ? cw[idx] : ' ');
    }
  }

  function press(k, ch) {
    if (engine.ended || destroyed) return;
    const now = performance.now();
    if (!engine.started) {
      if (k !== 'c') return;
      startPerf = now; startedAt = Date.now();
      box.classList.add('started');
      document.body.classList.add('typing-active');
      timer = setInterval(tick, 50);
      opts.onStart && opts.onStart();
    }
    const ev = { t: Math.round(now - startPerf), k, ch };
    const prevWi = engine.wi;
    const used = engine.apply(ev);
    if (used && (k === 'c' || k === 's')) (ev.ok === 0 ? playError() : playClick());
    if (!used && !engine.ended) return;
    if (zen && !wordEls[engine.wi] && !engine.ended) wordsEl.insertBefore(makeWordEl(engine.wi), caret);
    if (prevWi !== engine.wi) paint(prevWi);
    paint(engine.wi);
    if (opts.moreWords && !zen && !engine.ended && engine.words.length - engine.wi < 40) {
      const start = engine.words.length;
      engine.words.push(...opts.moreWords());
      const frag = document.createDocumentFragment();
      for (let i = start; i < engine.words.length; i++) frag.append(makeWordEl(i));
      wordsEl.insertBefore(frag, caret);
    }
    place();
    if (engine.ended) end();
  }

  function sync() {
    const v = input.value, c = engine.cur;
    if (v !== c) {
      let i = 0; while (i < v.length && i < c.length && v[i] === c[i]) i++;
      for (let n = c.length - i; n > 0 && !engine.ended; n--) press('b');
      for (const ch of v.slice(i)) { if (engine.ended) break; press(ch === ' ' ? 's' : 'c', ch); }
    }
    input.value = engine.cur;
  }

  function tick() {
    if (!engine.started || engine.ended || destroyed) return;
    const t = performance.now() - startPerf;
    if (engine.o.limitMs != null) {
      if (t >= engine.o.limitMs) { engine.finish(engine.o.limitMs); paint(engine.wi); end(); return; }
      const rem = Math.ceil((engine.o.limitMs - t) / 1000);
      if (rem <= 5 && rem !== lastWarn) { lastWarn = rem; playTick(); }
    }
    const now = performance.now();
    if (now - lastTick >= 100) { lastTick = now; opts.onTick && opts.onTick(engine.live(t), t); }
  }

  function end() {
    clearInterval(timer);
    document.body.classList.remove('typing-active');
    if (opts.onTick) opts.onTick(engine.live(engine.endT), engine.endT);
    opts.onFinish && opts.onFinish(engine, { startedAt, focusLoss });
  }

  function finishNow() { if (engine.started && !engine.ended) { engine.finish(Math.round(performance.now() - startPerf)); end(); } }

  input.addEventListener('input', () => { if (!composing) sync(); });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; sync(); });
  input.addEventListener('keydown', e => {
    if (composing) return;
    if (e.key === 'Backspace') { e.preventDefault(); press(e.ctrlKey || e.altKey || e.metaKey ? 'w' : 'b'); input.value = engine.cur; }
    else if (e.key === 'Enter' && e.shiftKey && zen) { e.preventDefault(); finishNow(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Delete'].includes(e.key)) e.preventDefault();
  });
  ['paste', 'drop', 'cut'].forEach(ev => input.addEventListener(ev, e => e.preventDefault()));
  input.addEventListener('beforeinput', e => { if (e.inputType && /Paste|Drop/.test(e.inputType)) e.preventDefault(); });
  input.addEventListener('focus', () => box.classList.remove('unfocused'));
  input.addEventListener('blur', () => { box.classList.add('unfocused'); if (engine.started && !engine.ended) focusLoss++; });
  box.addEventListener('mousedown', e => { e.preventDefault(); input.focus({ preventScroll: true }); });
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  build();
  requestAnimationFrame(place);
  document.fonts && document.fonts.ready.then(() => !destroyed && place());

  return {
    engine, box, input,
    focus() { input.focus({ preventScroll: true }); },
    finishNow, place,
    destroy() { destroyed = true; clearInterval(timer); window.removeEventListener('resize', onResize); document.body.classList.remove('typing-active'); box.remove(); }
  };
}

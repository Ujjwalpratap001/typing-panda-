// Practice page "/": config bar, live stats, typing surface, result dashboard.
import { h, modalState, toast } from '../util.js';
import { settings, setSetting, setMany, onSettings, formatSpeed, unitLabel } from '../settings.js';
import { buildTest, moreWords, getWordset, getFavs } from '../textgen.js';
import { createTyping } from '../typing-ui.js';
import { makeKeymap } from '../keymap.js';
import { buildResult, saveFinishedResult } from '../results.js';
import { renderResult } from '../result-view.js';
import { FUNBOX } from '../data.js';
import * as M from '../modals.js';

const NON_TEST = new Set(['volume', 'soundOn', 'clickSound', 'errorSound', 'timerWarn', 'theme', 'bgUrl', 'bgOpacity', 'bgBlur', 'cBg', 'cText', 'cSub', 'cMain', 'cErr', 'reduceMotion', 'decimals', 'speedUnit', 'showCharts', 'hideNotif', 'hideTips', 'hideAverage', 'saveResults', 'quickRestart', 'focusMode', 'hideCaps', 'hideOutOfFocus']);
const TIPS = ['Press Tab to restart instantly.', 'Ctrl+K opens the command palette.', 'Accuracy first — speed follows.', 'Try Zen mode to warm up without a timer.', 'Alt+P toggles punctuation, Alt+N toggles numbers.', 'Use Learn mode to build proper finger habits.', 'Save your favourite setups as presets.'];

export function render(root) {
  const wrap = h('div', { class: 'wrap test-page' });
  const cfg = h('div', { class: 'config-bar', role: 'toolbar', 'aria-label': 'Test configuration' });
  const stage = h('div');
  root.append(wrap); wrap.append(cfg, stage);
  let typing = null, test = null, snapshot = null, showingResult = false, capsEl = null;

  function buildConfig() {
    cfg.innerHTML = '';
    const s = settings;
    const o = (label, on, fn, title) => h('button', { class: 'opt' + (on ? ' on' : ''), 'aria-pressed': on, title, onClick: fn }, label);
    const sep = () => h('span', { class: 'sep' });
    const times = [15, 30, 60, 120], wordsN = [10, 25, 50, 100];
    if (s.mode === 'time' || s.mode === 'words') cfg.append(o('@ punctuation', s.punctuation, () => setSetting('punctuation', !s.punctuation)), o('# numbers', s.numbers, () => setSetting('numbers', !s.numbers)), sep());
    cfg.append(...['time', 'words', 'quote', 'zen', 'custom'].map(m => o(m, s.mode === m, () => setSetting('mode', m))), sep());
    if (s.mode === 'time') cfg.append(...times.map(t => o(String(t), s.time === t, () => setSetting('time', t))), o('custom', !times.includes(s.time), () => M.customDurationModal(), 'Custom duration'));
    if (s.mode === 'words') cfg.append(...wordsN.map(t => o(String(t), s.words === t, () => setSetting('words', t))), o('custom', !wordsN.includes(s.words), () => M.customWordsModal(), 'Custom word count'));
    if (s.mode === 'quote') cfg.append(...['all', 'short', 'medium', 'long', 'very long'].map(l => o(l, s.quoteLen === l && !s.quoteFav, () => setMany({ quoteLen: l, quoteFav: false, quoteId: '' }))), o('★ favourites', s.quoteFav, () => { if (!getFavs().length) return toast('Favourite some quotes first (search icon).', 'err'); setMany({ quoteFav: !s.quoteFav, quoteId: '' }); }), o('search', false, () => M.quoteModal()));
    if (s.mode === 'custom') cfg.append(o('edit text', false, () => M.customTextModal()), o(s.customLimit === 'text' ? 'whole text' : s.customLimit === 'words' ? s.customLimitValue + ' words' : s.customLimitValue + 's', false, () => M.customTextModal()));
    if (s.mode === 'zen') cfg.append(h('span', { class: 'opt', style: 'cursor:default' }, 'type freely · Shift+Enter to finish'));
    cfg.append(sep(), o(getWordset(s.wordset).name.replace('English — ', '').replace('Code — ', '‹/› '), false, () => M.wordsetModal(), 'Language & wordset'),
      o('presets', false, () => M.presetsModal()), o(s.funbox === 'none' ? 'funbox' : '⚡ ' + FUNBOX.find(f => f.id === s.funbox).name, s.funbox !== 'none', () => M.funboxModal(), 'Experimental modes (not ranked)'));
  }

  function liveRow() {
    const s = settings, els = {};
    const row = h('div', { class: 'live-row' + (s.hideLive ? ' hidden' : ''), 'aria-hidden': 'true' });
    const add = (k, label) => { els[k] = h('span'); row.append(h('div', { class: 'lv' }, els[k], h('small', {}, label))); };
    if (s.timerStyle === 'text' || s.timerStyle === 'both') add('time', test.limitMs ? 'time left' : test.zen || !test.words.length ? 'elapsed' : 'words');
    if (s.showWpm) add('wpm', unitLabel());
    if (s.showAcc) add('acc', 'accuracy');
    if (s.showBurst) add('burst', 'burst');
    if (s.showErrors) add('err', 'errors');
    if (s.showProgress) add('words', 'words');
    const bar = h('div', { class: 'timebar' + (s.timerStyle === 'bar' || s.timerStyle === 'both' ? '' : ' hidden') }, h('i'));
    const total = test.words.length, lim = test.limitMs;
    const init = () => { els.time && (els.time.textContent = lim ? Math.ceil(lim / 1000) : test.zen ? '0' : `0/${total}`); els.wpm && (els.wpm.textContent = '0'); els.acc && (els.acc.textContent = '100%'); els.burst && (els.burst.textContent = '0'); els.err && (els.err.textContent = '0'); els.words && (els.words.textContent = '0'); };
    init();
    let lastWords = 0;
    const tick = (live, t, eng) => {
      if (els.time) els.time.textContent = lim ? Math.max(0, Math.ceil((lim - t) / 1000)) : test.zen ? Math.floor(t / 1000) : `${live.words}/${total}`;
      if (els.wpm) els.wpm.textContent = formatSpeed(live.wpm, 0);
      if (els.acc) els.acc.textContent = Math.round(live.acc) + '%';
      if (els.err) els.err.textContent = live.errors;
      if (els.words) els.words.textContent = live.words + (lim || test.zen ? '' : '/' + total);
      if (els.burst && eng && eng.wordMs.length) { const i = eng.wordMs.length - 1, ms = eng.wordMs[i]; els.burst.textContent = ms > 0 ? formatSpeed(((eng.typed[i].length + 1) / 5) / (ms / 60000), 0) : '0'; }
      bar.firstChild.style.width = (lim ? Math.min(100, (t / lim) * 100) : total ? (live.words / total) * 100 : 0) + '%';
    };
    return { row, bar, tick };
  }

  function newTest(repeat) {
    if (typing) { typing.destroy(); typing = null; }
    showingResult = false; wrap.classList.remove('focus-mode-active'); cfg.style.display = '';
    stage.innerHTML = '';
    if (repeat && snapshot) test = { ...snapshot, words: snapshot.words.slice() };
    else test = buildTest();
    if (settings.mode === 'quote' && test.quote) settings.quoteId = settings.repeatQuotes ? test.quote.id : '';
    snapshot = { ...test, words: test.words.slice() };
    if (test.noQuote) { stage.append(h('div', { class: 'card empty' }, h('h3', {}, 'No quotes match'), h('p', {}, 'Try another length or clear the favourites filter.'), h('button', { class: 'btn primary', onClick: () => setMany({ quoteLen: 'all', quoteFav: false, quoteId: '' }) }, 'Show all quotes'))); return; }
    if (test.noCustom) { stage.append(h('div', { class: 'card empty' }, h('h3', {}, 'No custom text yet'), h('p', {}, 'Paste or type the text you want to practise.'), h('button', { class: 'btn primary', onClick: () => M.customTextModal() }, 'Add custom text'))); return; }
    const live = liveRow();
    const mount = h('div', { class: 'typing-wrap' });
    const km = settings.keymap ? makeKeymap(settings.layout) : null;
    capsEl = h('div', { class: 'caps-warn', 'aria-live': 'polite' });
    stage.append(h('div', { class: 'typing-wrap' }, live.bar, live.row), mount, capsEl, test.quote && h('div', { class: 'quote-info' }, `${test.quote.author} — ${test.quote.source}`), km && km.el);
    typing = createTyping({
      mount, test, moreWords: test.limitMs ? (settings.mode === 'custom' ? () => test.base : moreWords) : null,
      onTarget: km ? km.highlight : null,
      onStart: () => { if (settings.focusMode) wrap.classList.add('focus-mode-active'); },
      onTick: (l, t) => live.tick(l, t, typing && typing.engine),
      onFinish: (eng, info) => finish(eng, info)
    });
    const controls = h('div', { class: 'test-controls' },
      h('button', { class: 'opt', onClick: () => newTest(false), 'aria-label': 'Restart test', title: 'Restart (Tab)' }, '↻ restart'),
      h('button', { class: 'opt', onClick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available here', 'err')) }, '⛶ full screen'),
      h('button', { class: 'opt', onClick: () => setSetting('soundOn', !settings.soundOn) }, settings.soundOn ? '🔊 sound on' : '🔇 sound off'),
      h('button', { class: 'opt', onClick: () => M.focusModal() }, 'focus mode'),
      h('button', { class: 'opt', onClick: () => M.shortcutsModal() }, '⌨ shortcuts'));
    stage.append(controls);
    if (!settings.hideTips) stage.append(h('div', { class: 'tip' }, '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)]));
    typing.focus();
  }

  async function finish(eng, info) {
    wrap.classList.remove('focus-mode-active');
    if (!eng.summary) return;
    const r = buildResult(eng, test, info.startedAt, info.focusLoss);
    if (!r.failed && settings.minWpm > 0 && r.wpm < settings.minWpm) r.failed = 'minWpm';
    if (!r.failed && settings.minAcc > 0 && r.accuracy < settings.minAcc) r.failed = 'minAcc';
    if (!r.failed && r.duration < 1) { newTest(false); return; }
    const out = await saveFinishedResult(r);
    if (!wrap.isConnected) return;
    showingResult = true; cfg.style.display = 'none'; stage.innerHTML = '';
    renderResult(stage, r, { pb: out.pb, saved: out.saved, onNext: () => newTest(false), onRepeat: () => newTest(true) });
    window.scrollTo({ top: 0 });
  }

  function onKey(e) {
    if (modalState.open) return;
    if (e.getModifierState && capsEl && !settings.hideCaps) capsEl.textContent = e.getModifierState('CapsLock') ? '⇪ Caps Lock is on' : '';
    const q = settings.quickRestart;
    if ((q === 'tab' && e.key === 'Tab') || (q === 'esc' && e.key === 'Escape')) { e.preventDefault(); newTest(false); return; }
    if (showingResult) { if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') newTest(false); return; }
    if (typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== typing.input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) typing.focus();
  }
  const onMove = () => wrap.classList.remove('focus-mode-active');
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  wrap.addEventListener('mousemove', onMove);
  const onRestart = () => newTest(false);
  document.addEventListener('panda:restart', onRestart);
  const off = onSettings(k => { if (NON_TEST.has(k)) { if (k === 'soundOn') buildConfig(); return; } buildConfig(); if (!showingResult || k === '*' || k === 'mode') newTest(false); });
  buildConfig(); newTest(false);
  return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); document.removeEventListener('panda:restart', onRestart); off(); typing && typing.destroy(); };
}

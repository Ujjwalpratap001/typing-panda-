// The result dashboard shown after a test (and when opening a saved result).
import { h, toast, copyText, download, fmtDate } from './util.js';
import { settings, formatSpeed, unitLabel } from './settings.js';
import { chart } from './charts.js';
import { getPB, addLocalResult, updateLocalResult, uploadResult } from './results.js';
import { getWordset } from './textgen.js';
import { replayModal } from './replay.js';
import { tagsModal, eventHistoryModal, practiceWordsModal } from './modals.js';
import { cloud } from './backend.js';

const FAIL = { word: 'Expert difficulty: a word was incorrect', letter: 'Master difficulty: a letter was incorrect', burst: 'A word was slower than your minimum burst', minWpm: 'Below your minimum WPM', minAcc: 'Below your minimum accuracy' };
const modeLabel = r => ({ time: `time ${r.modeValue}s`, words: `${r.modeValue} words`, quote: `quote (${r.modeValue})`, zen: 'zen', custom: 'custom text' }[r.mode] || r.mode);

export function resultText(r) {
  return `Typing Panda — ${formatSpeed(r.wpm)} ${unitLabel()} · ${r.accuracy.toFixed(0)}% accuracy · ${r.consistency.toFixed(0)}% consistency · ${modeLabel(r)}${r.punctuation ? ' · punctuation' : ''}${r.numbers ? ' · numbers' : ''} (raw ${formatSpeed(r.rawWpm)}, ${r.duration}s)`;
}

function resultImage(r) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 1200, 630);
  g.addColorStop(0, '#1A4DFF'); g.addColorStop(0.55, '#0c2bb5'); g.addColorStop(1, '#050D2E');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
  const rg = x.createRadialGradient(1050, 60, 10, 1050, 60, 380); rg.addColorStop(0, 'rgba(198,255,0,.55)'); rg.addColorStop(1, 'rgba(198,255,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, 1200, 630);
  x.fillStyle = '#fff'; x.font = '800 40px Manrope, Inter, sans-serif'; x.fillText('Typing Panda', 70, 95);
  x.fillStyle = '#C6FF00'; x.font = '800 210px Manrope, Inter, sans-serif'; x.fillText(formatSpeed(r.wpm), 70, 340);
  x.fillStyle = '#cdd7ff'; x.font = '700 34px Inter, sans-serif'; x.fillText(unitLabel(), 78, 392);
  x.fillStyle = '#fff'; x.font = '800 54px Manrope, Inter, sans-serif';
  [['accuracy', r.accuracy.toFixed(0) + '%'], ['raw', formatSpeed(r.rawWpm)], ['consistency', r.consistency.toFixed(0) + '%']].forEach(([k, v], i) => { x.fillStyle = '#fff'; x.font = '800 54px Manrope, Inter, sans-serif'; x.fillText(v, 70 + i * 270, 490); x.fillStyle = '#b9c6ff'; x.font = '600 24px Inter, sans-serif'; x.fillText(k, 70 + i * 270, 525); });
  x.fillStyle = '#b9c6ff'; x.font = '600 26px Inter, sans-serif'; x.fillText(modeLabel(r) + ' · ' + getWordset(r.wordset).name, 70, 590);
  return c;
}

export function renderResult(root, r, ctx = {}) {
  const S = settings, d = +S.decimals, pb = ctx.pb || {}, best = getPB(r);
  const hero = h('div', { class: 'result-hero' });
  const badges = h('div', {},
    r.failed && h('span', { class: 'fail-badge' }, 'Test failed — ' + (FAIL[r.failed] || r.failed)),
    pb.wpm && !pb.first && h('span', { class: 'pb-badge' }, '🏆 New personal best!'), ' ',
    pb.first && !r.failed && h('span', { class: 'pb-badge' }, '★ First result for this test'),
    r.validationStatus !== 'valid' && h('span', { class: 'pill exp', style: 'margin-left:.4rem' }, r.validationStatus === 'experimental' ? 'funbox — not ranked' : r.validationStatus === 'unranked' ? 'not ranked' : 'flagged: ' + (r.flags || []).join(', ')));
  const stat = (v, l, flag) => h('div', {}, h('b', {}, v), h('span', {}, l + (flag ? ' ★' : '')));
  hero.append(badges, h('div', { class: 'result-top' },
    h('div', { class: 'big-wpm' }, formatSpeed(r.wpm), h('small', {}, unitLabel())),
    h('div', { class: 'mini-stats' },
      stat(r.accuracy.toFixed(d) + '%', 'accuracy', pb.acc), stat(formatSpeed(r.rawWpm), 'raw ' + unitLabel()), stat(r.consistency.toFixed(d) + '%', 'consistency', pb.consistency),
      stat(formatSpeed(r.burst), 'highest burst', pb.burst), stat(r.duration + 's', 'time'), (() => { const e = stat(`${r.correctChars}/${r.incorrectChars}/${r.extraChars}/${r.missedChars}`, 'correct / wrong / extra / missed'); e.className = 'w2'; return e; })(),
      stat(r.typedChars, 'characters typed'), stat(modeLabel(r), 'test'), stat(getWordset(r.wordset).lang, 'language'))));
  const sub = h('p', { class: 'muted', style: 'margin:.8rem 0 0' }, `${fmtDate(r.createdAt)}${r.quote ? ` · “${r.quote.author}”, ${r.quote.source}` : ''}${r.difficulty !== 'normal' ? ' · ' + r.difficulty : ''}${r.focusLoss ? ` · lost focus ${r.focusLoss}×` : ''}`);
  root.append(hero, sub);

  if (best && !S.hideAverage) root.append(h('div', { class: 'card flat', style: 'margin-top:1rem' }, h('b', {}, 'Your records for this test: '),
    h('span', { class: 'muted' }, `best ${formatSpeed(best.wpm)} ${unitLabel()} · best accuracy ${best.acc.toFixed(1)}% · best consistency ${best.consistency.toFixed(1)}% · best burst ${formatSpeed(best.burst)}`)));

  // actions
  const bar = h('div', { class: 'result-actions' });
  const slow = (r.wordStats || []).filter(w => w.wpm > 0).sort((a, b) => a.wpm - b.wpm).slice(0, 10).map(w => w.target);
  const wrong = (r.wordStats || []).filter(w => !w.ok && w.target).map(w => w.target);
  let savedBtn;
  bar.append(
    ctx.onNext && h('button', { class: 'btn primary', onClick: ctx.onNext }, 'Next test'),
    ctx.onRepeat && h('button', { class: 'btn', onClick: ctx.onRepeat }, 'Repeat test'),
    h('button', { class: 'btn', onClick: () => practiceWordsModal('Practice missed words', wrong) }, 'Practice missed words'),
    h('button', { class: 'btn', onClick: () => practiceWordsModal('Practice slow words', slow) }, 'Practice slow words'),
    h('button', { class: 'btn', onClick: () => eventHistoryModal(r) }, 'Detailed history'),
    h('button', { class: 'btn', onClick: () => replayModal(r) }, 'Watch replay'),
    h('button', { class: 'btn', onClick: () => copyText(resultText(r)) }, 'Copy result'),
    h('button', { class: 'btn', onClick: async () => { const t = resultText(r); if (navigator.share) { try { await navigator.share({ title: 'Typing Panda result', text: t, url: location.origin + location.pathname }); } catch { /* cancelled */ } } else copyText(t + ' ' + location.origin + location.pathname); } }, 'Share'),
    h('button', { class: 'btn', onClick: () => resultImage(r).toBlob(b => { const a = h('a', { href: URL.createObjectURL(b), download: `typing-panda-${Math.round(r.wpm)}wpm.png` }); document.body.append(a); a.click(); a.remove(); }) }, 'Download image'),
    h('button', { class: 'btn', onClick: () => tagsModal(r, async tags => { r.tags = tags; updateLocalResult(r.id, { tags }); if (cloud.user) { try { await cloud.setTags(r.id, tags); } catch { /* may not be uploaded yet */ } } toast('Tags saved'); }) }, 'Add tags'),
    savedBtn = h('button', { class: 'btn', disabled: !!ctx.saved || r.failed, onClick: () => { addLocalResult(r); if (cloud.user) uploadResult(r); savedBtn.textContent = 'Saved ✓'; savedBtn.disabled = true; toast('Result saved'); } }, ctx.saved ? 'Saved ✓' : 'Save result'));
  root.append(bar);

  // Additional analytics stay collapsed until the user asks to see more.
  const more = h('div', { class: 'result-more hidden', id: 'result-more' });
  const hasMore = S.showCharts && r.labels && r.labels.length;
  if (hasMore) {
    const grid = h('div', { class: 'two', style: 'margin-top:1rem' });
    const c2 = h('div', { class: 'card' }, h('h3', {}, 'Burst speed per word'));
    const c3 = h('div', { class: 'card' }, h('h3', {}, 'Accuracy over time'));
    const c4 = h('div', { class: 'card', style: 'grid-column:1/-1' }, h('h3', {}, 'Character performance'), h('p', { class: 'muted' }, 'Bars: accuracy per expected letter. Dots: average milliseconds between keys (right axis).'));
    grid.append(c2, c3, c4);
    more.append(grid);
    const bursts = (r.burstHistory || []).map(v => v);
    chart(c2, { labels: bursts.map((_, i) => i + 1), xTitle: 'word', series: [{ name: 'Burst', data: bursts, color: '#6F8BFF', kind: 'bars' }] });
    chart(c3, { labels: r.labels, xTitle: 'sec', series: [{ name: 'Accuracy', data: r.accHistory, color: '--main', unit: '%' }] });
    const cs = Object.entries(r.charStats || {}).filter(([, v]) => v.h + v.m > 0).sort((a, b) => b[1].h + b[1].m - (a[1].h + a[1].m)).slice(0, 26);
    chart(c4, { labels: cs.map(x => x[0]), xTitle: 'letter', series: [{ name: 'Accuracy', data: cs.map(([, v]) => (v.h / (v.h + v.m)) * 100), color: '--main', kind: 'bars', unit: '%', digits: 0 }, { name: 'Avg ms', data: cs.map(([, v]) => (v.n ? v.ms / v.n : 0)), color: '#FFB35C', kind: 'dots', axis: 'r', digits: 0 }] });
  }

  // words & error history
  const ws = r.wordStats || [], panel = h('div'), tabs = h('div', { class: 'tabs' });
  const missed = {}; (r.wordStats || []).forEach(w => { for (let i = 0; i < w.target.length; i++) if (w.typed[i] !== undefined && w.typed[i] !== w.target[i]) missed[w.target[i]] = (missed[w.target[i]] || 0) + 1; else if (w.typed[i] === undefined && w.typed.length < w.target.length && i >= w.typed.length) missed[w.target[i]] = (missed[w.target[i]] || 0) + 1; });
  const views = {
    Words: () => ws.map(w => h('span', { class: 'chip' + (w.ok ? '' : ' bad'), title: w.typed !== w.target ? 'typed: ' + w.typed : '' }, w.target || w.typed)),
    Mistyped: () => (wrong.length ? ws.filter(w => !w.ok && w.target).map(w => h('span', { class: 'chip bad' }, `${w.target} → ${w.typed || '∅'}`)) : [h('p', { class: 'muted' }, 'No mistyped words.')]),
    Slowest: () => slow.length ? (r.wordStats.filter(w => w.wpm > 0).sort((a, b) => a.wpm - b.wpm).slice(0, 12).map(w => h('span', { class: 'chip' }, `${w.target} · ${Math.round(w.wpm)}`))) : [h('p', { class: 'muted' }, 'No word timing data.')],
    Characters: () => Object.keys(missed).length ? Object.entries(missed).sort((a, b) => b[1] - a[1]).map(([c, n]) => h('span', { class: 'chip bad' }, `${c} × ${n}`)) : [h('p', { class: 'muted' }, 'No missed characters.')]
  };
  const show = k => { panel.innerHTML = ''; panel.append(...views[k]()); [...tabs.children].forEach(b => b.classList.toggle('on', b.dataset.k === k)); };
  Object.keys(views).forEach(k => tabs.append(h('button', { class: 'opt', 'data-k': k, onClick: () => show(k) }, k)));
  const copyRow = h('div', { class: 'row', style: 'margin-top:.8rem' },
    h('button', { class: 'btn sm', onClick: () => copyText(ws.map(w => w.target).join(' ')) }, 'Copy all words'), h('button', { class: 'btn sm', onClick: () => copyText(wrong.join(' ')) }, 'Copy incorrect words'),
    h('button', { class: 'btn sm', onClick: () => copyText(slow.join(' ')) }, 'Copy slow words'), h('button', { class: 'btn sm', onClick: () => copyText([...new Set([...wrong, ...slow])].join(' ')) }, 'Copy practice words'));
  if (ws.length) { root.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, 'Words & error history'), tabs, panel, copyRow)); show('Words'); }
  if (hasMore) {
    const toggle = h('button', { class: 'btn', style: 'display:flex;margin:1rem auto 0', 'aria-expanded': 'false', 'aria-controls': 'result-more', onClick: () => {
      const opening = more.classList.contains('hidden');
      more.classList.toggle('hidden', !opening);
      toggle.textContent = opening ? 'Show less' : 'Show more';
      toggle.setAttribute('aria-expanded', String(opening));
    } }, 'Show more');
    root.append(toggle, more);
  }
  return { savedBtn };
}

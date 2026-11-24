import { h, debounce } from '../util.js';
import { cloud } from '../backend.js';
import { notConfigured } from './login.js';
import { setQuery } from '../router.js';
import { formatSpeed, unitLabel } from '../settings.js';
import { WORDSETS } from '../data.js';

const VALUES = { time: [15, 30, 60, 120], words: [10, 25, 50, 100], quote: ['all', 'short', 'medium', 'long', 'very long'] };
const LANGS = [['english', 'English'], ...WORDSETS.filter(w => w.lang === 'Code').map(w => [w.id, w.name])];
const PER = 20;

export async function render(root, params, query) {
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, 'Leaderboards'), h('p', {}, 'Only valid, verified results appear here. Each user is listed once, with their best result.'))));
  const wrap = h('div', { class: 'wrap pad' }); root.append(wrap);
  if (!cloud.enabled) return wrap.append(notConfigured());
  wrap.append(h('div', { class: 'spinner' })); await cloud.ready; wrap.innerHTML = '';
  if (!cloud.enabled) return wrap.append(notConfigured());
  const f = { period: query.period || 'alltime', mode: query.mode || 'time', value: query.value || '60', language: query.language || 'english', difficulty: query.difficulty || 'any', friends: query.friends === '1', page: +query.page || 1 };
  let rows = [], jump = '';
  const sel = (key, opts, label) => h('label', { class: 'f', style: 'margin:0' }, label, h('select', { onChange: e => { f[key] = e.target.value; if (key === 'mode') f.value = String(VALUES[f.mode][key === 'mode' ? 0 : 0]); f.page = 1; sync(); build(); load(); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(f[key]) === String(v) }, t))));
  const bar = h('div', { class: 'card', style: 'margin-bottom:1rem' }), out = h('div');
  wrap.append(bar, out);
  function sync() { setQuery({ period: f.period, mode: f.mode, value: f.value, language: f.language, difficulty: f.difficulty, friends: f.friends ? 1 : 0, page: f.page }); }
  function build() {
    bar.innerHTML = '';
    const jumpIn = h('input', { type: 'search', placeholder: 'Jump to username…', value: jump, 'aria-label': 'Jump to username', style: 'min-width:180px', onInput: debounce(e => { jump = e.target.value.trim().toLowerCase(); const i = rows.findIndex(r => r.username.toLowerCase() === jump); if (i >= 0) { f.page = Math.floor(i / PER) + 1; sync(); draw(); } else if (jump) draw(jump); }, 300) });
    bar.append(h('div', { class: 'row', style: 'align-items:flex-end' },
      sel('period', [['alltime', 'All-time'], ['weekly', 'Weekly'], ['daily', 'Daily']], 'Board'), sel('mode', [['time', 'Time'], ['words', 'Words'], ['quote', 'Quote']], 'Mode'),
      sel('value', VALUES[f.mode].map(v => [v, f.mode === 'time' ? v + ' s' : f.mode === 'words' ? v + ' words' : v]), f.mode === 'quote' ? 'Length' : f.mode === 'time' ? 'Duration' : 'Word count'),
      sel('language', LANGS, 'Language'), sel('difficulty', [['any', 'Any'], ['normal', 'Normal'], ['expert', 'Expert'], ['master', 'Master']], 'Difficulty'),
      h('label', { class: 'row', style: 'margin-bottom:.5rem' }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: f.friends, onChange: e => { if (e.target.checked && !cloud.user) { e.target.checked = false; return out.prepend(h('p', { class: 'field-err' }, 'Sign in to see friends only.')); } f.friends = e.target.checked; f.page = 1; sync(); load(); } }), h('i')), 'Friends only'),
      jumpIn, h('button', { class: 'btn sm', onClick: () => load() }, '↻ Refresh')));
  }
  async function load() {
    out.innerHTML = ''; out.append(h('div', { class: 'spinner', role: 'status' }));
    try { rows = await cloud.getLeaderboard({ period: f.period, mode: f.mode, value: f.value, language: f.language, friendsOnly: f.friends, limit: 100 }); if (f.difficulty !== 'any') rows = rows.filter(r => r.difficulty === f.difficulty); draw(); }
    catch (e) { out.innerHTML = ''; out.append(h('div', { class: 'card empty' }, h('h3', {}, 'Could not load the leaderboard'), h('p', {}, /index/i.test(e.message) ? 'Firestore needs an index for this query. Open the browser console, click the link Firestore prints, and create it (see README).' : cloud.errText(e)), h('button', { class: 'btn primary', onClick: load }, 'Try again'))); }
  }
  function draw(highlight) {
    out.innerHTML = '';
    if (!rows.length) return out.append(h('div', { class: 'card empty' }, h('h3', {}, 'No results yet'), h('p', {}, f.friends ? 'None of your friends have a result in this category.' : 'Nobody has a valid result in this category — you could be first!'), h('a', { class: 'btn primary', href: '#/' }, 'Take a test')));
    const mineIdx = cloud.user ? rows.findIndex(r => r.userId === cloud.user.uid) : -1;
    if (cloud.user) out.append(h('div', { class: 'card flat', style: 'margin-bottom:.8rem' }, h('b', {}, 'Your rank: '), mineIdx >= 0 ? `#${mineIdx + 1} — ${formatSpeed(rows[mineIdx].wpm)} ${unitLabel()}` : 'not in the top 100 for this category'));
    const pages = Math.ceil(rows.length / PER); f.page = Math.min(Math.max(1, f.page), pages);
    const slice = rows.slice((f.page - 1) * PER, f.page * PER);
    out.append(h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['#', 'User', unitLabel(), 'Accuracy', 'Test', 'Date'].map(x => h('th', {}, x)))), h('tbody', {}, slice.map((r, i) => h('tr', { class: (cloud.user && r.userId === cloud.user.uid) || (highlight && r.username.toLowerCase().includes(highlight)) ? 'me' : '' }, h('td', {}, (f.page - 1) * PER + i + 1), h('td', {}, h('span', { class: 'row', style: 'flex-wrap:nowrap' }, h('span', { class: 'avatar', style: 'width:26px;height:26px;font-size:.7rem' }, r.username[0].toUpperCase()), h('a', { href: '#/profile/' + r.username }, r.username))), h('td', {}, h('b', {}, formatSpeed(r.wpm))), h('td', {}, r.accuracy.toFixed(1) + '%'), h('td', {}, `${r.mode} ${r.modeValue}${r.punctuation ? ' @' : ''}${r.numbers ? ' #' : ''}${r.difficulty !== 'normal' ? ' · ' + r.difficulty : ''}`), h('td', {}, new Date(r.createdAt).toLocaleDateString())))))));
    if (pages > 1) out.append(h('div', { class: 'row', style: 'justify-content:center;margin-top:1rem' }, h('button', { class: 'btn sm', disabled: f.page <= 1, onClick: () => { f.page--; sync(); draw(); } }, '← Prev'), h('span', { class: 'muted' }, `Page ${f.page} of ${pages}`), h('button', { class: 'btn sm', disabled: f.page >= pages, onClick: () => { f.page++; sync(); draw(); } }, 'Next →')));
  }
  build(); load();
}

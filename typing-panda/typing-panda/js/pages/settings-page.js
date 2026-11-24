// Settings page: searchable, categorised, schema-driven.
import { h, store, toast, confirmModal } from '../util.js';
import { SCHEMA, settings, setSetting, resetTheme } from '../settings.js';
import { wordsetModal, configIOModal, resetSettingsModal, cookieModal, themeModal } from '../modals.js';
import { getWordset } from '../textgen.js';
import { playPreview } from '../sound.js';
import { cloud } from '../backend.js';

const CATS = [['behavior', 'Behavior'], ['input', 'Input'], ['sound', 'Sound'], ['caret', 'Caret'], ['appearance', 'Appearance'], ['theme', 'Theme'], ['hide', 'Hide elements'], ['danger', 'Danger zone']];

function control(s) {
  const v = settings[s.key];
  if (s.type === 'toggle') return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!v, 'aria-label': s.label, onChange: e => setSetting(s.key, e.target.checked) }), h('i'));
  if (s.type === 'select') return h('select', { 'aria-label': s.label, onChange: e => setSetting(s.key, e.target.value) }, s.options.map(([val, label]) => h('option', { value: val, selected: String(v) === String(val) }, label)));
  if (s.type === 'number') return h('input', { type: 'number', min: s.min, max: s.max, value: v, 'aria-label': s.label, onChange: e => { const n = Math.min(s.max, Math.max(s.min, Math.floor(+e.target.value) || 0)); e.target.value = n; setSetting(s.key, n); } });
  if (s.type === 'range') { const out = h('span', { class: 'muted', style: 'min-width:2.6rem;text-align:right' }, v); return h('div', { class: 'row', style: 'flex-wrap:nowrap;width:100%' }, h('input', { type: 'range', min: s.min, max: s.max, step: s.step, value: v, 'aria-label': s.label, onInput: e => { out.textContent = e.target.value; setSetting(s.key, +e.target.value); } }), out); }
  if (s.type === 'text') return h('input', { type: 'text', value: v, placeholder: 'https://…', 'aria-label': s.label, onChange: e => { const t = e.target.value.trim(); if (t && !/^https?:\/\//i.test(t)) { toast('Use a full https:// image address', 'err'); e.target.value = settings[s.key]; return; } setSetting(s.key, t); } });
  if (s.type === 'color') return h('input', { type: 'color', value: v, 'aria-label': s.label, onInput: e => { setSetting(s.key, e.target.value); if (settings.theme !== 'custom') setSetting('theme', 'custom'); } });
  if (s.type === 'wordset') return h('button', { class: 'btn sm', onClick: () => wordsetModal() }, getWordset(v).name);
  if (s.key === '_preview') return h('button', { class: 'btn sm', onClick: playPreview }, '▶ Play preview');
  if (s.key === '_resetTheme') return h('button', { class: 'btn sm', onClick: () => { resetTheme(); toast('Theme reset'); } }, 'Reset theme');
  return h('span');
}

export function render(root) {
  let cat = 'behavior', q = '';
  const search = h('input', { type: 'search', placeholder: 'Search settings…', 'aria-label': 'Search settings', onInput: e => { q = e.target.value.toLowerCase(); draw(); } });
  const nav = h('div', { class: 'side-nav', role: 'tablist' }), list = h('div', { class: 'card' });
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, 'Settings'), h('p', {}, 'Everything here changes the site immediately and is saved automatically' + (cloud.user ? ' to your account.' : ' on this device.')), h('div', { style: 'max-width:420px' }, search))),
    h('div', { class: 'wrap pad' }, h('div', { class: 'settings-layout' }, nav, list)));
  function drawNav() { nav.innerHTML = ''; CATS.forEach(([id, name]) => nav.append(h('button', { class: cat === id && !q ? 'on' : '', role: 'tab', onClick: () => { cat = id; q = ''; search.value = ''; draw(); } }, name))); }
  function row(s) { return h('div', { class: 'set-row' }, h('div', {}, h('h4', {}, s.label), s.desc && h('p', {}, s.desc)), h('div', { class: 'ctl' }, control(s))); }
  function draw() {
    drawNav(); list.innerHTML = '';
    if (q) {
      const m = SCHEMA.filter(s => (s.label + ' ' + s.desc + ' ' + s.cat).toLowerCase().includes(q));
      list.append(h('h3', {}, `Results for “${q}”`), m.length ? m.map(row) : h('div', { class: 'empty' }, 'No setting matches your search.'));
      return;
    }
    if (cat === 'danger') {
      list.append(h('h3', {}, 'Danger zone'),
        dz('Reset settings', 'Restore every setting to its default.', 'Reset', () => resetSettingsModal(), true),
        dz('Import / export configuration', 'Back up your settings as JSON or load a saved configuration.', 'Open', () => configIOModal()),
        dz('Theme picker', 'Preview and choose a theme.', 'Open', () => themeModal()),
        dz('Cookie & storage preferences', 'See what this site stores in your browser.', 'Open', () => cookieModal()),
        dz('Clear local test data', 'Deletes recent results, personal bests and letter statistics stored on this device. Cloud results are not touched.', 'Clear', async () => { if (await confirmModal('Clear local test data?', 'This cannot be undone.', 'Clear')) { ['results', 'pbs', 'charStats', 'pending', 'ach', 'notifs'].forEach(k => store.del(k)); toast('Local test data cleared'); } }, true),
        dz('Clear lesson progress', 'Resets Learn mode on this device.', 'Clear', async () => { if (await confirmModal('Clear lesson progress?', 'Learn mode will start from the beginning.', 'Clear')) { store.del('learn'); toast('Lesson progress cleared'); } }, true));
      return;
    }
    if (cat === 'theme') list.append(h('div', { class: 'card flat', style: 'margin-bottom:1rem' }, h('p', { class: 'muted', style: 'margin:0 0 .4rem' }, 'Live preview'), h('div', { class: 'words', style: 'font-family:var(--font-mono);font-size:1.4rem' }, h('span', { style: 'color:var(--text)' }, 'the quick '), h('span', { style: 'color:var(--err)' }, 'brxwn '), h('span', { style: 'color:var(--sub)' }, 'fox jumps'), h('span', { class: 'caret', style: 'position:static;display:inline-block;margin-left:2px;height:1.4rem;vertical-align:middle' }))));
    list.append(...SCHEMA.filter(s => s.cat === cat).map(row));
  }
  function dz(title, desc, label, fn, danger) { return h('div', { class: 'set-row' }, h('div', {}, h('h4', {}, title), h('p', {}, desc)), h('div', { class: 'ctl' }, h('button', { class: 'btn sm' + (danger ? ' danger' : ''), onClick: fn }, label))); }
  draw();
}

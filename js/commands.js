// Command palette (Ctrl+K). Every command performs a real action.
import { h, openModal, modalState } from './util.js';
import { settings, setSetting, setMany } from './settings.js';
import { navigate } from './router.js';
import { cloud } from './backend.js';
import * as M from './modals.js';
import { FUNBOX } from './data.js';

function list() {
  const t = (title, run, hint = '') => ({ title, run, hint });
  const onTest = f => () => { f(); navigate('/'); };
  const cmds = [
    t('Go to Practice', () => navigate('/')), t('Go to Learn', () => navigate('/learn')), t('Go to Leaderboards', () => navigate('/leaderboards')),
    t('Go to About', () => navigate('/about')), t('Open Settings', () => navigate('/settings')), t('Open Account', () => navigate(cloud.user ? '/account' : '/login')),
    t('Open Friends', () => navigate('/friends')), t('Search profiles', () => navigate('/profile')), t('Login / Register', () => navigate('/login')),
    t('Start a new test', () => { navigate('/'); document.dispatchEvent(new Event('panda:restart')); }, 'Tab'),
    t('Mode: time', onTest(() => setSetting('mode', 'time'))), t('Mode: words', onTest(() => setSetting('mode', 'words'))), t('Mode: quote', onTest(() => setSetting('mode', 'quote'))),
    t('Mode: zen', onTest(() => setSetting('mode', 'zen'))), t('Mode: custom text…', () => M.customTextModal()),
    ...[15, 30, 60, 120].map(n => t(`Select ${n} seconds`, onTest(() => setMany({ mode: 'time', time: n })))),
    ...[10, 25, 50, 100].map(n => t(`Select ${n} words`, onTest(() => setMany({ mode: 'words', words: n })))),
    t('Custom duration…', () => M.customDurationModal()), t('Custom word count…', () => M.customWordsModal()),
    t('Enable punctuation', () => setSetting('punctuation', true), 'Alt+P'), t('Disable punctuation', () => setSetting('punctuation', false), 'Alt+P'),
    t('Enable numbers', () => setSetting('numbers', true), 'Alt+N'), t('Disable numbers', () => setSetting('numbers', false), 'Alt+N'),
    t('Change language / wordset…', () => M.wordsetModal()), t('Search quotes…', () => M.quoteModal()), t('Presets…', () => M.presetsModal()),
    t('Funbox (experimental modes)…', () => M.funboxModal()), ...FUNBOX.filter(f => f.id !== 'none').map(f => t('Funbox: ' + f.name, onTest(() => setSetting('funbox', f.id)))), t('Funbox: off', onTest(() => setSetting('funbox', 'none'))),
    t('Change theme…', () => M.themeModal()), t('Theme: Panda Night', () => setSetting('theme', 'dark')), t('Theme: Panda Light', () => setSetting('theme', 'light')), t('Theme: Electric', () => setSetting('theme', 'electric')),
    t('Theme: auto (system)', () => setSetting('theme', 'auto')), t('Theme: random', () => setSetting('theme', 'random')),
    t(settings.soundOn ? 'Turn sounds off' : 'Turn sounds on', () => setSetting('soundOn', !settings.soundOn)),
    t(settings.keymap ? 'Hide keymap' : 'Show keymap', () => setSetting('keymap', !settings.keymap)),
    t(settings.focusMode ? 'Turn focus mode off' : 'Turn focus mode on', () => setSetting('focusMode', !settings.focusMode)),
    t('Keyboard shortcuts', () => M.shortcutsModal(), 'Shift+?'), t('Import / export configuration…', () => M.configIOModal()),
    t('Cookie preferences', () => M.cookieModal()), t('Contact & support', () => M.contactModal()), t('Version history', () => M.versionModal())
  ];
  M.getPresets().forEach(p => cmds.push(t('Apply preset: ' + p.name, onTest(() => M.applyPreset(p)))));
  if (cloud.user) cmds.push(t('Sign out', () => cloud.signOut()));
  return cmds;
}

export function openPalette() {
  const cmds = list();
  let sel = 0, shown = cmds;
  const input = h('input', { type: 'text', placeholder: 'Type a command…', 'aria-label': 'Search commands', autocomplete: 'off' });
  const box = h('div', { class: 'cmd-list', role: 'listbox' });
  const draw = () => {
    box.innerHTML = '';
    shown.slice(0, 60).forEach((c, i) => box.append(h('button', { class: 'cmd' + (i === sel ? ' sel' : ''), role: 'option', onMouseenter: () => { sel = i; mark(); }, onClick: () => run(c) }, h('span', {}, c.title), c.hint && h('small', {}, c.hint))));
    if (!shown.length) box.append(h('div', { class: 'empty' }, 'No command found.'));
  };
  const mark = () => [...box.children].forEach((el, i) => el.classList.toggle('sel', i === sel));
  const run = c => { m.close(); setTimeout(() => c.run(), 0); };
  input.addEventListener('input', () => { const q = input.value.toLowerCase().split(/\s+/).filter(Boolean); shown = cmds.filter(c => q.every(w => c.title.toLowerCase().includes(w))); sel = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, Math.min(shown.length, 60) - 1); mark(); box.children[sel] && box.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); box.children[sel] && box.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
  });
  draw();
  const m = openModal({ title: 'Command palette', content: h('div', {}, input, box) });
}
export const paletteOpen = () => modalState.open > 0;

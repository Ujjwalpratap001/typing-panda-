// Reusable dialogs: shortcuts, contact, cookies, custom text/duration/words, wordsets, quotes, presets, themes, config IO, tags, history…
import { h, openModal, confirmModal, promptModal, store, toast, uid, copyText, download, fmtDate, esc } from './util.js';
import { settings, setSetting, setMany, resetSettings, exportSettings, importSettings, resetTheme, DEFAULTS } from './settings.js';
import { WORDSETS, FUNBOX, quoteLen } from './data.js';
import { allQuotes, getFavs, toggleFav } from './textgen.js';
import { cloud } from './backend.js';
import { site } from './site-config.js';
import { requestSync } from './sync.js';
import { getLocalNotifs, markLocalRead } from './notify.js';
import { navigate } from './router.js';

export const SHORTCUTS = [
  ['Restart test', 'Tab (or Esc — see Settings)'], ['Command palette', 'Ctrl + K'], ['Command palette (alt)', 'Ctrl + Shift + P'],
  ['Toggle punctuation', 'Alt + P'], ['Toggle numbers', 'Alt + N'], ['Finish Zen test', 'Shift + Enter'],
  ['Delete current word', 'Ctrl + Backspace'], ['Close any dialog', 'Esc'], ['Open this list', 'Shift + ?']
];
export function shortcutsModal() {
  openModal({ title: 'Keyboard shortcuts', content: h('div', { class: 'sc-list' }, SHORTCUTS.map(([a, b]) => h('div', {}, h('span', {}, a), h('kbd', {}, b)))) });
}

export function versionModal() {
  openModal({ title: 'Version history', content: h('div', {}, h('h3', {}, 'v' + site.version), h('p', { class: 'muted' }, 'Electric Blue / Neon Lime / Deep Navy redesign. Typing engine with replay, results dashboard, Learn mode, settings, command palette, presets, funbox, accounts, leaderboards, friends and notifications.')) });
}

export function contactModal() {
  const body = site.supportEmail
    ? (() => {
      const msg = h('textarea', { placeholder: 'How can we help?' });
      return { content: h('div', {}, h('label', { class: 'f' }, 'Message'), msg), actions: [{ label: 'Cancel' }, { label: 'Open email', kind: 'primary', onClick: () => { if (!msg.value.trim()) return false; location.href = `mailto:${site.supportEmail}?subject=${encodeURIComponent('Typing Panda support')}&body=${encodeURIComponent(msg.value)}`; } }] };
    })()
    : { content: h('p', {}, 'No support email has been configured for this site yet. The site owner can set one in js/site-config.js.'), actions: [] };
  openModal({ title: 'Contact & support', ...body });
}

export function cookieModal() {
  openModal({
    title: 'Cookie & storage preferences',
    content: h('div', {}, h('p', {}, 'Typing Panda uses your browser’s local storage for settings, recent results, presets and lesson progress. If you sign in, Firebase also uses its own storage to keep you signed in.'),
      h('p', { class: 'muted' }, 'No advertising or analytics cookies are used by this site.')),
    actions: [{ label: 'Close' }, { label: 'Clear local data', kind: 'danger', close: false, onClick: async () => { if (await confirmModal('Clear local data?', 'This deletes settings, recent results, presets and progress stored on this device.', 'Clear')) { store.keys().forEach(k => localStorage.removeItem(k)); location.reload(); } } }]
  });
}

function numberModal(title, label, min, max, current, apply) {
  const input = h('input', { type: 'number', min, max, value: current }), err = h('div', { class: 'field-err' });
  openModal({ title, content: h('div', {}, h('label', { class: 'f' }, label), input, err), actions: [{ label: 'Cancel' }, { label: 'Apply', kind: 'primary', onClick: () => { const v = Math.floor(+input.value); if (!(v >= min && v <= max)) { err.textContent = `Enter a whole number from ${min} to ${max}.`; return false; } apply(v); } }] });
}
export const customDurationModal = () => numberModal('Custom duration', 'Seconds', 5, 3600, settings.time, v => setMany({ mode: 'time', time: v }));
export const customWordsModal = () => numberModal('Custom word count', 'Words', 1, 1000, settings.words, v => setMany({ mode: 'words', words: v }));

// ---- custom text ----
const MAX_TEXT = 20000;
export function customTextModal() {
  const saved = () => store.get('savedTexts', []);
  const ta = h('textarea', { placeholder: 'Paste or type your own text…', maxlength: MAX_TEXT }, settings.customText);
  const err = h('div', { class: 'field-err' });
  const list = h('div');
  const limit = h('select', {}, [['text', 'Type the whole text'], ['words', 'Fixed number of words'], ['time', 'Fixed time (seconds)']].map(([v, t]) => h('option', { value: v, selected: settings.customLimit === v }, t)));
  const lv = h('input', { type: 'number', min: 1, max: 3600, value: settings.customLimitValue });
  function renderList() {
    list.innerHTML = '';
    const s = saved();
    if (!s.length) { list.append(h('p', { class: 'muted' }, 'No saved texts yet.')); return; }
    s.forEach(t => list.append(h('div', { class: 'row spread', style: 'margin:.3rem 0' }, h('span', {}, t.name),
      h('span', { class: 'row' },
        h('button', { class: 'btn sm', onClick: () => { ta.value = t.text; } }, 'Load'),
        h('button', { class: 'btn sm', onClick: async () => { const n = await promptModal('Rename text', 'Name', t.name, { validate: v => (v ? null : 'Enter a name') }); if (n) { t.name = n; t.updatedAt = Date.now(); store.set('savedTexts', s); requestSync(); renderList(); } } }, 'Rename'),
        h('button', { class: 'btn sm danger', onClick: () => { store.set('savedTexts', saved().filter(x => x.id !== t.id)); requestSync(); renderList(); } }, 'Delete')))));
  }
  const file = h('input', { type: 'file', accept: '.txt,text/plain', 'aria-label': 'Import text file', onChange: async e => { const f = e.target.files[0]; if (!f) return; if (f.size > MAX_TEXT * 2) { err.textContent = 'File is too large.'; return; } ta.value = (await f.text()).slice(0, MAX_TEXT); } });
  const content = h('div', {}, ta, err, h('div', { class: 'row', style: 'margin-top:.6rem' }, limit, lv), h('label', { class: 'f' }, 'Import a .txt file'), file, h('h3', { style: 'margin-top:1rem' }, 'Saved texts'), list);
  renderList();
  const clean = () => ta.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim();
  const check = t => (t.split(' ').filter(Boolean).length < 1 ? 'Enter at least one word.' : t.length > MAX_TEXT ? 'Text is too long.' : null);
  openModal({ title: 'Custom text', wide: true, content, actions: [
    { label: 'Save text', close: false, onClick: async () => { const t = clean(), m = check(t); if (m) { err.textContent = m; return; } const n = await promptModal('Save text', 'Name', t.slice(0, 24), { validate: v => (v ? null : 'Enter a name') }); if (n) { const s = saved(); s.push({ id: uid(), name: n, text: t, createdAt: Date.now(), updatedAt: Date.now() }); store.set('savedTexts', s.slice(-30)); requestSync(); renderList(); toast('Text saved'); } } },
    { label: 'Use this text', kind: 'primary', onClick: () => { const t = clean(), m = check(t); if (m) { err.textContent = m; return false; } setMany({ mode: 'custom', customText: t, customLimit: limit.value, customLimitValue: Math.max(1, Math.floor(+lv.value) || 50) }); } }
  ] });
}

export function wordsetModal() {
  const q = h('input', { type: 'search', placeholder: 'Search wordsets…', 'aria-label': 'Search wordsets' }), list = h('div');
  const draw = () => {
    list.innerHTML = '';
    WORDSETS.filter(w => (w.name + w.lang + w.desc).toLowerCase().includes(q.value.toLowerCase())).forEach(w => list.append(h('button', { class: 'cmd' + (w.id === settings.wordset ? ' sel' : ''), onClick: () => { setSetting('wordset', w.id); toast('Wordset: ' + w.name); box.close(); } }, h('span', {}, w.name, h('br'), h('small', {}, w.desc)), h('small', {}, w.words.length + ' words'))));
    if (!list.children.length) list.append(h('p', { class: 'muted' }, 'No wordset matches.'));
  };
  q.addEventListener('input', draw); draw();
  const box = openModal({ title: 'Language & wordset', content: h('div', {}, q, h('div', { class: 'cmd-list' }, list)) });
}

// ---- quotes ----
export function quoteModal() {
  const q = h('input', { type: 'search', placeholder: 'Search by text, author or source…', 'aria-label': 'Search quotes' });
  const len = h('select', {}, ['all', 'short', 'medium', 'long', 'very long'].map(l => h('option', { value: l }, l)));
  const list = h('div', { class: 'cmd-list' });
  const draw = () => {
    list.innerHTML = '';
    const rows = allQuotes().filter(x => x.approvalStatus === 'approved' && (len.value === 'all' || quoteLen(x) === len.value) && (x.text + x.author + x.source).toLowerCase().includes(q.value.toLowerCase())).slice(0, 40);
    if (!rows.length) list.append(h('div', { class: 'empty' }, 'No quote found.'));
    rows.forEach(x => {
      const fav = getFavs().includes(x.id);
      list.append(h('div', { class: 'notif' }, h('div', { style: 'flex:1' }, h('b', {}, x.text.length > 120 ? x.text.slice(0, 120) + '…' : x.text), h('small', { class: 'muted' }, `${x.author} · ${x.source} · ${quoteLen(x)}`)),
        h('div', { class: 'row', style: 'flex-direction:column;align-items:stretch' },
          h('button', { class: 'btn sm primary', onClick: () => { setMany({ mode: 'quote', quoteId: x.id }); box.close(); } }, 'Use'),
          h('button', { class: 'btn sm', 'aria-label': 'Toggle favourite', onClick: e => { const on = toggleFav(x.id); e.target.textContent = on ? '★ Fav' : '☆ Fav'; requestSync(); } }, fav ? '★ Fav' : '☆ Fav'),
          h('button', { class: 'btn sm', onClick: () => ratingModal(x) }, 'Rate'),
          h('button', { class: 'btn sm', onClick: () => reportModal('quote', x.id, 'Report quote') }, 'Report'))));
    });
  };
  q.addEventListener('input', draw); len.addEventListener('change', draw); draw();
  const box = openModal({ title: 'Quotes', wide: true, content: h('div', {}, h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:200px' }, q), len), list),
    actions: [{ label: 'Submit a quote', close: false, onClick: () => submitQuoteModal() }, { label: 'Close' }] });
}
export function ratingModal(quote) {
  const sel = h('select', {}, [5, 4, 3, 2, 1].map(n => h('option', { value: n }, '★'.repeat(n))));
  openModal({ title: 'Rate quote', content: h('div', {}, h('p', { class: 'muted' }, quote.author), sel), actions: [{ label: 'Cancel' }, { label: 'Submit rating', kind: 'primary', onClick: async () => { try { if (!cloud.user) throw new Error('Sign in to rate quotes.'); await cloud.rateQuote(quote.id, +sel.value); toast('Thanks for rating!'); } catch (e) { toast(cloud.errText ? cloud.errText(e) : e.message, 'err'); return false; } } }] });
}
export function reportModal(kind, targetId, title = 'Report') {
  const r = h('textarea', { maxlength: 500, placeholder: 'What is wrong?' }), err = h('div', { class: 'field-err' });
  openModal({ title, content: h('div', {}, r, err), actions: [{ label: 'Cancel' }, { label: 'Send report', kind: 'primary', onClick: async () => { if (r.value.trim().length < 5) { err.textContent = 'Please describe the problem.'; return false; } try { if (!cloud.user) throw new Error('Sign in to send reports.'); await cloud.report(kind, targetId, r.value.trim()); toast('Report sent. Thank you.'); } catch (e) { err.textContent = e.message; return false; } } }] });
}
export function submitQuoteModal() {
  const text = h('textarea', { maxlength: 600, placeholder: 'Quote text (20–600 characters)' }), author = h('input', { type: 'text', placeholder: 'Author', maxlength: 80 }), source = h('input', { type: 'text', placeholder: 'Source (book, speech…)', maxlength: 120 }), err = h('div', { class: 'field-err' });
  openModal({ title: 'Submit a quote', content: h('div', {}, h('p', { class: 'muted' }, 'Submissions are reviewed by a moderator before they appear for everyone.'), text, author, source, err), actions: [{ label: 'Cancel' }, { label: 'Submit', kind: 'primary', onClick: async () => {
    const t = text.value.trim().replace(/\s+/g, ' ');
    if (t.length < 20 || !author.value.trim()) { err.textContent = 'Add the quote (20+ characters) and its author.'; return false; }
    try { if (!cloud.user) throw new Error('Sign in to submit quotes.'); await cloud.submitQuote({ text: t, author: author.value.trim(), source: source.value.trim() || 'Unknown' }); toast('Quote submitted for review'); } catch (e) { err.textContent = e.message; return false; }
  } }] });
}

// ---- presets ----
const PRESET_KEYS = ['mode', 'time', 'words', 'quoteLen', 'wordset', 'difficulty', 'punctuation', 'numbers', 'stopOnError', 'confidence', 'freedom', 'strictSpace', 'quickEnd', 'blindMode', 'funbox'];
export const DEFAULT_PRESETS = [
  { id: 'd1', name: 'Quick sprint (15s)', cfg: { mode: 'time', time: 15, punctuation: false, numbers: false, funbox: 'none' } },
  { id: 'd2', name: 'Standard (30s)', cfg: { mode: 'time', time: 30, punctuation: false, numbers: false, funbox: 'none' } },
  { id: 'd3', name: 'Punctuation practice (60s)', cfg: { mode: 'time', time: 60, punctuation: true, numbers: true, funbox: 'none' } },
  { id: 'd4', name: '50 words', cfg: { mode: 'words', words: 50, funbox: 'none' } },
  { id: 'd5', name: 'Medium quote', cfg: { mode: 'quote', quoteLen: 'medium', quoteId: '', funbox: 'none' } },
  { id: 'd6', name: 'JavaScript code (30s)', cfg: { mode: 'time', time: 30, wordset: 'code-javascript', funbox: 'none' } }
];
export const getPresets = () => store.get('presets', []);
export const applyPreset = p => { const c = {}; for (const k of PRESET_KEYS) if (k in p.cfg && typeof p.cfg[k] === typeof DEFAULTS[k]) c[k] = p.cfg[k]; setMany({ quoteId: '', ...c }); toast('Preset applied: ' + p.name); };
export function presetsModal() {
  const list = h('div');
  const snapshot = () => Object.fromEntries(PRESET_KEYS.map(k => [k, settings[k]]));
  const draw = () => {
    list.innerHTML = '';
    const mine = getPresets().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    const row = (p, own) => h('div', { class: 'row spread', style: 'margin:.35rem 0' }, h('span', {}, (p.fav ? '★ ' : '') + p.name, !own && h('span', { class: 'pill', style: 'margin-left:.4rem' }, 'default')),
      h('span', { class: 'row' }, h('button', { class: 'btn sm primary', onClick: () => { applyPreset(p); box.close(); } }, 'Apply'),
        own && [h('button', { class: 'btn sm', onClick: () => { const all = getPresets(), x = all.find(y => y.id === p.id); x.fav = !x.fav; store.set('presets', all); requestSync(); draw(); } }, p.fav ? 'Unfav' : 'Fav'),
          h('button', { class: 'btn sm', onClick: async () => { const n = await promptModal('Rename preset', 'Name', p.name, { validate: v => (v ? null : 'Enter a name') }); if (n) { const all = getPresets(); const x = all.find(y => y.id === p.id); x.name = n; x.updatedAt = Date.now(); store.set('presets', all); requestSync(); draw(); } } }, 'Rename'),
          h('button', { class: 'btn sm', onClick: () => { const all = getPresets(); const x = all.find(y => y.id === p.id); x.cfg = snapshot(); x.updatedAt = Date.now(); store.set('presets', all); requestSync(); toast('Preset updated'); } }, 'Update'),
          h('button', { class: 'btn sm danger', onClick: () => { store.set('presets', getPresets().filter(y => y.id !== p.id)); requestSync(); draw(); } }, 'Delete')]));
    list.append(h('h3', {}, 'Your presets'), mine.length ? mine.map(p => row(p, true)) : h('p', { class: 'muted' }, 'None yet — save your current setup below.'), h('h3', { style: 'margin-top:1rem' }, 'Defaults'), DEFAULT_PRESETS.map(p => row(p, false)));
  };
  draw();
  const box = openModal({ title: 'Presets', wide: true, content: list, actions: [{ label: 'Save current setup as preset', kind: 'primary', close: false, onClick: async () => { const n = await promptModal('New preset', 'Name', '', { validate: v => (v ? null : 'Enter a name') }); if (n) { const all = getPresets(); all.push({ id: uid(), name: n, cfg: snapshot(), fav: false, createdAt: Date.now(), updatedAt: Date.now() }); store.set('presets', all.slice(-30)); requestSync(); toast('Preset created'); draw(); } } }, { label: 'Close' }] });
}

// ---- theme / config / focus ----
const THEMES = [['dark', 'Panda Night', '#050D2E', '#C6FF00'], ['light', 'Panda Light', '#EEF0FF', '#1A4DFF'], ['electric', 'Electric', '#1A4DFF', '#C6FF00']];
export function themeModal() {
  const grid = h('div', { class: 'grid g3' }, THEMES.map(([id, name, bg, fg]) => h('button', { class: 'lesson', style: `background:${bg};color:${fg};border-color:${fg}`, onClick: () => { setSetting('theme', id); toast('Theme: ' + name); } }, name, h('small', { style: `color:${fg};opacity:.8` }, 'The quick brown fox'))));
  openModal({ title: 'Choose a theme', content: h('div', {}, grid, h('p', { class: 'muted', style: 'margin-top:1rem' }, 'More options (auto, random, custom colours) are in Settings → Theme.')), actions: [{ label: 'Reset theme', onClick: () => resetTheme() }, { label: 'Close' }] });
}
export function configIOModal() {
  const ta = h('textarea', { 'aria-label': 'Configuration JSON' }, exportSettings());
  openModal({ title: 'Import / export configuration', wide: true, content: h('div', {}, h('p', { class: 'muted' }, 'Copy this JSON to back up your settings, or paste a configuration here and press Import.'), ta), actions: [
    { label: 'Copy', close: false, onClick: () => copyText(ta.value) }, { label: 'Download', close: false, onClick: () => download('typing-panda-settings.json', ta.value, 'application/json') },
    { label: 'Import', kind: 'primary', onClick: () => { try { importSettings(ta.value); toast('Configuration imported'); } catch (e) { toast('Import failed: ' + e.message, 'err'); return false; } } }] });
}
export async function resetSettingsModal() { if (await confirmModal('Reset all settings?', 'Every setting returns to its default. Your results are not deleted.', 'Reset')) { resetSettings(); toast('Settings reset'); } }
export function focusModal() {
  const rows = [['focusMode', 'Fade the interface while typing'], ['hideTips', 'Hide tips'], ['hideLive', 'Hide live statistics']];
  openModal({ title: 'Focus mode', content: h('div', {}, rows.map(([k, t]) => h('div', { class: 'row spread', style: 'margin:.6rem 0' }, h('span', {}, t), h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: settings[k], onChange: e => setSetting(k, e.target.checked) }), h('i'))))), actions: [{ label: 'Done', kind: 'primary' }] });
}

// ---- result helpers ----
export function tagsModal(result, onSave) {
  const input = h('input', { type: 'text', value: (result.tags || []).join(', '), placeholder: 'e.g. new keyboard, morning' });
  openModal({ title: 'Result tags', content: h('div', {}, h('label', { class: 'f' }, 'Comma-separated tags'), input), actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: () => { const t = input.value.split(',').map(x => x.trim().slice(0, 24)).filter(Boolean).slice(0, 8); onSave(t); } }] });
}
export function eventHistoryModal(r) {
  const ev = r.events || [];
  const rows = ev.slice(0, 600).map(([t, k, ch]) => h('tr', {}, h('td', {}, (t / 1000).toFixed(2) + 's'), h('td', {}, { c: 'char', s: 'space', b: 'backspace', w: 'delete word' }[k]), h('td', {}, k === 'c' ? ch : '')));
  openModal({ title: 'Event history', wide: true, content: ev.length ? h('div', {}, h('p', { class: 'muted' }, `${ev.length} recorded keystrokes${ev.length > 600 ? ' (first 600 shown)' : ''}`), h('div', { class: 'table-wrap', style: 'max-height:50vh;overflow:auto' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Time'), h('th', {}, 'Key'), h('th', {}, 'Char'))), h('tbody', {}, rows)))) : h('p', { class: 'muted' }, 'No keystroke data is stored for this result.') });
}
export function practiceWordsModal(title, words) {
  const uniq = [...new Set(words)];
  if (!uniq.length) { toast('Nothing to practise here — nice!'); return; }
  const reps = h('select', {}, [1, 3, 5].map(n => h('option', { value: n }, n + '×')));
  openModal({ title, content: h('div', {}, h('div', {}, uniq.slice(0, 60).map(w => h('span', { class: 'chip' }, w))), h('label', { class: 'f' }, 'Repeat each list'), reps), actions: [{ label: 'Copy words', close: false, onClick: () => copyText(uniq.join(' ')) }, { label: 'Start practice', kind: 'primary', onClick: () => { let t = []; for (let i = 0; i < +reps.value; i++) t = t.concat([...uniq].sort(() => Math.random() - 0.5)); setMany({ mode: 'custom', customText: t.join(' '), customLimit: 'text' }); navigate('/'); } }] });
}
export function funboxModal() {
  const list = h('div', { class: 'cmd-list' }, FUNBOX.map(f => h('button', { class: 'cmd' + (settings.funbox === f.id ? ' sel' : ''), onClick: () => { setSetting('funbox', f.id); toast(f.id === 'none' ? 'Funbox off' : 'Funbox: ' + f.name + ' (not ranked)'); box.close(); } }, h('span', {}, f.name, h('br'), h('small', {}, f.desc)), f.id !== 'none' && h('span', { class: 'pill exp' }, 'experimental'))));
  const box = openModal({ title: 'Funbox — experimental modes', content: h('div', {}, h('p', { class: 'muted' }, 'Funbox results are never ranked on leaderboards.'), list) });
}

// ---- notifications ----
export async function notificationsModal(onChange) {
  const body = h('div', {}, h('div', { class: 'spinner' }));
  const box = openModal({ title: 'Notifications', content: body, actions: [{ label: 'Mark all as read', close: false, onClick: async () => { markLocalRead(); if (cloud.user) { try { await cloud.markRead(all.filter(n => n.cloud && !n.isRead).map(n => n.id)); } catch { /* ignore */ } } all.forEach(n => (n.isRead = true)); draw(); onChange && onChange(); } }, { label: 'Close' }] });
  let all = getLocalNotifs().map(n => ({ ...n }));
  if (cloud.user) { try { all = all.concat(await cloud.getNotifications()); } catch { /* ignore */ } }
  all.sort((a, b) => b.createdAt - a.createdAt);
  function draw() {
    body.innerHTML = '';
    if (!all.length) { body.append(h('div', { class: 'empty' }, h('h3', {}, 'All caught up'), h('p', {}, 'New notifications will show up here.'))); return; }
    all.forEach(n => body.append(h('div', { class: 'notif' + (n.isRead ? '' : ' unread'), style: 'cursor:pointer', onClick: async () => { if (!n.isRead) { if (n.cloud) { try { await cloud.markRead([n.id]); } catch { /* ignore */ } } else markLocalRead(n.id); n.isRead = true; onChange && onChange(); } box.close(); if (n.link) navigate(n.link); } }, h('div', {}, h('b', {}, n.title), h('span', {}, n.message), h('small', { class: 'muted', style: 'display:block' }, fmtDate(n.createdAt))))));
  }
  draw();
}

export function profileSetupModal() {
  const user = h('input', { type: 'text', placeholder: 'username', maxlength: 20 }), disp = h('input', { type: 'text', placeholder: 'Display name', maxlength: 40, value: (cloud.user && cloud.user.displayName) || '' }), err = h('div', { class: 'field-err' });
  openModal({ title: 'Choose your username', content: h('div', {}, h('p', { class: 'muted' }, 'Pick a public username (3–20 letters, numbers or underscores).'), user, disp, err), actions: [{ label: 'Sign out', onClick: () => cloud.signOut() }, { label: 'Create profile', kind: 'primary', onClick: async () => { try { await cloud.createProfile(user.value.trim(), disp.value.trim()); toast('Profile created'); } catch (e) { err.textContent = cloud.errText(e); return false; } } }] });
}

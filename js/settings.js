// Central typed-ish configuration: schema -> defaults -> persistence -> apply to the page.
import { store } from './util.js';

const sel = (...o) => o.map(x => (Array.isArray(x) ? x : [x, x]));

// cat: behavior | input | sound | caret | appearance | theme | hide
export const SCHEMA = [
  { key: 'punctuation', cat: 'behavior', label: 'Punctuation', desc: 'Add capital letters and punctuation marks to words.', type: 'toggle', def: false },
  { key: 'numbers', cat: 'behavior', label: 'Numbers', desc: 'Mix random numbers into the word list.', type: 'toggle', def: false },
  { key: 'difficulty', cat: 'behavior', label: 'Difficulty', desc: 'Normal: nothing special. Expert: the test fails when you submit a wrong word. Master: fails on any wrong letter.', type: 'select', def: 'normal', options: sel('normal', 'expert', 'master') },
  { key: 'wordset', cat: 'behavior', label: 'Language / wordset', desc: 'English or programming-language word lists.', type: 'wordset', def: 'common' },
  { key: 'quickRestart', cat: 'behavior', label: 'Quick restart key', desc: 'Key that restarts the test instantly.', type: 'select', def: 'tab', options: sel(['tab', 'Tab'], ['esc', 'Esc'], ['off', 'Off']) },
  { key: 'saveResults', cat: 'behavior', label: 'Save results', desc: 'Store finished tests on this device (and your account when signed in).', type: 'toggle', def: true },
  { key: 'repeatQuotes', cat: 'behavior', label: 'Repeat quotes', desc: 'Keep using the same quote after finishing a quote test.', type: 'toggle', def: false },
  { key: 'blindMode', cat: 'behavior', label: 'Blind mode', desc: 'Hide error colours while typing.', type: 'toggle', def: false },
  { key: 'minWpm', cat: 'behavior', label: 'Minimum WPM', desc: 'Test fails if your final WPM is lower. 0 = off.', type: 'number', def: 0, min: 0, max: 400 },
  { key: 'minAcc', cat: 'behavior', label: 'Minimum accuracy %', desc: 'Test fails if your final accuracy is lower. 0 = off.', type: 'number', def: 0, min: 0, max: 100 },
  { key: 'minBurst', cat: 'behavior', label: 'Minimum burst WPM', desc: 'Test fails if any word is typed slower than this. 0 = off.', type: 'number', def: 0, min: 0, max: 400 },
  { key: 'britishEnglish', cat: 'behavior', label: 'British English', desc: 'Use British spellings for common words.', type: 'toggle', def: false },
  { key: 'focusMode', cat: 'behavior', label: 'Focus mode', desc: 'Fade the interface away while you type.', type: 'toggle', def: true },

  { key: 'freedom', cat: 'input', label: 'Freedom mode', desc: 'Allow going back to correct words as well as incorrect ones.', type: 'toggle', def: false },
  { key: 'strictSpace', cat: 'input', label: 'Strict space', desc: 'Space is rejected (counts as an error) until the word is fully typed.', type: 'toggle', def: false },
  { key: 'stopOnError', cat: 'input', label: 'Stop on error', desc: 'Off: keep going. Word: cannot leave a wrong word. Letter: wrong letters are not accepted.', type: 'select', def: 'off', options: sel('off', 'word', 'letter') },
  { key: 'confidence', cat: 'input', label: 'Confidence mode', desc: 'On: cannot go back to previous words. Max: no backspace at all.', type: 'select', def: 'off', options: sel('off', 'on', 'max') },
  { key: 'quickEnd', cat: 'input', label: 'Quick end', desc: 'Words/quote tests end as soon as the last letter is typed, even if wrong.', type: 'toggle', def: false },
  { key: 'indicateTypos', cat: 'input', label: 'Indicate typos', desc: 'Show what you typed under (or instead of) a wrong letter.', type: 'select', def: 'off', options: sel('off', 'below', 'replace') },
  { key: 'hideExtra', cat: 'input', label: 'Hide extra letters', desc: 'Do not display letters typed beyond the end of a word.', type: 'toggle', def: false },
  { key: 'lazyMode', cat: 'input', label: 'Lazy mode', desc: 'Accept plain letters for accented ones (e → é).', type: 'toggle', def: false },
  { key: 'layout', cat: 'input', label: 'Keyboard layout', desc: 'Used for the on-screen keymap and the Learn mode keyboard.', type: 'select', def: 'qwerty', options: sel(['qwerty', 'QWERTY'], ['dvorak', 'Dvorak'], ['colemak', 'Colemak']) },

  { key: 'soundOn', cat: 'sound', label: 'Sounds', desc: 'Master switch for all sound effects.', type: 'toggle', def: false },
  { key: 'clickSound', cat: 'sound', label: 'Click sound', desc: 'Sound played on each key.', type: 'select', def: 'click', options: sel(['off', 'Off'], ['click', 'Click'], ['beep', 'Beep'], ['pop', 'Pop'], ['thock', 'Thock']) },
  { key: 'errorSound', cat: 'sound', label: 'Error sound', desc: 'Play a low buzz on mistakes.', type: 'toggle', def: true },
  { key: 'timerWarn', cat: 'sound', label: 'Timer warning', desc: 'Tick during the last 5 seconds of a timed test.', type: 'toggle', def: true },
  { key: 'volume', cat: 'sound', label: 'Volume', desc: '', type: 'range', def: 0.5, min: 0, max: 1, step: 0.05 },
  { key: '_preview', cat: 'sound', label: 'Preview', desc: 'Play the selected sounds.', type: 'button' },

  { key: 'caretStyle', cat: 'caret', label: 'Caret style', desc: '', type: 'select', def: 'line', options: sel('line', 'block', 'underline', 'outline') },
  { key: 'smoothCaret', cat: 'caret', label: 'Smooth caret', desc: 'Animate the caret between letters.', type: 'toggle', def: true },
  { key: 'caretBlink', cat: 'caret', label: 'Caret blink', desc: 'Blink the caret while idle.', type: 'toggle', def: false },

  { key: 'font', cat: 'appearance', label: 'Typing font', desc: '', type: 'select', def: 'JetBrains Mono', options: sel('JetBrains Mono', 'Fira Code', 'Space Mono', 'monospace') },
  { key: 'fontSize', cat: 'appearance', label: 'Font size', desc: 'Size of the typing text in pixels.', type: 'range', def: 26, min: 14, max: 44, step: 1 },
  { key: 'width', cat: 'appearance', label: 'Typing area width', desc: '', type: 'select', def: 'normal', options: sel('narrow', 'normal', 'wide', 'full') },
  { key: 'lines', cat: 'appearance', label: 'Visible lines', desc: 'How many lines of words show at once.', type: 'select', def: '3', options: sel('2', '3', '4') },
  { key: 'timerStyle', cat: 'appearance', label: 'Timer style', desc: '', type: 'select', def: 'text', options: sel('text', 'bar', 'both', 'none') },
  { key: 'showWpm', cat: 'appearance', label: 'Live WPM', desc: '', type: 'toggle', def: true },
  { key: 'showAcc', cat: 'appearance', label: 'Live accuracy', desc: '', type: 'toggle', def: true },
  { key: 'showBurst', cat: 'appearance', label: 'Live burst', desc: 'Show the speed of your last word.', type: 'toggle', def: false },
  { key: 'showErrors', cat: 'appearance', label: 'Live error count', desc: '', type: 'toggle', def: false },
  { key: 'showProgress', cat: 'appearance', label: 'Live word progress', desc: 'Words completed (and total for word tests).', type: 'toggle', def: false },
  { key: 'highlight', cat: 'appearance', label: 'Highlight', desc: '', type: 'select', def: 'letter', options: sel('letter', 'word') },
  { key: 'decimals', cat: 'appearance', label: 'Decimal places', desc: 'Used for results.', type: 'select', def: '0', options: sel('0', '1', '2') },
  { key: 'speedUnit', cat: 'appearance', label: 'Speed unit', desc: 'Words, characters or words per second.', type: 'select', def: 'wpm', options: sel(['wpm', 'WPM'], ['cpm', 'CPM'], ['wps', 'WPS']) },
  { key: 'showCharts', cat: 'appearance', label: 'Result charts', desc: '', type: 'toggle', def: true },
  { key: 'keymap', cat: 'appearance', label: 'Keymap display', desc: 'Show a keyboard under the text with the next key highlighted.', type: 'toggle', def: false },
  { key: 'bgUrl', cat: 'appearance', label: 'Custom background (image URL)', desc: 'Leave empty for none.', type: 'text', def: '' },
  { key: 'bgOpacity', cat: 'appearance', label: 'Background opacity', desc: '', type: 'range', def: 0.3, min: 0.05, max: 1, step: 0.05 },
  { key: 'bgBlur', cat: 'appearance', label: 'Background blur', desc: '', type: 'range', def: 0, min: 0, max: 20, step: 1 },
  { key: 'reduceMotion', cat: 'appearance', label: 'Reduce motion', desc: 'Turn off animations (also follows your system setting).', type: 'toggle', def: false },

  { key: 'visualStyle', cat: 'theme', label: 'Interface style', desc: 'Choose the visual design of Typing Panda. Glass is the new colorful default; Classic keeps the original interface.', type: 'select', def: 'glass', options: sel(['glass', 'Colorful Glassmorphism'], ['classic', 'Classic Typing Panda']) },
  { key: 'theme', cat: 'theme', label: 'Theme', desc: 'Panda Night (Deep Navy), Panda Light (Off White), Electric (Electric Blue), Auto follows your system, Random picks one per visit.', type: 'select', def: 'dark', options: sel(['dark', 'Panda Night'], ['light', 'Panda Light'], ['electric', 'Electric'], ['auto', 'Auto (system)'], ['random', 'Random'], ['custom', 'Custom colours']) },
  { key: 'cBg', cat: 'theme', label: 'Custom: background', desc: '', type: 'color', def: '#050D2E' },
  { key: 'cText', cat: 'theme', label: 'Custom: text', desc: '', type: 'color', def: '#FFFFFF' },
  { key: 'cSub', cat: 'theme', label: 'Custom: untyped text', desc: '', type: 'color', def: '#8F9CD6' },
  { key: 'cMain', cat: 'theme', label: 'Custom: accent & caret', desc: '', type: 'color', def: '#C6FF00' },
  { key: 'cErr', cat: 'theme', label: 'Custom: errors', desc: '', type: 'color', def: '#FF5C7A' },
  { key: '_resetTheme', cat: 'theme', label: 'Reset theme', desc: 'Restore the default Panda Night colours.', type: 'button' },

  { key: 'hideTips', cat: 'hide', label: 'Hide tips', desc: '', type: 'toggle', def: false },
  { key: 'hideLive', cat: 'hide', label: 'Hide live statistics', desc: '', type: 'toggle', def: false },
  { key: 'hideNotif', cat: 'hide', label: 'Hide notification bell', desc: '', type: 'toggle', def: false },
  { key: 'hideOutOfFocus', cat: 'hide', label: 'Hide out-of-focus message', desc: '', type: 'toggle', def: false },
  { key: 'hideCaps', cat: 'hide', label: 'Hide Caps Lock warning', desc: '', type: 'toggle', def: false },
  { key: 'hideAverage', cat: 'hide', label: 'Hide averages in results', desc: '', type: 'toggle', def: false }
];

// Test configuration lives in the same object (not shown on the settings page).
const TEST_DEFAULTS = { mode: 'time', time: 30, words: 25, quoteLen: 'all', quoteFav: false, quoteId: '', customText: '', customLimit: 'text', customLimitValue: 50, funbox: 'none' };

export const DEFAULTS = { ...TEST_DEFAULTS };
for (const s of SCHEMA) if (!s.key.startsWith('_')) DEFAULTS[s.key] = s.def;

export const settings = { ...DEFAULTS, ...store.get('settings', {}) };
const listeners = new Set();
let syncHook = null;
export const onSettings = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const setSyncHook = fn => { syncHook = fn; };

export function setSetting(key, value) {
  settings[key] = value;
  persist(); applySettings();
  listeners.forEach(fn => fn(key, value));
}
export function setMany(obj) {
  Object.assign(settings, obj);
  persist(); applySettings();
  listeners.forEach(fn => fn('*', obj));
}
function persist() { store.set('settings', settings); syncHook && syncHook(); }

export function resetSettings() {
  for (const k of Object.keys(DEFAULTS)) settings[k] = DEFAULTS[k];
  persist(); applySettings(); listeners.forEach(fn => fn('*'));
}
export function resetTheme() { setMany({ theme: 'dark', cBg: '#050D2E', cText: '#FFFFFF', cSub: '#8F9CD6', cMain: '#C6FF00', cErr: '#FF5C7A' }); }
export const exportSettings = () => JSON.stringify({ app: 'typing-panda', version: 1, settings }, null, 2);
export function importSettings(text) {
  const data = JSON.parse(text);
  const src = data.settings || data;
  const clean = {};
  for (const k of Object.keys(DEFAULTS)) if (k in src && typeof src[k] === typeof DEFAULTS[k]) clean[k] = src[k];
  if (!Object.keys(clean).length) throw new Error('No valid settings found');
  setMany(clean);
}

let randomPick = null;
export function resolveTheme() {
  const t = settings.theme;
  if (t === 'auto') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  if (t === 'random') { randomPick = randomPick || ['dark', 'light', 'electric'][Math.floor(Math.random() * 3)]; return randomPick; }
  return t;
}

export function applySettings() {
  const r = document.documentElement, s = settings;
  const theme = resolveTheme();
  r.dataset.uiStyle = s.visualStyle || 'glass';
  r.dataset.theme = theme === 'custom' ? 'dark' : theme;
  const custom = ['--bg', '--text', '--sub', '--main', '--caret', '--err'];
  if (theme === 'custom') {
    r.style.setProperty('--bg', s.cBg); r.style.setProperty('--text', s.cText); r.style.setProperty('--sub', s.cSub);
    r.style.setProperty('--main', s.cMain); r.style.setProperty('--caret', s.cMain); r.style.setProperty('--err', s.cErr);
    document.body.style.backgroundImage = 'none';
  } else { custom.forEach(p => r.style.removeProperty(p)); document.body.style.backgroundImage = ''; }
  r.style.setProperty('--fs', s.fontSize + 'px');
  r.style.setProperty('--font-mono', `'${s.font}', ui-monospace, Menlo, Consolas, monospace`);
  r.style.setProperty('--tw', { narrow: '760px', normal: '1000px', wide: '1240px', full: '96vw' }[s.width]);
  r.style.setProperty('--lines', s.lines);
  const b = document.body.classList;
  b.toggle('hide-ooF', !!s.hideOutOfFocus);
  b.toggle('reduce-motion', !!s.reduceMotion);
  if (s.bgUrl) {
    b.add('has-bg');
    r.style.setProperty('--bgimg', `url("${s.bgUrl.replace(/"/g, '%22')}")`);
    r.style.setProperty('--bgop', s.bgOpacity); r.style.setProperty('--bgblur', s.bgBlur + 'px');
  } else b.remove('has-bg');
}

export function formatSpeed(wpm, d = +settings.decimals) {
  const v = settings.speedUnit === 'cpm' ? wpm * 5 : settings.speedUnit === 'wps' ? wpm / 12 : wpm;
  return v.toFixed(settings.speedUnit === 'wps' ? Math.max(d, 1) : d);
}
export const unitLabel = () => settings.speedUnit.toUpperCase();

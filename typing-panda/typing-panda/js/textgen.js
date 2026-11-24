// Builds the list of target words for a test from the current settings.
import { WORDSETS, QUOTES, quoteLen, BRITISH, MORSE } from './data.js';
import { settings } from './settings.js';
import { store } from './util.js';

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
export const getWordset = id => WORDSETS.find(w => w.id === id) || WORDSETS[0];
export const isCode = () => getWordset(settings.wordset).lang === 'Code';

export function getFavs() { return store.get('favQuotes', []); }
export function toggleFav(id) {
  const f = getFavs(), i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  store.set('favQuotes', f); return i < 0;
}
export const allQuotes = () => [...QUOTES, ...store.get('extraQuotes', [])];

function baseWords(n) {
  const set = getWordset(settings.wordset).words, out = [];
  while (out.length < n) {
    const w = pick(set);
    if (out.length && out[out.length - 1] === w && set.length > 1) continue;
    out.push(w);
  }
  return out;
}

function addPunctuation(words) {
  let cap = true;
  return words.map((w, i) => {
    let x = w;
    if (cap) { x = x[0].toUpperCase() + x.slice(1); cap = false; }
    const r = Math.random();
    if (r < 0.09) { x += pick(['.', '.', '.', '?', '!']); cap = true; }
    else if (r < 0.17) x += ',';
    else if (r < 0.19) x += ';';
    else if (r < 0.21) x += ':';
    else if (r < 0.24) x = '"' + x + '"';
    else if (r < 0.26) x = '(' + x + ')';
    else if (r < 0.28 && i > 0) x = x + "'s";
    return x;
  });
}
function addNumbers(words) {
  return words.map(w => (Math.random() < 0.12 ? String(rnd(Math.random() < 0.5 ? 100 : 10000)) : w));
}
function british(words) { return words.map(w => BRITISH[w] || w); }

function weakWords(n) {
  const cs = store.get('charStats', {});
  const weak = Object.entries(cs).filter(([, v]) => v.h + v.m >= 5).map(([c, v]) => [c, v.m / (v.h + v.m)]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  const all = getWordset('common').words.concat(getWordset('advanced').words);
  if (!weak.length) return baseWords(n);
  const pool = all.filter(w => weak.some(c => w.includes(c)));
  const out = [];
  while (out.length < n) out.push(pick(pool.length ? pool : all));
  return out;
}

function funboxTransform(words, n, id) {
  const hex = len => Array.from({ length: len }, () => rnd(16).toString(16)).join('');
  switch (id) {
    case 'allcaps': return words.map(w => w.toUpperCase());
    case 'sponge': return words.map(w => [...w].map(c => (Math.random() < 0.5 ? c.toUpperCase() : c.toLowerCase())).join(''));
    case 'reversed': return words.map(w => [...w].reverse().join(''));
    case 'doubled': return words.map(w => [...w].map(c => c + c).join(''));
    case 'numbers': return Array.from({ length: n }, () => String(rnd(10 ** (2 + rnd(4)))));
    case 'binary': return Array.from({ length: n }, () => Array.from({ length: 8 }, () => rnd(2)).join(''));
    case 'hex': return Array.from({ length: n }, () => hex(2 + rnd(5)));
    case 'ipv4': return Array.from({ length: n }, () => [rnd(256), rnd(256), rnd(256), rnd(256)].join('.'));
    case 'ipv6': return Array.from({ length: n }, () => Array.from({ length: 8 }, () => hex(1 + rnd(4))).join(':'));
    case 'morse': return words.map(w => [...w.toLowerCase()].map(c => MORSE[c] || '').join('/') || '.');
    case 'special': return words.map(w => pick(['#', '@', '$', '%', '&', '*', '!', '^', '~']) + w + pick(['#', '@', '$', '%', '&', '*', '!', '^', '~']));
    case 'weakspots': return weakWords(n);
    default: return words;
  }
}

// n words for time-mode chunks and word-count tests
export function generateWords(n) {
  let words = settings.funbox === 'weakspots' ? weakWords(n) : baseWords(n);
  const code = isCode();
  if (!code) {
    if (settings.britishEnglish) words = british(words);
    if (settings.numbers) words = addNumbers(words);
    if (settings.punctuation) words = addPunctuation(words);
  } else if (settings.numbers) words = addNumbers(words);
  return funboxTransform(words, n, settings.funbox);
}

export function chooseQuote() {
  let q = null;
  if (settings.quoteId) q = allQuotes().find(x => x.id === settings.quoteId);
  if (!q) {
    let pool = allQuotes().filter(x => x.approvalStatus === 'approved');
    if (settings.quoteLen !== 'all') pool = pool.filter(x => quoteLen(x) === settings.quoteLen);
    if (settings.quoteFav) pool = pool.filter(x => getFavs().includes(x.id));
    if (!pool.length) return null;
    q = pick(pool);
  }
  return q;
}

// Returns { words, quote, limitMs, zen, label }
export function buildTest() {
  const s = settings;
  if (s.mode === 'time') return { words: generateWords(100), limitMs: s.time * 1000, zen: false, modeValue: s.time };
  if (s.mode === 'words') return { words: generateWords(s.words), limitMs: null, zen: false, modeValue: s.words };
  if (s.mode === 'zen') return { words: [], limitMs: null, zen: true, modeValue: 0 };
  if (s.mode === 'quote') {
    const q = chooseQuote();
    if (!q) return { words: [], limitMs: null, zen: false, noQuote: true, modeValue: 0 };
    return { words: q.text.split(/\s+/), quote: q, limitMs: null, zen: false, modeValue: s.quoteLen };
  }
  // custom
  const base = (s.customText || '').split(/\s+/).filter(Boolean);
  if (!base.length) return { words: [], limitMs: null, zen: false, noCustom: true, modeValue: 0 };
  if (s.customLimit === 'text') return { words: base, limitMs: null, zen: false, modeValue: base.length };
  if (s.customLimit === 'words') return { words: Array.from({ length: s.customLimitValue }, (_, i) => base[i % base.length]), limitMs: null, zen: false, modeValue: s.customLimitValue };
  const words = []; while (words.length < 120) words.push(...base);
  return { words, base, limitMs: s.customLimitValue * 1000, zen: false, modeValue: s.customLimitValue };
}

export function moreWords() {
  if (settings.mode === 'custom') return (settings.customText || '').split(/\s+/).filter(Boolean);
  return generateWords(60);
}

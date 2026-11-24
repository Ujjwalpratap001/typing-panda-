// On-screen keyboard with finger colours and next-key highlight. Used by the test page and Learn mode.
import { h } from './util.js';

export const LAYOUTS = {
  qwerty: ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'],
  dvorak: ['1234567890[]', "',.pyfgcrl/=", 'aoeuidhtns-', ';qjkxbmwvz'],
  colemak: ['1234567890-=', 'qwfpgjluy;[]', "arstdhneio'", 'zxcvbkm,./']
};
const COL_FINGER = [0, 1, 2, 3, 3, 6, 6, 7, 8, 9, 9, 9];
export const FINGER_NAMES = { 0: 'left pinky', 1: 'left ring', 2: 'left middle', 3: 'left index', 6: 'right index', 7: 'right middle', 8: 'right ring', 9: 'right pinky', 10: 'thumb' };
const SHIFTED = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`', '|': '\\' };

export function keyInfo(ch, layout = 'qwerty') {
  if (ch === ' ') return { key: ' ', finger: 10, shift: false };
  let key = ch, shift = false;
  if (SHIFTED[ch]) { key = SHIFTED[ch]; shift = true; }
  else if (ch.toLowerCase() !== ch) { key = ch.toLowerCase(); shift = true; }
  const rows = LAYOUTS[layout] || LAYOUTS.qwerty;
  for (const r of rows) { const i = r.indexOf(key); if (i >= 0) return { key, finger: COL_FINGER[i], shift }; }
  return { key, finger: null, shift };
}

export function makeKeymap(layout = 'qwerty') {
  const rows = LAYOUTS[layout] || LAYOUTS.qwerty;
  const el = h('div', { class: 'keymap', 'aria-hidden': 'true' });
  const keys = {};
  rows.forEach((r, ri) => {
    const row = h('div', { class: 'krow' });
    if (ri === 3) row.append(keys.shiftL = h('div', { class: 'key wide' }, 'Shift'));
    [...r].forEach((c, i) => { const k = h('div', { class: 'key f-' + COL_FINGER[i], 'data-k': c }, c); keys[c] = k; row.append(k); });
    if (ri === 3) row.append(keys.shiftR = h('div', { class: 'key wide' }, 'Shift'));
    el.append(row);
  });
  el.append(h('div', { class: 'krow' }, keys[' '] = h('div', { class: 'key space f-10' }, '')));
  let last = [];
  function highlight(ch) {
    last.forEach(k => k.classList.remove('target')); last = [];
    if (!ch) return;
    const info = keyInfo(ch, layout), k = keys[info.key];
    if (k) { k.classList.add('target'); last.push(k); }
    if (info.shift) { const s = info.finger != null && info.finger < 5 ? keys.shiftR : keys.shiftL; s.classList.add('target'); last.push(s); }
  }
  return { el, highlight };
}

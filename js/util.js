// Small helpers used everywhere: DOM builder, storage, toast, modal.
// Native append() turns null/false/arrays into text ("false", "[object HTMLDivElement]").
// This makes append() skip empty values and accept nested arrays, like h() does.
for (const P of [Element.prototype, DocumentFragment.prototype]) {
  const native = P.append;
  P.append = function (...kids) { native.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false)); };
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// h('div', {class:'x', onClick: fn}, child, child...)
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return e;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const store = {
  get(k, d) { try { const v = localStorage.getItem('panda.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('panda.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('panda.' + k); } catch { /* ignore */ } },
  keys() { try { return Object.keys(localStorage).filter(k => k.startsWith('panda.')); } catch { return []; } }
};

export function toast(msg, type = 'ok') {
  const box = $('#toasts');
  if (!box) return;
  const t = h('div', { class: 'toast ' + (type === 'err' ? 'err' : ''), role: 'status' }, msg);
  box.append(t);
  setTimeout(() => t.remove(), type === 'err' ? 5000 : 2800);
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '0');
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const dayKey = (d = new Date()) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
export const fmtDate = d => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const modalState = { open: 0 };

// Accessible modal: Esc closes, click outside closes, focus is trapped and restored.
export function openModal({ title, content, actions = [], wide = false, onClose }) {
  const prev = document.activeElement;
  const overlay = h('div', { class: 'overlay' });
  const body = h('div', { class: 'modal-body' });
  if (typeof content === 'string') body.innerHTML = content; else if (content) body.append(content);
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: () => close() }, '✕')),
    body);
  if (actions.length) {
    box.append(h('div', { class: 'modal-foot' }, actions.map(a => h('button', {
      class: 'btn ' + (a.kind || ''),
      onClick: async () => { const r = a.onClick ? await a.onClick(box) : undefined; if (a.close !== false && r !== false) close(); }
    }, a.label))));
  }
  overlay.append(box);
  $('#modal-root').append(overlay);
  modalState.open++;
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove(); modalState.open--;
    if (prev && prev.focus) try { prev.focus(); } catch { /* ignore */ }
    onClose && onClose();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  setTimeout(() => { const f = box.querySelector('input, textarea, select') || box; f.focus(); }, 30);
  return { close, body, box };
}

export function confirmModal(title, message, okLabel = 'Confirm', danger = true) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, content: h('p', {}, message),
      onClose: () => { if (!done) res(false); },
      actions: [
        { label: 'Cancel', kind: '' },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } }
      ]
    });
  });
}

export function promptModal(title, label, value = '', { multiline = false, validate, okLabel = 'Save' } = {}) {
  return new Promise(res => {
    let done = false;
    const input = multiline ? h('textarea', {}, value) : h('input', { type: 'text', value });
    const err = h('div', { class: 'field-err' });
    const content = h('div', {}, h('label', { class: 'f' }, label), input, err);
    openModal({
      title, content, onClose: () => { if (!done) res(null); },
      actions: [
        { label: 'Cancel', kind: '' },
        { label: okLabel, kind: 'primary', onClick: () => {
          const v = input.value.trim();
          const m = validate ? validate(v) : null;
          if (m) { err.textContent = m; return false; }
          done = true; res(v);
        } }
      ]
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); [...input.closest('.modal').querySelectorAll('.modal-foot .btn')].pop().click(); } });
  });
}

export function download(name, text, type = 'text/plain') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard'); }
  catch { toast('Copy failed — select and copy manually', 'err'); }
}

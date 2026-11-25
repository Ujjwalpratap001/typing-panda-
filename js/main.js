// App shell: header, footer, global shortcuts, cloud wiring.
import { $, h, store, toast, debounce, modalState } from './util.js';
import { settings, setSetting, applySettings, onSettings } from './settings.js';
import { resolve, navigate } from './router.js';
import { cloud } from './backend.js';
import { levelInfo, flushPending } from './results.js';
import { getLocalNotifs, notifBus, seedWelcome } from './notify.js';
import { pullAndMerge, stopSync } from './sync.js';
import { openPalette } from './commands.js';
import * as M from './modals.js';
import { site } from './site-config.js';

applySettings();
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => settings.theme === 'auto' && applySettings());
seedWelcome();

let cloudUnread = 0, currentId = 'practice';
const initials = () => ((cloud.profile && cloud.profile.username) || (cloud.user && (cloud.user.displayName || cloud.user.email)) || '?')[0].toUpperCase();

function renderHeader() {
  const hd = $('#header'), open = hd.classList.contains('nav-open');
  hd.innerHTML = '';
  const lv = levelInfo(), unread = getLocalNotifs().filter(n => !n.isRead).length + cloudUnread;
  const link = (href, text, id) => h('a', { href: '#' + href, class: currentId === id ? 'active' : '', 'aria-current': currentId === id ? 'page' : null, onClick: () => hd.classList.remove('nav-open') }, text);
  const menu = h('div', { style: 'position:relative' });
  if (cloud.user) {
    const btn = h('button', { class: 'icon-btn', 'aria-label': 'Account menu', 'aria-haspopup': 'true', style: 'width:auto;padding:0 .2rem', onClick: e => { e.stopPropagation(); toggle(); } }, h('span', { class: 'avatar' }, initials()));
    menu.append(btn);
    const toggle = () => {
      const ex = menu.querySelector('.popover'); if (ex) return ex.remove();
      const p = h('div', { class: 'popover' }, h('div', { class: 'who' }, cloud.profile ? '@' + cloud.profile.username : cloud.user.email),
        h('a', { href: '#/account' }, 'Account'), h('a', { href: '#/friends' }, 'Friends'), h('a', { href: cloud.profile ? '#/profile/' + cloud.profile.username : '#/profile' }, 'Public profile'), h('a', { href: '#/account-settings' }, 'Account settings'),
        h('button', { onClick: () => cloud.signOut().then(() => { stopSync(); toast('Signed out'); navigate('/'); }) }, 'Sign out'));
      menu.append(p);
      setTimeout(() => document.addEventListener('click', function f(ev) { if (!menu.contains(ev.target) || ev.target.closest('a,button')) { p.remove(); document.removeEventListener('click', f); } }), 0);
    };
  } else menu.append(h('a', { href: '#/login', class: 'btn primary sm' }, 'Login'));
  hd.append(h('div', { class: 'wrap nav' },
    h('a', { href: '#/', class: 'brand', 'aria-label': 'Typing Panda home' }, h('span', { class: 'brand-icon-ring' }, h('img', { src: 'assets/logo.svg', alt: '' })), h('span', { class: 'brand-wordmark' }, 'Typing ', h('b', {}, 'Panda'))),
    h('nav', { class: 'nav-links', 'aria-label': 'Main' }, link('/', 'Practice', 'practice'), link('/learn', 'Learn', 'learn'), link('/leaderboards', 'Leaderboards', 'leaderboards'), link('/about', 'About', 'about')),
    h('div', { class: 'nav-end' },
      h('a', { href: '#/account', class: 'lvl', style: 'text-decoration:none', title: `${lv.xp} XP — ${lv.pct}% to next level` }, 'Lv ' + lv.level),
      h('button', { class: 'icon-btn', 'aria-label': 'Command palette (Ctrl+K)', title: 'Commands (Ctrl+K)', onClick: openPalette }, '⌘'),
      h('a', { href: '#/settings', class: 'icon-btn', 'aria-label': 'Settings', title: 'Settings' }, '⚙'),
      !settings.hideNotif && h('button', { class: 'icon-btn', 'aria-label': `Notifications, ${unread} unread`, onClick: () => M.notificationsModal(refreshUnread) }, '🔔', unread > 0 && h('span', { class: 'badge' }, unread > 9 ? '9+' : unread)),
      menu,
      h('button', { class: 'icon-btn menu-toggle', 'aria-label': 'Toggle menu', onClick: () => hd.classList.toggle('nav-open') }, '☰'))));
  if (open) hd.classList.add('nav-open');
}

function renderFooter() {
  $('#footer').append(h('div', { class: 'wrap row spread' },
    h('div', {}, h('b', { style: 'color:#fff;font-family:var(--font-head)' }, 'Typing Panda'), ' — Practice. Improve. Type Faster.'),
    h('div', {}, h('a', { href: 'terms-of-service.html' }, 'Terms'), h('a', { href: 'privacy-policy.html' }, 'Privacy'), h('a', { href: 'security-policy.html' }, 'Security'),
      h('a', { href: '#', onClick: e => { e.preventDefault(); M.shortcutsModal(); } }, 'Shortcuts'), h('a', { href: '#', onClick: e => { e.preventDefault(); M.contactModal(); } }, 'Contact'),
      h('a', { href: '#', onClick: e => { e.preventDefault(); M.cookieModal(); } }, 'Cookies'), h('a', { href: '#', onClick: e => { e.preventDefault(); M.versionModal(); } }, 'v' + site.version))));
}

function cookieBar() {
  if (store.get('cookieAck')) return;
  const bar = h('div', { class: 'cookie-bar', role: 'region', 'aria-label': 'Storage notice' }, h('span', {}, 'This site stores your settings and results in your browser. No ads or tracking cookies.'),
    h('button', { class: 'btn sm', onClick: () => M.cookieModal() }, 'Details'), h('button', { class: 'btn sm primary', onClick: () => { store.set('cookieAck', true); bar.remove(); } }, 'OK'));
  document.body.append(bar);
}

const refreshUnread = async () => {
  if (cloud.user) { try { cloudUnread = (await cloud.getNotifications()).filter(n => !n.isRead).length; } catch { cloudUnread = 0; } } else cloudUnread = 0;
  renderHeader();
};
notifBus.addEventListener('change', renderHeader);
onSettings(k => { if (k === 'hideNotif' || k === '*') renderHeader(); });
document.addEventListener('route', e => { currentId = e.detail.id; renderHeader(); $('#header').classList.remove('nav-open'); });

// Global shortcuts. They never run while a test is actively being typed.
document.addEventListener('keydown', e => {
  const typing = document.body.classList.contains('typing-active');
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || (e.shiftKey && e.key.toLowerCase() === 'p'))) { e.preventDefault(); if (!typing && !modalState.open) openPalette(); return; }
  if (typing || modalState.open) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setSetting('punctuation', !settings.punctuation); }
  else if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setSetting('numbers', !settings.numbers); }
  else if (e.key === '?' && tag !== 'input' && tag !== 'textarea') { M.shortcutsModal(); }
  else if (e.key === 'Escape' && settings.quickRestart !== 'esc' && location.hash.length <= 2) { openPalette(); }
});

// cloud wiring
let lastUid = null;
cloud.onChange(async () => {
  renderHeader();
  if (cloud.user && cloud.user.uid !== lastUid) {
    lastUid = cloud.user.uid;
    if (cloud.profile) { await pullAndMerge(); flushPending(); try { await cloud.loadApprovedQuotes(); } catch { /* optional */ } refreshUnread(); }
    else if (!location.hash.startsWith('#/login')) M.profileSetupModal();
  } else if (!cloud.user) { lastUid = null; cloudUnread = 0; renderHeader(); }
  else if (cloud.profile && !store.get('profileDone:' + cloud.user.uid)) { store.set('profileDone:' + cloud.user.uid, true); await pullAndMerge(); flushPending(); }
});
window.addEventListener('online', () => flushPending());
setInterval(() => { if (cloud.user) refreshUnread(); }, 120000);

renderHeader(); renderFooter(); cookieBar();
resolve();

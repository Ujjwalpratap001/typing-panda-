import { h, toast, copyText, debounce, dayKey, fmt, fmtDate } from '../util.js';
import { cloud, validUsername } from '../backend.js';
import { navigate } from '../router.js';
import { notConfigured } from './login.js';
import { computeStats } from '../results.js';
import { formatSpeed, unitLabel } from '../settings.js';
import { reportModal } from '../modals.js';
import { confirmModal } from '../util.js';

const safeLink = (kind, v) => !v ? null : kind === 'github' ? 'https://github.com/' + encodeURIComponent(v) : kind === 'twitter' ? 'https://x.com/' + encodeURIComponent(v) : /^https:\/\//i.test(v) ? v : null;

export async function render(root, params) {
  const wrap = h('div', { class: 'wrap pad' });
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, params[0] ? '@' + params[0] : 'Find a profile'))), wrap);
  if (!cloud.enabled) return wrap.append(notConfigured());
  wrap.append(h('div', { class: 'spinner' })); await cloud.ready; wrap.innerHTML = '';
  if (!cloud.enabled) return wrap.append(notConfigured());
  return params[0] ? profile(wrap, params[0]) : search(wrap);
}

function search(wrap) {
  const out = h('div', { style: 'margin-top:1rem' }), input = h('input', { type: 'search', placeholder: 'Search by username…', 'aria-label': 'Username', autofocus: true });
  const run = debounce(async () => {
    const v = input.value.trim(); out.innerHTML = '';
    if (!v) return;
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return out.append(h('p', { class: 'field-err' }, 'Usernames only use letters, numbers and underscores.'));
    out.append(h('div', { class: 'spinner' }));
    try { const r = await cloud.searchUsers(v); out.innerHTML = ''; if (!r.length) return out.append(h('div', { class: 'card empty' }, h('h3', {}, 'No profile found'), h('p', {}, `Nobody matches “${v}”.`))); r.forEach(u => out.append(h('a', { href: '#/profile/' + u.username, class: 'card', style: 'display:flex;gap:1rem;align-items:center;margin-bottom:.6rem;text-decoration:none;color:inherit' }, h('span', { class: 'avatar' }, u.username[0].toUpperCase()), h('div', {}, h('b', {}, u.displayName || u.username), h('div', { class: 'muted' }, '@' + u.username))))); }
    catch (e) { out.innerHTML = ''; out.append(h('p', { class: 'field-err' }, cloud.errText(e))); }
  }, 350);
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && validUsername(input.value.trim())) navigate('/profile/' + input.value.trim()); });
  wrap.append(h('div', { style: 'max-width:560px' }, input, out));
}

async function profile(wrap, name) {
  wrap.append(h('div', { class: 'spinner' }));
  let u;
  try { u = await cloud.getPublicProfile(name); } catch (e) { wrap.innerHTML = ''; return wrap.append(h('div', { class: 'card empty' }, h('h3', {}, 'Could not load profile'), h('p', {}, cloud.errText(e)))); }
  wrap.innerHTML = '';
  if (!u) return wrap.append(h('div', { class: 'card empty' }, h('h3', {}, 'User not found'), h('p', {}, `There is no @${name}.`), h('a', { class: 'btn primary', href: '#/profile' }, 'Search again')));
  const me = cloud.user && cloud.user.uid === u.uid;
  if (!u.publicProfile && !me) return wrap.append(h('div', { class: 'card empty' }, h('span', { class: 'avatar lg' }, u.username[0].toUpperCase()), h('h3', {}, '@' + u.username), h('p', {}, 'This profile is private.')));
  const d = u.details || {}, soc = d.social || {};
  let rel = null;
  if (cloud.user && !me) { try { const f = await cloud.getFriends(); rel = [...f.friends, ...f.incoming, ...f.outgoing, ...f.blocked].find(x => x.uid === u.uid) || null; } catch { /* ignore */ } }
  const actions = h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => copyText(location.origin + location.pathname + '#/profile/' + u.username) }, 'Copy profile link'));
  if (!cloud.user) actions.append(h('a', { class: 'btn sm primary', href: '#/login' }, 'Sign in to add friend'));
  else if (!me) {
    if (!rel) actions.append(h('button', { class: 'btn sm primary', onClick: async () => { try { await cloud.sendFriendRequest(u.username); toast('Friend request sent'); navigate('/profile/' + u.username); } catch (e) { toast(cloud.errText(e), 'err'); } } }, 'Add friend'));
    else if (rel.status === 'accepted') actions.append(h('button', { class: 'btn sm', onClick: async () => { if (await confirmModal('Remove friend?', `Remove @${u.username} from your friends?`, 'Remove')) { await cloud.removeConnection(rel.connectionId); toast('Friend removed'); navigate('/profile/' + u.username); } } }, 'Remove friend'));
    else if (rel.status === 'pending') actions.append(h('a', { class: 'btn sm', href: '#/friends' }, 'Request pending'));
    actions.append(h('button', { class: 'btn sm danger', onClick: () => reportModal('user', u.uid, 'Report @' + u.username) }, 'Report user'));
  } else actions.append(h('a', { class: 'btn sm primary', href: '#/account-settings' }, 'Edit profile'));
  const links = [['github', 'GitHub'], ['twitter', 'X'], ['website', 'Website']].map(([k, t]) => { const l = safeLink(k, soc[k]); return l && h('a', { href: l, target: '_blank', rel: 'noopener noreferrer' }, t); }).filter(Boolean);
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start;gap:1.2rem' }, h('span', { class: 'avatar lg' }, u.username[0].toUpperCase()), h('div', { style: 'flex:1' }, h('h2', { style: 'margin:0' }, u.displayName || u.username), h('div', { class: 'muted' }, `@${u.username} · joined ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}`), d.bio && h('p', { style: 'margin:.6rem 0' }, d.bio), d.keyboard && h('p', { class: 'muted' }, '⌨ ' + d.keyboard), links.length > 0 && h('div', { class: 'row' }, links), h('div', { style: 'margin-top:.8rem' }, actions)))));
  const stats = h('div', { style: 'margin-top:1rem' }, h('div', { class: 'spinner' })); wrap.append(stats);
  try {
    const res = (await cloud.getUserPublicResults(u.uid)).filter(r => !r.failed), st = computeStats(res);
    stats.innerHTML = '';
    if (!res.length) return stats.append(h('div', { class: 'card empty' }, 'No public results yet.'));
    const tile = (v, l) => h('div', { class: 'card' }, h('div', { class: 'stat-big' }, v), h('div', { class: 'stat-label' }, l));
    stats.append(h('div', { class: 'grid g4' }, tile(formatSpeed(st.bestWpm), 'best ' + unitLabel()), tile(fmt(st.bestAcc, 1) + '%', 'best accuracy'), tile(st.tests, 'public tests'), tile(fmt(st.typingTime / 60, 1) + ' min', 'typing time'), tile(st.currentStreak + ' days', 'current streak')));
    const best = {}; res.filter(r => r.validationStatus === 'valid').forEach(r => { const k = r.mode + ' ' + r.modeValue; if (!best[k] || r.wpm > best[k].wpm) best[k] = r; });
    stats.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, 'Personal bests'), h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Test', unitLabel(), 'Accuracy', 'Date'].map(x => h('th', {}, x)))), h('tbody', {}, Object.entries(best).sort((a, b) => b[1].wpm - a[1].wpm).map(([k, r]) => h('tr', {}, h('td', {}, k), h('td', {}, formatSpeed(r.wpm)), h('td', {}, r.accuracy.toFixed(1) + '%'), h('td', {}, fmtDate(r.createdAt)))))))));
    if (u.showActivity !== false) { const heat = h('div', { class: 'heat' }), now = new Date(), start = new Date(now); start.setDate(start.getDate() - 26 * 7 + 1); start.setDate(start.getDate() - start.getDay()); for (let x = new Date(start); x <= now; x.setDate(x.getDate() + 1)) { const v = st.days[dayKey(x)]; const n = v ? v.tests : 0; heat.append(h('i', { class: n ? 'l' + Math.min(4, Math.ceil(n / 2)) : '', title: `${dayKey(x)}: ${n} tests` })); } stats.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, 'Activity'), heat)); }
    try { const lb = await cloud.getLeaderboard({ period: 'alltime', mode: 'time', value: 60, language: 'english' }); const i = lb.findIndex(r => r.userId === u.uid); stats.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('b', {}, 'Leaderboard (all-time, 60s English): '), i >= 0 ? `#${i + 1} with ${formatSpeed(lb[i].wpm)} ${unitLabel()}` : 'not in the top 100')); } catch { /* optional */ }
  } catch (e) { stats.innerHTML = ''; stats.append(h('p', { class: 'field-err' }, cloud.errText(e))); }
}

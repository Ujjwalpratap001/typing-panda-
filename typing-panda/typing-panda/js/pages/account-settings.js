import { h, toast, confirmModal, promptModal, download, store } from '../util.js';
import { cloud } from '../backend.js';
import { notConfigured } from './login.js';
import { navigate } from '../router.js';

const TABS = [['account', 'Account'], ['auth', 'Authentication'], ['blocked', 'Blocked users'], ['danger', 'Danger zone']];
const NAMES = { 'google.com': 'Google', 'github.com': 'GitHub', password: 'Email & password' };

export async function render(root) {
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, 'Account settings'))));
  const wrap = h('div', { class: 'wrap pad' }); root.append(wrap);
  if (!cloud.enabled) return wrap.append(notConfigured());
  wrap.append(h('div', { class: 'spinner' })); await cloud.ready; wrap.innerHTML = '';
  if (!cloud.user || !cloud.profile) return wrap.append(h('div', { class: 'card empty' }, h('h3', {}, 'Please sign in'), h('p', {}, 'Account settings are available once you have an account.'), h('a', { class: 'btn primary', href: '#/login' }, 'Sign in')));
  let tab = 'account';
  const nav = h('div', { class: 'side-nav' }), body = h('div', { class: 'card' });
  wrap.append(h('div', { class: 'settings-layout' }, nav, body));
  const guard = async (fn, ok) => { try { await fn(); ok && toast(ok); } catch (e) { toast(cloud.errText(e), 'err'); } };
  const sw = (label, val, on) => h('div', { class: 'set-row' }, h('div', {}, h('h4', {}, label)), h('div', { class: 'ctl' }, h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: val, 'aria-label': label, onChange: e => on(e.target.checked) }), h('i'))));

  function draw() {
    nav.innerHTML = ''; TABS.forEach(([id, t]) => nav.append(h('button', { class: tab === id ? 'on' : '', onClick: () => { tab = id; draw(); } }, t)));
    body.innerHTML = '';
    const p = cloud.profile, d = cloud.details || {}, soc = d.social || {};
    if (tab === 'account') {
      let state = { publicProfile: p.publicProfile !== false, showActivity: p.showActivity !== false, leaderboardOptOut: !!p.leaderboardOptOut };
      const f = (label, val, max = 80, ph = '') => { const i = h('input', { type: 'text', value: val || '', maxlength: max, placeholder: ph, 'aria-label': label }); return [h('label', { class: 'f' }, label), i, i]; };
      const [l1, dn] = f('Display name', p.displayName, 40).slice(0, 2), [l2, kb] = f('Keyboard', d.keyboard, 80, 'e.g. Keychron K2, brown switches').slice(0, 2);
      const bio = h('textarea', { maxlength: 300, style: 'min-height:90px;font-family:var(--font-body)', 'aria-label': 'Biography' }, d.bio || '');
      const gh = h('input', { type: 'text', value: soc.github || '', placeholder: 'GitHub username', maxlength: 40 }), tw = h('input', { type: 'text', value: soc.twitter || '', placeholder: 'X / Twitter handle', maxlength: 40 }), web = h('input', { type: 'url', value: soc.website || '', placeholder: 'https://…', maxlength: 120 });
      const off = h('input', { type: 'number', min: 0, max: 12, value: store.get('streakOffset', 0), 'aria-label': 'Streak offset hours' });
      body.append(h('h3', {}, 'Profile'), l1, dn, h('label', { class: 'f' }, 'Username'), h('div', { class: 'row' }, h('b', {}, '@' + p.username), h('button', { class: 'btn sm', onClick: async () => { const n = await promptModal('Change username', 'New username (3–20 letters, numbers, underscores)', p.username, { validate: v => (/^[a-zA-Z0-9_]{3,20}$/.test(v) ? null : 'Invalid username') }); if (n) { await guard(() => cloud.changeUsername(n), 'Username changed'); draw(); } } }, 'Change')),
        h('label', { class: 'f' }, 'Biography'), bio, l2, kb, h('label', { class: 'f' }, 'Social links'), h('div', { class: 'grid g3' }, gh, tw, web),
        h('h3', { style: 'margin-top:1.4rem' }, 'Privacy'),
        sw('Public profile', state.publicProfile, v => { state.publicProfile = v; }), sw('Show activity calendar on public profile', state.showActivity, v => { state.showActivity = v; }), sw('Take part in leaderboards (new results)', !state.leaderboardOptOut, v => { state.leaderboardOptOut = !v; }),
        h('label', { class: 'f' }, 'Streak offset (hours after midnight your day ends — for night owls)'), off,
        h('div', { class: 'row', style: 'margin-top:1.2rem' }, h('button', { class: 'btn primary', onClick: () => guard(async () => {
          const web1 = web.value.trim(); if (web1 && !/^https:\/\//i.test(web1)) throw new Error('Website must start with https://');
          store.set('streakOffset', Math.min(12, Math.max(0, Math.floor(+off.value) || 0)));
          await cloud.updateProfile({ displayName: dn.value.trim() || p.username, bio: bio.value.trim(), keyboard: kb.value.trim(), social: { github: gh.value.trim().replace(/[^\w-]/g, ''), twitter: tw.value.trim().replace(/[^\w]/g, ''), website: web1 }, ...state });
        }, 'Profile updated') }, 'Save profile'),
        h('button', { class: 'btn', onClick: async () => { if (await confirmModal('Reset personal records?', 'Clears the “personal best” markers on your results and your stored bests on this device. Results themselves are kept.', 'Reset')) { store.del('pbs'); await guard(() => cloud.resetRecords(), 'Personal records reset'); } } }, 'Reset personal records')));
    } else if (tab === 'auth') {
      const provs = cloud.user.providers, oldPw = h('input', { type: 'password', autocomplete: 'current-password' }), newPw = h('input', { type: 'password', autocomplete: 'new-password' }), mailPw = h('input', { type: 'password', autocomplete: 'current-password' }), newMail = h('input', { type: 'email', value: cloud.user.email || '' });
      body.append(h('h3', {}, 'Sign-in methods'), h('p', { class: 'muted' }, cloud.user.email || ''), provs.map(id => h('div', { class: 'row spread', style: 'margin:.4rem 0' }, h('span', {}, NAMES[id] || id), provs.length > 1 && id !== 'password' && h('button', { class: 'btn sm danger', onClick: async () => { if (await confirmModal('Disconnect ' + (NAMES[id] || id) + '?', 'You will no longer be able to sign in with it.', 'Disconnect')) { await guard(() => cloud.unlinkProvider(id), 'Disconnected'); draw(); } } }, 'Disconnect'))),
        h('div', { class: 'row', style: 'margin-top:.6rem' }, !provs.includes('google.com') && h('button', { class: 'btn sm', onClick: async () => { await guard(() => cloud.linkProvider('google'), 'Google connected'); draw(); } }, 'Connect Google'), !provs.includes('github.com') && h('button', { class: 'btn sm', onClick: async () => { await guard(() => cloud.linkProvider('github'), 'GitHub connected'); draw(); } }, 'Connect GitHub')),
        provs.includes('password') && [h('h3', { style: 'margin-top:1.6rem' }, 'Change password'), h('label', { class: 'f' }, 'Current password'), oldPw, h('label', { class: 'f' }, 'New password'), newPw, h('button', { class: 'btn primary', style: 'margin-top:.8rem', onClick: () => guard(async () => { if (newPw.value.length < 6) throw new Error('New password must be at least 6 characters.'); await cloud.changePassword(oldPw.value, newPw.value); oldPw.value = newPw.value = ''; }, 'Password changed') }, 'Update password'),
          h('h3', { style: 'margin-top:1.6rem' }, 'Change email'), h('label', { class: 'f' }, 'New email'), newMail, h('label', { class: 'f' }, 'Current password'), mailPw, h('button', { class: 'btn primary', style: 'margin-top:.8rem', onClick: () => guard(() => cloud.changeEmail(mailPw.value, newMail.value.trim()), 'Check your new inbox to confirm the change') }, 'Change email')],
        h('p', { class: 'muted', style: 'margin-top:1.6rem' }, 'Active-session management is handled by Firebase: signing out here ends this device’s session.'), h('button', { class: 'btn', onClick: () => cloud.signOut().then(() => navigate('/')) }, 'Sign out'));
    } else if (tab === 'blocked') {
      body.append(h('h3', {}, 'Blocked users'), h('div', { class: 'spinner' }));
      cloud.getFriends().then(r => { body.lastChild.remove(); if (!r.blocked.length) return body.append(h('div', { class: 'empty' }, 'You have not blocked anyone.')); r.blocked.forEach(u => body.append(h('div', { class: 'row spread', style: 'margin:.4rem 0' }, h('span', {}, '@' + u.username), h('button', { class: 'btn sm', onClick: async () => { await guard(() => cloud.removeConnection(u.connectionId), 'Unblocked'); draw(); } }, 'Unblock')))); }).catch(e => { body.lastChild.remove(); body.append(h('p', { class: 'field-err' }, cloud.errText(e))); });
    } else {
      body.append(h('h3', {}, 'Danger zone'),
        h('div', { class: 'set-row' }, h('div', {}, h('h4', {}, 'Export account data'), h('p', {}, 'Download your profile, settings, results and friends as JSON.')), h('div', { class: 'ctl' }, h('button', { class: 'btn sm', onClick: () => guard(async () => download('typing-panda-account.json', JSON.stringify(await cloud.exportAll(), null, 2), 'application/json'), 'Export ready') }, 'Export'))),
        h('div', { class: 'set-row' }, h('div', {}, h('h4', {}, 'Delete account'), h('p', {}, 'Permanently deletes your profile, results, settings, friends and notifications. Backups or logs held by Firebase may persist for a limited time for security and legal reasons. This cannot be undone.')), h('div', { class: 'ctl' }, h('button', { class: 'btn sm danger', onClick: async () => { const t = await promptModal('Delete account', `Type your username (${p.username}) to confirm`, '', { okLabel: 'Delete forever', validate: v => (v.toLowerCase() === p.usernameLower ? null : 'Username does not match') }); if (t) { await guard(() => cloud.deleteAccount(), 'Account deleted'); navigate('/'); } } }, 'Delete account'))));
    }
  }
  draw();
}

import { h, toast, debounce, confirmModal } from '../util.js';
import { cloud } from '../backend.js';
import { notConfigured } from './login.js';
import { formatSpeed, unitLabel } from '../settings.js';

export async function render(root) {
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, 'Friends'), h('p', {}, 'Add friends, compare speeds and climb the friends-only leaderboard.'))));
  const wrap = h('div', { class: 'wrap pad' }); root.append(wrap);
  if (!cloud.enabled) return wrap.append(notConfigured());
  wrap.append(h('div', { class: 'spinner' })); await cloud.ready; wrap.innerHTML = '';
  if (!cloud.user || !cloud.profile) return wrap.append(h('div', { class: 'card empty' }, h('h3', {}, 'Sign in to use friends'), h('a', { class: 'btn primary', href: '#/login' }, 'Sign in')));
  let tab = 'friends', data = { friends: [], incoming: [], outgoing: [], blocked: [] };
  const nav = h('div', { class: 'tabs' }), body = h('div');
  wrap.append(nav, body);
  const act = async (fn, ok) => { try { await fn(); ok && toast(ok); await load(); } catch (e) { toast(cloud.errText(e), 'err'); } };
  const person = (u, ...btns) => h('div', { class: 'card', style: 'display:flex;gap:1rem;align-items:center;margin-bottom:.6rem;flex-wrap:wrap' }, h('span', { class: 'avatar' }, (u.username || '?')[0].toUpperCase()), h('div', { style: 'flex:1;min-width:140px' }, h('a', { href: '#/profile/' + u.username, style: 'font-weight:700' }, u.displayName || u.username), h('div', { class: 'muted' }, '@' + u.username), u.stat && h('small', { class: 'muted' }, u.stat)), h('div', { class: 'row' }, btns));
  async function load() {
    body.innerHTML = ''; body.append(h('div', { class: 'spinner' }));
    try { data = await cloud.getFriends(); } catch (e) { body.innerHTML = ''; return body.append(h('p', { class: 'field-err' }, cloud.errText(e))); }
    await Promise.all(data.friends.slice(0, 20).map(async f => { try { const r = (await cloud.getUserPublicResults(f.uid)).filter(x => !x.failed); f.stat = r.length ? `best ${formatSpeed(Math.max(...r.map(x => x.wpm)))} ${unitLabel()} · ${r.length} tests` : 'no public tests yet'; } catch { f.stat = ''; } }));
    draw();
  }
  function draw() {
    nav.innerHTML = '';
    [['friends', `Friends (${data.friends.length})`], ['requests', `Requests (${data.incoming.length + data.outgoing.length})`], ['find', 'Find people'], ['blocked', `Blocked (${data.blocked.length})`]].forEach(([id, t]) => nav.append(h('button', { class: 'opt' + (tab === id ? ' on' : ''), onClick: () => { tab = id; draw(); } }, t)));
    body.innerHTML = '';
    if (tab === 'friends') {
      if (!data.friends.length) body.append(h('div', { class: 'card empty' }, h('h3', {}, 'No friends yet'), h('p', {}, 'Find people by username and send a request.'), h('button', { class: 'btn primary', onClick: () => { tab = 'find'; draw(); } }, 'Find people')));
      else { body.append(h('a', { href: '#/leaderboards?friends=1', class: 'btn sm', style: 'margin-bottom:1rem' }, 'Friends-only leaderboard')); data.friends.forEach(f => body.append(person(f, h('button', { class: 'btn sm', onClick: async () => { if (await confirmModal('Remove friend?', `Remove @${f.username}?`, 'Remove')) act(() => cloud.removeConnection(f.connectionId), 'Friend removed'); } }, 'Remove'), h('button', { class: 'btn sm danger', onClick: async () => { if (await confirmModal('Block user?', `Block @${f.username}? They will be removed from your friends.`, 'Block')) act(() => cloud.block(f.uid), 'User blocked'); } }, 'Block')))); }
    } else if (tab === 'requests') {
      body.append(h('h3', {}, 'Incoming'), data.incoming.length ? data.incoming.map(u => person(u, h('button', { class: 'btn sm primary', onClick: () => act(() => cloud.respondFriend(u.connectionId, true), 'Friend added') }, 'Accept'), h('button', { class: 'btn sm', onClick: () => act(() => cloud.respondFriend(u.connectionId, false), 'Request rejected') }, 'Reject'))) : h('p', { class: 'muted' }, 'No incoming requests.'),
        h('h3', { style: 'margin-top:1.4rem' }, 'Outgoing'), data.outgoing.length ? data.outgoing.map(u => person(u, h('button', { class: 'btn sm', onClick: () => act(() => cloud.removeConnection(u.connectionId), 'Request cancelled') }, 'Cancel'))) : h('p', { class: 'muted' }, 'No outgoing requests.'));
    } else if (tab === 'find') {
      const out = h('div', { style: 'margin-top:1rem' }), input = h('input', { type: 'search', placeholder: 'Search username…', 'aria-label': 'Search users' });
      input.addEventListener('input', debounce(async () => { const v = input.value.trim(); out.innerHTML = ''; if (!v) return; if (!/^\w+$/.test(v)) return out.append(h('p', { class: 'field-err' }, 'Usernames only use letters, numbers and underscores.')); out.append(h('div', { class: 'spinner' })); try { const r = (await cloud.searchUsers(v)).filter(u => u.uid !== cloud.user.uid); out.innerHTML = ''; if (!r.length) return out.append(h('div', { class: 'empty' }, 'No user found.')); r.forEach(u => out.append(person(u, h('button', { class: 'btn sm primary', onClick: () => act(() => cloud.sendFriendRequest(u.username), 'Friend request sent') }, 'Add friend')))); } catch (e) { out.innerHTML = ''; out.append(h('p', { class: 'field-err' }, cloud.errText(e))); } }, 350));
      body.append(h('div', { style: 'max-width:520px' }, input, out));
    } else {
      body.append(data.blocked.length ? data.blocked.map(u => person(u, h('button', { class: 'btn sm', onClick: () => act(() => cloud.removeConnection(u.connectionId), 'Unblocked') }, 'Unblock'))) : h('div', { class: 'card empty' }, 'You have not blocked anyone.'));
    }
  }
  load();
}

import { h, toast, openModal } from '../util.js';
import { cloud, validUsername } from '../backend.js';
import { navigate } from '../router.js';

export function notConfigured() {
  return h('div', { class: 'card', style: 'max-width:620px;margin:0 auto' }, h('h3', {}, 'Accounts are not set up on this site yet'),
    h('p', { class: 'muted' }, 'You can use everything as a guest — results, settings and progress are saved on this device. The site owner can turn on accounts, cloud sync, leaderboards and friends by adding Firebase keys to js/firebase-config.js (see README).'),
    h('a', { href: '#/', class: 'btn primary' }, 'Keep typing as guest'));
}

export async function render(root, p, query) {
  const wrap = h('div', { class: 'wrap pad' });
  root.append(h('section', { class: 'band band-hero', style: 'padding:2.4rem 0' }, h('div', { class: 'wrap' }, h('h1', {}, 'Welcome to Typing Panda'), h('p', {}, 'Sign in to save results across devices, join leaderboards and add friends. Guests can always practise without an account.'))), wrap);
  if (!cloud.enabled) return wrap.append(notConfigured());
  wrap.append(h('div', { class: 'spinner' })); await cloud.ready; wrap.innerHTML = '';
  if (!cloud.enabled) return wrap.append(notConfigured());
  if (cloud.user && cloud.profile) { wrap.append(h('div', { class: 'card empty' }, h('h3', {}, `You are signed in as @${cloud.profile.username}`), h('a', { href: '#/account', class: 'btn primary' }, 'Go to account'))); return; }
  let mode = query.mode === 'register' ? 'register' : 'login';
  const box = h('div', { class: 'card', style: 'max-width:480px;margin:0 auto' });
  wrap.append(box);
  const pw = (id, label) => { const i = h('input', { type: 'password', id, autocomplete: id === 'pw' ? 'current-password' : 'new-password', required: true }); const t = h('button', { type: 'button', class: 'btn sm', style: 'margin-top:.4rem', onClick: () => { i.type = i.type === 'password' ? 'text' : 'password'; t.textContent = i.type === 'password' ? 'Show' : 'Hide'; } }, 'Show'); return [h('label', { class: 'f', for: id }, label), i, t]; };
  function draw() {
    box.innerHTML = '';
    const err = h('div', { class: 'field-err', role: 'alert' }), busy = b => { box.querySelectorAll('button').forEach(x => (x.disabled = b)); };
    const run = async fn => { err.textContent = ''; busy(true); try { await fn(); } catch (e) { err.textContent = cloud.errText(e); } busy(false); };
    box.append(h('div', { class: 'tabs' }, h('button', { class: 'opt' + (mode === 'login' ? ' on' : ''), onClick: () => { mode = 'login'; draw(); } }, 'Sign in'), h('button', { class: 'opt' + (mode === 'register' ? ' on' : ''), onClick: () => { mode = 'register'; draw(); } }, 'Create account')));
    box.append(h('div', { class: 'row', style: 'margin-bottom:1rem' }, h('button', { class: 'btn', style: 'flex:1', onClick: () => run(() => cloud.signInProvider('google').then(done)) }, 'Continue with Google'), h('button', { class: 'btn', style: 'flex:1', onClick: () => run(() => cloud.signInProvider('github').then(done)) }, 'GitHub')));
    const email = h('input', { type: 'email', id: 'em', autocomplete: 'email', required: true });
    if (mode === 'login') {
      const form = h('form', { onSubmit: e => { e.preventDefault(); run(() => cloud.signIn(email.value.trim(), form.querySelector('#pw').value).then(done)); } }, h('label', { class: 'f', for: 'em' }, 'Email'), email, ...pw('pw', 'Password'), h('p', {}, h('a', { href: '#', onClick: e => { e.preventDefault(); forgot(email.value); } }, 'Forgot password?')), err, h('button', { class: 'btn primary', style: 'width:100%', type: 'submit' }, 'Sign in'));
      box.append(form);
    } else {
      const user = h('input', { type: 'text', id: 'un', maxlength: 20, autocomplete: 'username', required: true }), disp = h('input', { type: 'text', id: 'dn', maxlength: 40 }), terms = h('input', { type: 'checkbox', id: 'tos' }), uerr = h('div', { class: 'field-err' });
      user.addEventListener('blur', async () => { uerr.textContent = ''; const u = user.value.trim(); if (!u) return; if (!validUsername(u)) uerr.textContent = 'Use 3–20 letters, numbers or underscores.'; else { try { if (!(await cloud.checkUsername(u))) uerr.textContent = 'That username is taken.'; } catch { /* ignore */ } } });
      const form = h('form', { onSubmit: e => { e.preventDefault(); run(async () => {
        const a = form.querySelector('#pw').value, b = form.querySelector('#pw2').value;
        if (!validUsername(user.value.trim())) throw new Error('Choose a valid username (3–20 letters, numbers, underscores).');
        if (a.length < 6) throw new Error('Password must be at least 6 characters.');
        if (a !== b) throw new Error('Passwords do not match.');
        if (!terms.checked) throw new Error('Please accept the Terms and Privacy Policy.');
        await cloud.signUp(email.value.trim(), a, user.value.trim(), disp.value.trim() || user.value.trim()); toast('Account created — check your email to verify it'); done();
      }); } },
      h('label', { class: 'f', for: 'em' }, 'Email'), email, h('label', { class: 'f', for: 'un' }, 'Username'), user, uerr, h('label', { class: 'f', for: 'dn' }, 'Display name'), disp, ...pw('pw', 'Password'), ...pw('pw2', 'Confirm password'),
      h('label', { class: 'row', style: 'margin:1rem 0' }, terms, h('span', {}, 'I accept the ', h('a', { href: 'terms-of-service.html', target: '_blank', rel: 'noopener' }, 'Terms'), ' and ', h('a', { href: 'privacy-policy.html', target: '_blank', rel: 'noopener' }, 'Privacy Policy'))), err, h('button', { class: 'btn primary', style: 'width:100%', type: 'submit' }, 'Create account'));
      box.append(form);
    }
  }
  const done = () => navigate('/account');
  function forgot(prefill) {
    const em = h('input', { type: 'email', value: prefill || '', autocomplete: 'email' }), err = h('div', { class: 'field-err' });
    openModal({ title: 'Reset password', content: h('div', {}, h('p', { class: 'muted' }, 'We will email you a link to choose a new password.'), em, err), actions: [{ label: 'Cancel' }, { label: 'Send link', kind: 'primary', onClick: async () => { try { await cloud.reset(em.value.trim()); toast('If that email has an account, a reset link is on its way.'); } catch (e) { err.textContent = cloud.errText(e); return false; } } }] });
  }
  draw();
  if (cloud.user && !cloud.profile) { const { profileSetupModal } = await import('../modals.js'); profileSetupModal(); }
}

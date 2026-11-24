// Hash router: #/path?query. Pages are lazy-loaded modules exporting render(container, params, query) -> optional cleanup().
import { $ } from './util.js';

const routes = [
  [/^\/$/, () => import('./pages/test.js'), 'practice'],
  [/^\/learn$/, () => import('./pages/learn.js'), 'learn'],
  [/^\/leaderboards$/, () => import('./pages/leaderboards.js'), 'leaderboards'],
  [/^\/about$/, () => import('./pages/about.js'), 'about'],
  [/^\/settings$/, () => import('./pages/settings-page.js'), 'settings'],
  [/^\/login$/, () => import('./pages/login.js'), 'login'],
  [/^\/account$/, () => import('./pages/account.js'), 'account'],
  [/^\/account-settings$/, () => import('./pages/account-settings.js'), 'account'],
  [/^\/profile$/, () => import('./pages/profile.js'), 'profile'],
  [/^\/profile\/([^/]+)$/, () => import('./pages/profile.js'), 'profile'],
  [/^\/friends$/, () => import('./pages/friends.js'), 'friends']
];
let cleanup = null, token = 0;
export const navigate = (path) => { location.hash = '#' + path; };
export const currentRoute = () => { const [p, q] = (location.hash.slice(1) || '/').split('?'); return { path: p || '/', query: Object.fromEntries(new URLSearchParams(q || '')) }; };
export function setQuery(obj) { const { path } = currentRoute(); const q = new URLSearchParams(obj).toString(); history.replaceState(null, '', '#' + path + (q ? '?' + q : '')); }

export async function resolve() {
  const my = ++token;
  const { path, query } = currentRoute();
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const app = $('#app');
  document.body.classList.remove('typing-active');
  app.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
  let hit = null;
  for (const [re, load, id] of routes) { const m = path.match(re); if (m) { hit = { load, id, params: m.slice(1).map(decodeURIComponent) }; break; } }
  document.dispatchEvent(new CustomEvent('route', { detail: { path, id: hit ? hit.id : '' } }));
  try {
    if (!hit) { app.innerHTML = ''; app.append(notFound(path)); return; }
    const mod = await hit.load();
    if (my !== token) return;
    app.innerHTML = '';
    app.classList.remove('page'); void app.offsetWidth; app.classList.add('page');
    cleanup = (await mod.render(app, hit.params, query, path)) || null;
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="wrap pad"><div class="card empty"><h3>Something went wrong</h3><p>${String(e.message || e).replace(/[<>&]/g, '')}</p><a class="btn primary" href="#/">Back to typing</a></div></div>`;
  }
}
function notFound(path) {
  const d = document.createElement('div'); d.className = 'wrap pad';
  d.innerHTML = '<div class="card empty"><h2>404 — page not found</h2><p>There is no page at this address.</p><a class="btn primary" href="#/">Back to typing</a></div>';
  return d;
}
window.addEventListener('hashchange', resolve);

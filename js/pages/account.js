// Account / statistics dashboard. Uses cloud results when signed in, otherwise this device's results.
import { h, fmt, fmtDate, download, confirmModal, toast, dayKey, store, esc } from '../util.js';
import { cloud } from '../backend.js';
import { loadAllResults, computeStats, xpFor, xpForLevel, deleteLocalResult } from '../results.js';
import { chart } from '../charts.js';
import { ACHIEVEMENTS } from '../data.js';
import { settings, formatSpeed, unitLabel } from '../settings.js';
import { renderResult } from '../result-view.js';
import { openModal } from '../util.js';

const MODES = { time: 'time', words: 'words', quote: 'quote', zen: 'zen', custom: 'custom' };
const tile = (v, l) => h('div', { class: 'card' }, h('div', { class: 'stat-big' }, v), h('div', { class: 'stat-label' }, l));

export async function render(root) {
  root.append(h('div', { class: 'spinner' }));
  await cloud.ready;
  const results = await loadAllResults();
  root.innerHTML = '';
  const st = computeStats(results), signed = !!(cloud.user && cloud.profile);
  const name = signed ? cloud.profile.displayName || cloud.profile.username : 'Guest';
  const lo = xpForLevel(st.level), hi = xpForLevel(st.level + 1), pct = Math.round(((st.xp - lo) / (hi - lo)) * 100);
  root.append(h('section', { class: 'band band-hero' }, h('div', { class: 'wrap row spread' },
    h('div', { class: 'row', style: 'flex-wrap:nowrap' }, h('span', { class: 'avatar lg' }, name[0].toUpperCase()), h('div', {}, h('h1', { style: 'margin:0;font-size:2.2rem' }, name), h('p', { style: 'margin:.2rem 0' }, signed ? `@${cloud.profile.username} · joined ${cloud.profile.createdAt && cloud.profile.createdAt.toMillis ? new Date(cloud.profile.createdAt.toMillis()).toLocaleDateString() : '—'}` : 'Statistics from this device. Sign in to sync them to your account.'))),
    h('div', { style: 'min-width:240px' }, h('div', { class: 'row spread' }, h('b', {}, 'Level ' + st.level), h('span', {}, `${st.xp} XP`)), h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` })), h('small', {}, `${hi - st.xp} XP to level ${st.level + 1}`)),
    h('div', { class: 'row' }, signed ? h('a', { class: 'btn', style: 'color:#fff;border-color:#fff55', href: '#/account-settings' }, 'Account settings') : h('a', { class: 'btn primary', href: '#/login' }, 'Sign in / Register')))));
  const wrap = h('div', { class: 'wrap pad' }); root.append(wrap);
  if (cloud.enabled && cloud.user && !cloud.user.emailVerified) wrap.append(h('div', { class: 'card flat', style: 'margin-bottom:1rem' }, 'Your email is not verified yet. ', h('button', { class: 'btn sm', onClick: () => cloud.resendVerification().then(() => toast('Verification email sent')).catch(e => toast(cloud.errText(e), 'err')) }, 'Resend email')));
  if (!results.length) { wrap.append(h('div', { class: 'card empty' }, h('h3', {}, 'No tests yet'), h('p', {}, 'Finish a test and your statistics will appear here.'), h('a', { class: 'btn primary', href: '#/' }, 'Take a test'))); }
  wrap.append(h('div', { class: 'grid g4' },
    tile(st.tests, 'tests completed'), tile(fmt(st.typingTime / 60, 1) + ' min', 'typing time'), tile(formatSpeed(st.avgWpm), 'average ' + unitLabel()), tile(formatSpeed(st.bestWpm), 'best ' + unitLabel()),
    tile(fmt(st.bestAcc, 1) + '%', 'best accuracy'), tile(st.currentStreak + ' days', 'current streak'), tile(st.longestStreak + ' days', 'longest streak'), tile(fmt(st.words), 'words typed'), tile(fmt(st.chars), 'characters typed'), tile(fmt(st.bestConsistency, 0) + '%', 'best consistency')));

  const ok = results.filter(r => !r.failed).slice().sort((a, b) => a.createdAt - b.createdAt);
  if (ok.length) {
    const rec = ok.slice(-60);
    const c1 = h('div', { class: 'card' }, h('h3', {}, 'WPM progress (last ' + rec.length + ' tests)')), c2 = h('div', { class: 'card' }, h('h3', {}, 'Accuracy progress'));
    wrap.append(h('div', { class: 'two', style: 'margin-top:1rem' }, c1, c2));
    chart(c1, { labels: rec.map((_, i) => i + 1), xTitle: 'test', series: [{ name: 'WPM', data: rec.map(r => r.wpm), color: '--main' }] });
    chart(c2, { labels: rec.map((_, i) => i + 1), xTitle: 'test', series: [{ name: 'Accuracy', data: rec.map(r => r.accuracy), color: '#6F8BFF', unit: '%' }] });
    // activity: last 14 days, 12 weeks, 12 months
    const days = [], now = new Date();
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const k = dayKey(d); days.push([k.slice(5), st.days[k] || { tests: 0, time: 0 }]); }
    const weeks = [], months = [];
    for (let i = 11; i >= 0; i--) { const e = new Date(now); e.setDate(e.getDate() - i * 7); const s = new Date(e); s.setDate(s.getDate() - 6); let n = 0; for (const [k, v] of Object.entries(st.days)) { const d = new Date(k + 'T00:00:00'); if (d >= new Date(dayKey(s) + 'T00:00:00') && d <= new Date(dayKey(e) + 'T23:59:59')) n += v.tests; } weeks.push([dayKey(e).slice(5), n]); }
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const pre = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); months.push([pre, Object.entries(st.days).filter(([k]) => k.startsWith(pre)).reduce((a, [, v]) => a + v.tests, 0)]); }
    const a1 = h('div', { class: 'card' }, h('h3', {}, 'Daily activity (tests)')), a2 = h('div', { class: 'card' }, h('h3', {}, 'Weekly activity')), a3 = h('div', { class: 'card', style: 'grid-column:1/-1' }, h('h3', {}, 'Monthly activity'));
    wrap.append(h('div', { class: 'two', style: 'margin-top:1rem' }, a1, a2, a3));
    chart(a1, { labels: days.map(d => d[0]), series: [{ name: 'Tests', data: days.map(d => d[1].tests), color: '--main', kind: 'bars', digits: 0 }] });
    chart(a2, { labels: weeks.map(d => d[0]), series: [{ name: 'Tests', data: weeks.map(d => d[1]), color: '#6F8BFF', kind: 'bars', digits: 0 }] });
    chart(a3, { labels: months.map(d => d[0]), series: [{ name: 'Tests', data: months.map(d => d[1]), color: '--main', kind: 'bars', digits: 0 }] });
    // Monthly activity calendar: one animated mini-calendar per month (last 12 months).
    const monthCards = h('div', { class: 'activity-months', 'aria-label': 'Monthly activity calendars' });
    const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let offset = 11; offset >= 0; offset--) {
      const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const year = first.getFullYear(), month = first.getMonth();
      const monthKey = year + '-' + String(month + 1).padStart(2, '0');
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthEntries = Object.entries(st.days).filter(([k]) => k.startsWith(monthKey));
      const totalTests = monthEntries.reduce((sum, [, value]) => sum + (value.tests || 0), 0);
      const activeDays = monthEntries.filter(([, value]) => value.tests > 0).length;
      const monthGrid = h('div', { class: 'activity-month-grid' });
      weekdayNames.forEach(day => monthGrid.append(h('span', { class: 'activity-weekday', 'aria-hidden': 'true' }, day)));
      for (let blank = 0; blank < first.getDay(); blank++) monthGrid.append(h('span', { class: 'activity-day empty', 'aria-hidden': 'true' }));
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day), key = dayKey(date);
        const entry = st.days[key], count = entry ? entry.tests : 0;
        const future = key > dayKey(now);
        const level = count ? Math.min(4, Math.ceil(count / 2)) : 0;
        monthGrid.append(h('span', {
          class: 'activity-day' + (level ? ' l' + level : '') + (future ? ' future' : ''),
          title: future ? key : key + ': ' + count + ' tests',
          'aria-label': future ? key : key + ': ' + count + ' tests',
          style: '--day-index:' + (day - 1)
        }, String(day)));
      }
      const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      monthCards.append(h('article', { class: 'activity-month-card' },
        h('div', { class: 'activity-month-head' },
          h('div', {}, h('h4', {}, monthName), h('small', {}, activeDays + ' active days')),
          h('strong', {}, totalTests + ' tests')),
        monthGrid));
    }
    const activityLegend = h('div', { class: 'activity-legend' },
      h('span', {}, 'Less'), ...[0, 1, 2, 3, 4].map(level => h('i', { class: level ? 'l' + level : '' })), h('span', {}, 'More'));
    wrap.append(h('section', { class: 'card activity-calendar-card', style: 'margin-top:1rem' },
      h('div', { class: 'row spread activity-calendar-title' }, h('div', {}, h('h3', {}, 'Activity calendar'), h('p', { class: 'muted' }, 'Your typing journey, month by month')), activityLegend),
      monthCards));
    // language & mode & personal bests
    const by = (f) => { const m = {}; ok.forEach(r => { const k = f(r); (m[k] = m[k] || { n: 0, best: 0, sum: 0 }); m[k].n++; m[k].best = Math.max(m[k].best, r.wpm); m[k].sum += r.wpm; }); return m; };
    const tableOf = (m, head) => h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Tests', 'Avg', 'Best'].map((x, i) => h('th', {}, i ? x : head)))), h('tbody', {}, Object.entries(m).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v.n), h('td', {}, formatSpeed(v.sum / v.n)), h('td', {}, formatSpeed(v.best)))))));
    const pbs = by(r => (r.mode === 'time' ? 'time ' + r.modeValue + 's' : r.mode === 'words' ? r.modeValue + ' words' : r.mode));
    wrap.append(h('div', { class: 'grid g3', style: 'margin-top:1rem' }, h('div', { class: 'card' }, h('h3', {}, 'Personal bests'), tableOf(pbs, 'Test')), h('div', { class: 'card' }, h('h3', {}, 'Languages'), tableOf(by(r => r.language || 'english'), 'Language')), h('div', { class: 'card' }, h('h3', {}, 'Modes'), tableOf(by(r => MODES[r.mode] || r.mode), 'Mode'))));
  }

  // achievements
  wrap.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, `Achievements (${st.achievements.length}/${ACHIEVEMENTS.length})`), h('div', { class: 'grid g3' }, ACHIEVEMENTS.map(a => { const on = st.achievements.includes(a.id); return h('div', { class: 'notif', style: on ? 'border-color:var(--main)' : 'opacity:.55' }, h('span', { style: 'font-size:1.6rem' }, on ? '🏆' : '🔒'), h('div', {}, h('b', {}, a.name), h('small', { class: 'muted' }, a.desc))); }))));

  // history table
  if (results.length) {
    let sortKey = 'createdAt', dir = -1, q = '', mode = 'all', from = '', page = 1;
    const per = 15, tbody = h('tbody'), info = h('span', { class: 'muted' }), more = h('div', { class: 'row', style: 'justify-content:center;margin-top:.8rem' });
    const cols = [['createdAt', 'Date'], ['wpm', 'WPM'], ['rawWpm', 'Raw'], ['accuracy', 'Acc %'], ['consistency', 'Cons %'], ['mode', 'Mode'], ['duration', 'Time'], ['language', 'Language'], ['personalBest', 'PB'], ['id', 'ID']];
    const search = h('input', { type: 'search', placeholder: 'Search mode, language, tag, ID…', 'aria-label': 'Search history', onInput: e => { q = e.target.value.toLowerCase(); page = 1; draw(); } });
    const msel = h('select', { 'aria-label': 'Mode filter', onChange: e => { mode = e.target.value; page = 1; draw(); } }, ['all', ...Object.keys(MODES)].map(m => h('option', { value: m }, m)));
    const date = h('input', { type: 'date', 'aria-label': 'From date', onChange: e => { from = e.target.value; page = 1; draw(); } });
    function draw() {
      let rows = results.filter(r => (mode === 'all' || r.mode === mode) && (!from || r.createdAt >= new Date(from + 'T00:00:00').getTime()) && (!q || [r.mode, r.language, r.id, (r.tags || []).join(' '), r.failed ? 'failed' : ''].join(' ').toLowerCase().includes(q)));
      rows.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * dir);
      const shown = rows.slice(0, page * per); tbody.innerHTML = '';
      shown.forEach(r => tbody.append(h('tr', { style: 'cursor:pointer', title: 'Open result', onClick: () => openResult(r) }, h('td', {}, fmtDate(r.createdAt)), h('td', {}, formatSpeed(r.wpm)), h('td', {}, formatSpeed(r.rawWpm)), h('td', {}, r.accuracy.toFixed(1)), h('td', {}, (r.consistency || 0).toFixed(0)), h('td', {}, r.mode + (r.modeValue ? ' ' + r.modeValue : '') + (r.failed ? ' (failed)' : '')), h('td', {}, r.duration + 's'), h('td', {}, r.language || 'english'), h('td', {}, r.personalBest ? '★' : ''), h('td', { class: 'muted' }, String(r.id).slice(0, 8)))));
      if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: cols.length, class: 'empty' }, 'No results match these filters.')));
      info.textContent = `${shown.length} of ${rows.length} results`;
      more.innerHTML = ''; if (shown.length < rows.length) more.append(h('button', { class: 'btn', onClick: () => { page++; draw(); } }, 'Load more'));
    }
    async function openResult(r) {
      let full = r;
      if (cloud.user && !r.events) { try { const d = await cloud.getResultEvents(r.id); if (d) full = { ...r, ...d }; } catch { /* optional */ } }
      const body = h('div'); const m = openModal({ title: 'Result ' + String(r.id).slice(0, 8), wide: true, content: body, actions: [{ label: 'Delete result', kind: 'danger', close: false, onClick: async () => { if (await confirmModal('Delete this result?', 'This permanently removes it from your history.', 'Delete')) { try { if (cloud.user) await cloud.deleteResult(r.id); deleteLocalResult(r.id); results.splice(results.indexOf(r), 1); m.close(); draw(); toast('Result deleted'); } catch (e) { toast(e.message, 'err'); } } } }, { label: 'Close' }] });
      renderResult(body, full, { saved: true });
    }
    const head = h('tr', {}, cols.map(([k, t]) => h('th', { onClick: () => { dir = sortKey === k ? -dir : -1; sortKey = k; draw(); }, 'aria-sort': 'none' }, t)));
    wrap.append(h('div', { class: 'card', style: 'margin-top:1rem' }, h('div', { class: 'row spread' }, h('h3', {}, 'Test history'), h('button', { class: 'btn sm', onClick: () => { const hdr = ['id', 'date', 'mode', 'modeValue', 'language', 'wpm', 'rawWpm', 'accuracy', 'consistency', 'burst', 'duration', 'personalBest', 'validationStatus', 'tags']; const csv = [hdr.join(',')].concat(results.map(r => hdr.map(k => k === 'date' ? new Date(r.createdAt).toISOString() : JSON.stringify(Array.isArray(r[k]) ? r[k].join(';') : r[k] ?? '')).join(','))).join('\n'); download('typing-panda-history.csv', csv, 'text/csv'); } }, 'Export CSV')),
      h('div', { class: 'row', style: 'margin:.6rem 0' }, h('div', { style: 'flex:1;min-width:200px' }, search), msel, date), h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, head), tbody)), info, more));
    draw();
  }
}

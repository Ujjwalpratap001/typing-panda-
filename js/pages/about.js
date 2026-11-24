import { h, fmt } from '../util.js';
import { cloud } from '../backend.js';
import { getLocalResults, computeStats } from '../results.js';
import { SHORTCUTS, contactModal } from '../modals.js';
import { WORDSETS, ACHIEVEMENTS } from '../data.js';

const FAQ = [
  ['Do I need an account?', 'No. Everything works as a guest and is stored on your device. An account adds cloud sync, leaderboards, friends and public profiles.'],
  ['Why was my result not on the leaderboard?', 'Only valid time, words and quote tests are ranked. Results with lost focus, impossible speeds or robotic timing are flagged, and funbox, zen and custom tests are never ranked.'],
  ['Why does my WPM differ from other sites?', 'Different sites count differently. Typing Panda counts only correct characters (including spaces after correct words) divided by five.'],
  ['Can I use my own text?', 'Yes — choose Custom mode, paste or type your text, and save it for later.'],
  ['How do I restart fast?', 'Press Tab (or Esc if you change it in Settings). Ctrl+K opens the command palette.'],
  ['Is my data private?', 'Settings and results stay on your device unless you sign in. See the Privacy Policy for the details.']
];
const card = (t, ...c) => h('div', { class: 'card' }, h('h3', {}, t), ...c);

export async function render(root) {
  root.append(h('section', { class: 'band band-hero' }, h('div', { class: 'wrap' }, h('span', { class: 'pill' }, 'About'), h('h1', { style: 'margin-top:.8rem' }, 'Practice. Improve. Type Faster.'), h('p', {}, 'Typing Panda is a free, distraction-free typing practice site with timed tests, quotes, code, a beginner-friendly Learn mode and in-depth result analysis.'), h('a', { href: '#/', class: 'btn primary' }, 'Start typing'))));

  root.append(h('section', { class: 'band band-dark' }, h('div', { class: 'wrap' }, h('h2', {}, 'Why typing speed matters'), h('div', { class: 'grid g3', style: 'margin-top:1rem' },
    card('Time you get back', h('p', { class: 'muted' }, 'If you type for hours every week, a faster and more accurate rhythm quietly returns hours every month.')),
    card('Thinking at full speed', h('p', { class: 'muted' }, 'When typing is automatic, your attention stays on ideas and code instead of on finding keys.')),
    card('Comfort and accuracy', h('p', { class: 'muted' }, 'Good technique means fewer typos, less strain and less corrective backspacing.')))))); 

  root.append(h('section', { class: 'band band-light' }, h('div', { class: 'wrap' }, h('h2', {}, 'How the numbers are calculated'), h('p', { class: 'muted' }, 'All values come from your recorded keystrokes — never from random numbers.'),
    h('div', { class: 'grid g3', style: 'margin-top:1rem' },
      card('WPM', h('p', {}, h('code', {}, 'correct characters ÷ 5 ÷ minutes')), h('p', { class: 'muted' }, 'Correct characters are the letters of fully correct words plus the spaces after them (and the correct start of the word you are typing when time ends). Five characters = one word.')),
      card('Raw WPM', h('p', {}, h('code', {}, 'all typed characters ÷ 5 ÷ minutes')), h('p', { class: 'muted' }, 'Counts every character you typed, right or wrong, including spaces.')),
      card('Accuracy', h('p', {}, h('code', {}, 'correct keystrokes ÷ total keystrokes × 100')), h('p', { class: 'muted' }, 'Every character or space you press counts once. Corrected mistakes still count as mistakes, so backspacing does not hide them.')),
      card('Consistency', h('p', { class: 'muted' }, 'Measures how steady your speed was from second to second (based on the variation of your per-second raw speed). 100% is perfectly steady.')),
      card('Burst', h('p', { class: 'muted' }, 'Your fastest single word, as if you had typed at that speed for a full minute.')),
      card('Difficulty', h('p', { class: 'muted' }, 'Normal: no restrictions. Expert: the test fails when you submit an incorrect word. Master: it fails on any incorrect letter.'))))));

  root.append(h('section', { class: 'band band-blue' }, h('div', { class: 'wrap' }, h('h2', {}, 'What you can do here'), h('div', { class: 'grid g3', style: 'margin-top:1rem' },
    card('Languages & wordsets', h('p', { class: 'muted' }, `${WORDSETS.length} wordsets: common and advanced English plus ${WORDSETS.length - 2} programming languages.`)),
    card('Learn mode', h('p', { class: 'muted' }, 'Twelve courses from the home row to full paragraphs, with a visual keyboard and finger guidance.'), h('a', { href: '#/learn', class: 'btn sm' }, 'Open Learn')),
    card('Results & charts', h('p', { class: 'muted' }, 'Speed, burst, accuracy and per-letter charts, word history, replay and personal records.')),
    card('Achievements', h('p', { class: 'muted' }, ACHIEVEMENTS.length + ' badges with clear criteria, calculated from your saved results.'), h('a', { href: '#/account', class: 'btn sm' }, 'See yours')),
    card('Keyboard shortcuts', h('div', { class: 'sc-list' }, SHORTCUTS.slice(0, 6).map(([a, b]) => h('div', {}, h('span', {}, a), h('kbd', {}, b))))),
    card('Funbox', h('p', { class: 'muted' }, 'Experimental challenges like Morse, binary and mirror text. They are fun, but never ranked.'))))));

  const stats = h('div', { class: 'grid g4', style: 'margin-top:1rem' }, h('div', { class: 'spinner' }));
  root.append(h('section', { class: 'band band-dark' }, h('div', { class: 'wrap' }, h('h2', {}, 'Platform statistics'), stats)));
  const tile = (v, l) => h('div', { class: 'card' }, h('div', { class: 'stat-big' }, v), h('div', { class: 'stat-label' }, l));
  const local = computeStats(getLocalResults());
  const draw = (g, note) => { stats.innerHTML = ''; if (g) stats.append(tile(fmt(g.tests), 'tests completed'), tile(fmt(g.time / 3600, 1) + ' h', 'typing time'), tile(fmt(g.users), 'users'), tile(fmt(g.words), 'words typed')); else stats.append(h('div', { class: 'card empty', style: 'grid-column:1/-1' }, h('h3', {}, 'Global statistics unavailable'), h('p', {}, note))); stats.append(h('div', { class: 'card', style: 'grid-column:1/-1' }, h('b', {}, 'On this device: '), `${local.tests} ${local.tests === 1 ? 'test' : 'tests'} · ${fmt(local.typingTime / 60, 1)} minutes of typing`)); };
  (async () => {
    if (!cloud.enabled) return draw(null, 'Cloud features are not configured on this site, so there are no shared statistics to show.');
    try { await cloud.ready; const g = await cloud.platformStats(); g.tests ? draw(g) : draw(null, 'No public results have been recorded yet. Be the first!'); } catch (e) { draw(null, 'Could not load statistics right now.'); }
  })();

  root.append(h('section', { class: 'band band-light' }, h('div', { class: 'wrap', style: 'max-width:820px' }, h('h2', {}, 'Frequently asked questions'), FAQ.map(([q, a]) => h('details', { class: 'card', style: 'margin:.6rem 0' }, h('summary', { style: 'cursor:pointer;font-weight:700' }, q), h('p', { class: 'muted', style: 'margin:.6rem 0 0' }, a))))));

  root.append(h('section', { class: 'band band-lime' }, h('div', { class: 'wrap row spread' }, h('div', {}, h('h2', { style: 'margin:0 0 .4rem' }, 'Questions or feedback?'), h('p', { style: 'margin:0' }, 'Typing Panda is built with plain HTML, CSS and JavaScript, Firebase and a lot of practice.')), h('div', { class: 'row' }, h('button', { class: 'btn', onClick: contactModal }, 'Contact support'), h('a', { href: '#/', class: 'btn primary' }, 'Start typing')))));
}

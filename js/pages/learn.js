// Learn mode: touch-typing course with lessons, finger guidance and tracked progress.
import { h, store, toast } from '../util.js';
import { settings } from '../settings.js';
import { COMMON, ADVANCED } from '../data.js';
import { createTyping } from '../typing-ui.js';
import { makeKeymap, keyInfo, FINGER_NAMES } from '../keymap.js';
import { navigate } from '../router.js';
import { addNotif } from '../notify.js';
import { requestSync } from '../sync.js';

const SENTENCES = ['The quick brown fox jumps over the lazy dog.', 'Practice a little every day and your speed will grow.', 'Keep your wrists relaxed and your eyes on the screen.', 'Accuracy comes first, and speed follows with time.', 'A calm rhythm beats a fast and messy sprint.'];
const PARAS = [
  'Typing is a skill like any other. At first every key feels far away, but after a few weeks your fingers begin to know where to go. Slow down, stay accurate, and let the speed arrive on its own.',
  'Good habits start with posture. Sit up straight, keep your feet flat on the floor, and rest your fingers lightly on the home row. Your hands should float above the keys, ready to move.',
  'When you make a mistake, do not panic. Correct it calmly and keep your rhythm. Over many short sessions your mistakes will become rarer and your typing will feel smooth.'
];
const K = (title, keys, desc) => ({ title, type: 'keys', keys, desc: desc || `Practise the keys: ${keys.split('').join(' ')}` });
export const CATS = [
  { id: 'home', title: 'Home row', desc: 'Rest your fingers on A S D F and J K L ; — every other key is reached from here.', lessons: [K('F and J', 'fj'), K('D and K', 'dk'), K('S and L', 'sl'), K('A and ;', 'a;'), K('Home row', 'asdfjkl;'), K('G and H', 'gh'), K('Full home row', 'asdfghjkl;')] },
  { id: 'top', title: 'Top row', desc: 'Reach up from the home row and return after every key.', lessons: [K('Q W E R T', 'qwert'), K('Y U I O P', 'yuiop'), K('Whole top row', 'qwertyuiop'), K('Top + home rows', 'qwertyuiopasdfghjkl')] },
  { id: 'bottom', title: 'Bottom row', desc: 'Curl your fingers down to Z X C V B N M.', lessons: [K('Z X C V B', 'zxcvb'), K('N M , .', 'nm,.'), K('Whole bottom row', 'zxcvbnm,.'), K('Bottom + home rows', 'zxcvbnm,.asdfghjkl')] },
  { id: 'left', title: 'Left-hand practice', desc: 'Train your left hand on its own keys.', lessons: [K('Left home', 'asdfg'), K('Left top', 'qwert'), K('Left bottom', 'zxcvb'), K('All left keys', 'asdfgqwertzxcvb')] },
  { id: 'right', title: 'Right-hand practice', desc: 'Now the right hand.', lessons: [K('Right home', 'hjkl;'), K('Right top', 'yuiop'), K('Right bottom', 'nm,.'), K('All right keys', 'hjkl;yuiopnm,.')] },
  { id: 'fingers', title: 'Finger-specific exercises', desc: 'One finger at a time, so each learns its job.', lessons: [K('Left pinky', 'qaz'), K('Left ring', 'wsx'), K('Left middle', 'edc'), K('Left index', 'rfvtgb'), K('Right index', 'yhnujm'), K('Right middle', 'ik,'), K('Right ring', 'ol.'), K('Right pinky', 'p;/')] },
  { id: 'caps', title: 'Capital letters', desc: 'Hold Shift with the hand opposite the letter.', lessons: [{ title: 'Capital words', type: 'caps', desc: 'Capitalise words using the opposite-hand Shift key.' }, { title: 'Names & sentences', type: 'caps2', desc: 'Capital letters at the start of each sentence.' }] },
  { id: 'numbers', title: 'Numbers', desc: 'The number row — reach, tap, return.', lessons: [K('1 2 3 4 5', '12345'), K('6 7 8 9 0', '67890'), { title: 'All numbers', type: 'numbers', desc: 'Random numbers of different lengths.' }] },
  { id: 'punct', title: 'Punctuation', desc: 'Commas, full stops, quotes and friends.', lessons: [{ title: 'Commas and full stops', type: 'punct', marks: ',.', desc: 'Words ending with , and .' }, { title: 'Quotes and colons', type: 'punct', marks: '\'":;', desc: 'Apostrophes, quotes, colons and semicolons.' }, { title: 'Question & exclamation', type: 'punct', marks: '?!', desc: 'Words ending with ? and !' }] },
  { id: 'words', title: 'Common words', desc: 'The words you will type most often.', lessons: [{ title: 'First 50 words', type: 'words', from: 0, to: 50, desc: 'The 50 most common words.' }, { title: 'Words 51–150', type: 'words', from: 50, to: 150, desc: 'A wider set of common words.' }, { title: 'Words 151–300', type: 'words', from: 150, to: 300, desc: 'Less common words.' }, { title: 'Advanced vocabulary', type: 'adv', desc: 'Longer, harder words.' }] },
  { id: 'sentences', title: 'Sentences', desc: 'Put it all together in full sentences.', lessons: SENTENCES.map((t, i) => ({ title: 'Sentence set ' + (i + 1), type: 'text', text: [SENTENCES[i], SENTENCES[(i + 1) % 5], SENTENCES[(i + 2) % 5]].join(' '), desc: 'Three sentences with punctuation.' })) },
  { id: 'paragraphs', title: 'Paragraphs', desc: 'Longer passages to build endurance.', lessons: PARAS.map((t, i) => ({ title: 'Paragraph ' + (i + 1), type: 'text', text: t, desc: 'A full paragraph.' })) }
];
CATS.forEach(c => c.lessons.forEach((l, i) => { l.id = c.id + '-' + (i + 1); l.cat = c.id; l.goal = l.type === 'text' ? 90 : 92; }));
const ALL = CATS.flatMap(c => c.lessons);
store.set('learnTotal', ALL.length);

const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
function lessonWords(l) {
  const pool = COMMON.concat(ADVANCED);
  if (l.type === 'keys') {
    const set = new Set(l.keys), real = pool.filter(w => w.length > 1 && [...w].every(c => set.has(c)));
    const keys = [...set], out = [];
    for (let i = 0; i < 24; i++) out.push(real.length >= 6 && Math.random() < 0.6 ? pick(real) : Array.from({ length: 2 + rnd(4) }, () => pick(keys)).join(''));
    return out;
  }
  if (l.type === 'caps') return Array.from({ length: 22 }, () => { const w = pick(COMMON); return Math.random() < 0.65 ? w[0].toUpperCase() + w.slice(1) : w; });
  if (l.type === 'caps2') return Array.from({ length: 4 }, () => { const w = Array.from({ length: 4 + rnd(3) }, () => pick(COMMON)); w[0] = w[0][0].toUpperCase() + w[0].slice(1); w[w.length - 1] += '.'; return w; }).flat();
  if (l.type === 'numbers') return Array.from({ length: 16 }, () => String(rnd(10 ** (2 + rnd(4)))));
  if (l.type === 'punct') return Array.from({ length: 20 }, () => { const w = pick(COMMON), m = pick([...l.marks]); return m === "'" || m === '"' ? `${m}${w}${m}` : w + m; });
  if (l.type === 'words') return Array.from({ length: 25 }, () => pick(COMMON.slice(l.from, l.to)));
  if (l.type === 'adv') return Array.from({ length: 20 }, () => pick(ADVANCED));
  return l.text.split(/\s+/);
}

const progress = () => store.get('learn', {});
const doneCount = () => Object.values(progress()).filter(x => x.done).length;

export function render(root, params, query) {
  if (query.lesson) { const l = ALL.find(x => x.id === query.lesson); if (l) return lessonView(root, l); }
  const p = progress(), total = ALL.length, done = doneCount(), pct = Math.round((done / total) * 100);
  root.append(h('section', { class: 'band band-hero' }, h('div', { class: 'wrap' },
    h('span', { class: 'pill' }, 'Learn mode'), h('h1', { style: 'margin-top:.8rem' }, 'Learn touch typing'),
    h('p', {}, 'Twelve short courses take you from the home row to full paragraphs. Pass a lesson with enough accuracy to unlock the confidence for the next.'),
    h('div', { style: 'max-width:420px' }, h('div', { class: 'row spread', style: 'margin-bottom:.4rem' }, h('b', {}, `${done} of ${total} lessons complete`), h('span', {}, pct + '%')), h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` }))),
    ALL.find(l => !(p[l.id] && p[l.id].done)) && h('a', { class: 'btn primary', style: 'margin-top:1.4rem', href: '#/learn?lesson=' + ALL.find(l => !(p[l.id] && p[l.id].done)).id }, done ? 'Continue learning' : 'Start the first lesson'))));

  const km = makeKeymap(settings.layout);
  root.append(h('section', { class: 'band band-light' }, h('div', { class: 'wrap' }, h('h2', {}, 'Before you start'),
    h('div', { class: 'grid g3', style: 'margin-top:1rem' },
      h('div', { class: 'card' }, h('h3', {}, 'Sit well'), h('p', { class: 'muted' }, 'Back straight, shoulders relaxed, elbows near 90°, feet flat. The screen should be at eye level.')),
      h('div', { class: 'card' }, h('h3', {}, 'Find the home row'), h('p', { class: 'muted' }, 'Left fingers on A S D F, right fingers on J K L ;, thumbs on the space bar. Feel the bumps on F and J.')),
      h('div', { class: 'card' }, h('h3', {}, 'Accuracy, then speed'), h('p', { class: 'muted' }, 'Slow, correct typing builds the muscle memory. Speed is a side-effect, so never rush a lesson.'))),
    h('div', { class: 'card', style: 'margin-top:1rem;text-align:center;overflow-x:auto' }, h('h3', {}, 'Which finger presses which key'), h('p', { class: 'muted' }, 'The coloured underline shows the finger. Both index fingers cover two columns.'), km.el))));

  CATS.forEach((c, ci) => {
    const cd = c.lessons.filter(l => p[l.id] && p[l.id].done).length;
    root.append(h('section', { class: 'band ' + (ci % 2 ? 'band-light' : 'band-dark'), style: 'padding:2.2rem 0' }, h('div', { class: 'wrap' },
      h('div', { class: 'row spread' }, h('div', {}, h('h2', { style: 'margin:0' }, `${ci + 1}. ${c.title}`), h('p', { class: 'muted', style: 'margin:.3rem 0 1rem' }, c.desc)), h('span', { class: 'pill' }, `${cd}/${c.lessons.length}`)),
      h('div', { class: 'lesson-grid' }, c.lessons.map(l => h('button', { class: 'lesson' + (p[l.id] && p[l.id].done ? ' done' : ''), style: ci % 2 ? 'background:#fff;color:#050D2E;border-color:rgba(5,13,46,.15)' : '', onClick: () => navigate('/learn?lesson=' + l.id) }, l.title, h('small', {}, p[l.id] ? `best ${p[l.id].bestAcc}% · ${p[l.id].bestWpm} WPM` : 'Not started')))))));
  });
}

function lessonView(root, lesson) {
  const wrap = h('div', { class: 'wrap pad' });
  root.append(wrap);
  const idx = ALL.indexOf(lesson), next = ALL[idx + 1], prog = progress()[lesson.id];
  let session = null;
  function start() {
    wrap.innerHTML = '';
    const words = lessonWords(lesson), total = words.length;
    const km = makeKeymap(settings.layout), guide = h('div', { class: 'card flat', style: 'text-align:center;margin-top:1rem', 'aria-live': 'polite' }, 'Start typing to begin.');
    const bar = h('div', { class: 'progress' }, h('i', { style: 'width:0%' }));
    const live = h('span', { class: 'muted' }, 'Accuracy 100% · 0 WPM');
    const mount = h('div', { class: 'typing-wrap' });
    wrap.append(h('a', { href: '#/learn', class: 'btn sm' }, '← All lessons'), h('div', { class: 'row spread', style: 'margin:1rem 0' }, h('div', {}, h('span', { class: 'pill' }, CATS.find(c => c.id === lesson.cat).title), h('h1', { style: 'font-size:clamp(1.8rem,4vw,2.6rem);margin-top:.5rem' }, lesson.title), h('p', { class: 'muted' }, lesson.desc + ` Reach ${lesson.goal}% accuracy to complete it.`)), prog && h('span', { class: 'pill' }, prog.done ? 'Completed ✓' : 'In progress')),
      h('div', { class: 'row spread' }, live, h('span', { class: 'muted' }, 'Progress')), bar, h('div', { style: 'height:.8rem' }), mount, guide, h('div', { style: 'text-align:center;overflow-x:auto' }, km.el));
    session = createTyping({
      mount, test: { words, limitMs: null, zen: false }, engineOpts: { zen: false, limitMs: null },
      onTarget: ch => {
        km.highlight(ch);
        if (!ch) return;
        const info = keyInfo(ch, settings.layout);
        guide.textContent = ch === ' ' ? 'Press the space bar with either thumb.' : `Press “${ch}” with your ${FINGER_NAMES[info.finger] || 'finger'}${info.shift ? ` while holding Shift with your ${info.finger < 5 ? 'right' : 'left'} pinky` : ''}.`;
      },
      onTick: (l, t) => { bar.firstChild.style.width = Math.round((l.words / total) * 100) + '%'; live.textContent = `Accuracy ${Math.round(l.acc)}% · ${Math.round(l.wpm)} WPM`; },
      onFinish: eng => finish(eng.summary())
    });
    session.focus();
  }
  function finish(s) {
    const acc = Math.round(s.accuracy * 10) / 10, wpm = Math.round(s.wpm), passed = acc >= lesson.goal;
    const all = progress(), old = all[lesson.id] || { attempts: 0, bestAcc: 0, bestWpm: 0, done: false };
    const firstDone = passed && !old.done;
    all[lesson.id] = { done: old.done || passed, bestAcc: Math.max(old.bestAcc, acc), bestWpm: Math.max(old.bestWpm, wpm), attempts: old.attempts + 1 };
    store.set('learn', all); requestSync();
    if (firstDone) {
      const cat = CATS.find(c => c.id === lesson.cat);
      if (cat.lessons.every(l => all[l.id] && all[l.id].done)) addNotif({ type: 'learning', title: 'Course complete: ' + cat.title, message: 'You finished every lesson in this course.', link: '/learn' });
      if (ALL.every(l => all[l.id] && all[l.id].done)) addNotif({ type: 'learning', title: 'Learn mode complete!', message: 'You finished every lesson. Achievement unlocked.', link: '/account' });
    }
    wrap.innerHTML = '';
    wrap.append(h('div', { class: 'result-hero' }, h('span', { class: passed ? 'pb-badge' : 'fail-badge' }, passed ? '✓ Lesson complete' : 'Not quite — try again'),
      h('div', { class: 'result-top' }, h('div', { class: 'big-wpm' }, wpm, h('small', {}, 'WPM')), h('div', { class: 'mini-stats' }, h('div', {}, h('b', {}, acc + '%'), h('span', {}, 'accuracy (goal ' + lesson.goal + '%)')), h('div', {}, h('b', {}, s.correctChars + '/' + s.incorrectChars), h('span', {}, 'correct / wrong letters')), h('div', {}, h('b', {}, Math.round(s.duration) + 's'), h('span', {}, 'time')), h('div', {}, h('b', {}, all[lesson.id].attempts), h('span', {}, 'attempts'))))),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn primary', onClick: start }, 'Retry'), next && h('button', { class: 'btn' + (passed ? ' blue' : ''), onClick: () => navigate('/learn?lesson=' + next.id) }, 'Next lesson'), h('a', { class: 'btn', href: '#/learn' }, 'All lessons')),
      !passed && h('p', { class: 'muted' }, 'Tip: slow down a little. Accuracy matters more than speed in lessons.'));
  }
  start();
  return () => session && session.destroy();
}

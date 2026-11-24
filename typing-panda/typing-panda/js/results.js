// Result building, validation, local storage, personal bests, XP, streaks and achievements.
import { store, uid, dayKey, toast } from './util.js';
import { settings } from './settings.js';
import { getWordset } from './textgen.js';
import { addNotif } from './notify.js';
import { ACHIEVEMENTS } from './data.js';
import { cloud } from './backend.js';

const r1 = n => Math.round(n * 10) / 10;

// Client-side sanity checks. The server (Firestore rules) repeats the important ones.
export function validate(r) {
  const flags = [];
  if (!(r.duration >= 1)) flags.push('too-short');
  if (r.wpm > 350 || r.rawWpm > 400) flags.push('impossible-speed');
  if (r.accuracy < 0 || r.accuracy > 100) flags.push('bad-accuracy');
  if (r.typedChars / Math.max(r.duration, 1) > 40) flags.push('too-many-chars');
  if (r.focusLoss > 0) flags.push('focus-lost');
  const ev = r.events || [];
  if (ev.length < r.correctKeys) flags.push('missing-events');
  if (ev.length > 25) {
    const gaps = []; for (let i = 1; i < ev.length; i++) gaps.push(ev[i][0] - ev[i - 1][0]);
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length);
    if (sd < 2) flags.push('robotic-timing');
  }
  let status = 'valid';
  if (r.funbox !== 'none') status = 'experimental';
  else if (r.mode === 'zen' || r.mode === 'custom') status = 'unranked';
  else if (flags.length) status = 'flagged';
  return { status, flags };
}

export function buildResult(engine, test, startedAt, focusLoss) {
  const s = engine.summary(), tl = s.timeline, st = settings;
  const ws = getWordset(st.wordset);
  const r = {
    id: uid(), createdAt: Date.now(), startedAt, endedAt: startedAt + Math.round(engine.endT),
    mode: st.mode, modeValue: test.modeValue, language: ws.lang === 'Code' ? ws.id : 'english', wordset: ws.id,
    difficulty: st.difficulty, punctuation: !!st.punctuation, numbers: !!st.numbers, funbox: st.funbox,
    wpm: r1(s.wpm), rawWpm: r1(s.rawWpm), accuracy: r1(s.accuracy), consistency: r1(s.consistency), burst: r1(s.burst),
    correctChars: s.correctChars, incorrectChars: s.incorrectChars, extraChars: s.extraChars, missedChars: s.missedChars,
    typedChars: s.typedChars, correctKeys: s.correctKeys, wrongKeys: s.wrongKeys, wordsDone: s.wordsDone, duration: r1(s.duration * 10) / 10,
    labels: tl.labels, wpmHistory: tl.wpm.map(r1), rawHistory: tl.raw.map(r1), errHistory: tl.err, accHistory: tl.acc.map(r1), burstHistory: s.burstHistory.map(r1),
    charStats: s.charStats,
    wordStats: s.wordStats.map(w => ({ i: w.i, target: w.target, typed: w.typed, ok: w.ok, wpm: r1(w.wpm) })),
    words: engine.words.slice(0, Math.min(engine.words.length, engine.wi + 8)), zen: !!test.zen,
    opts: { ...engine.o }, events: engine.events, endT: engine.endT,
    quote: test.quote ? { id: test.quote.id, author: test.quote.author, source: test.quote.source } : null,
    failed: engine.failed, focusLoss: focusLoss || 0, tags: [], personalBest: false
  };
  const v = validate(r);
  r.validationStatus = v.status; r.flags = v.flags;
  return r;
}

export const pbKey = r => [r.mode, r.modeValue, r.wordset, r.punctuation ? 'p' : '', r.numbers ? 'n' : ''].join('|');

// Returns which records were broken (and stores the new bests).
export function checkPB(r) {
  const out = { wpm: false, acc: false, consistency: false, burst: false, first: false };
  if (r.failed || r.funbox !== 'none' || r.duration < 5) return out;
  const all = store.get('pbs', {}), k = pbKey(r), b = all[k];
  if (!b) { all[k] = { wpm: r.wpm, acc: r.accuracy, consistency: r.consistency, burst: r.burst, at: r.createdAt }; out.first = true; out.wpm = true; }
  else {
    if (r.wpm > b.wpm) { out.wpm = true; b.wpm = r.wpm; b.at = r.createdAt; }
    if (r.accuracy > b.acc) { out.acc = true; b.acc = r.accuracy; }
    if (r.consistency > b.consistency) { out.consistency = true; b.consistency = r.consistency; }
    if (r.burst > b.burst) { out.burst = true; b.burst = r.burst; }
  }
  store.set('pbs', all);
  return out;
}
export const getPB = r => store.get('pbs', {})[pbKey(r)] || null;

export function getLocalResults() { return store.get('results', []); }
export function addLocalResult(r) {
  const list = getLocalResults();
  list.unshift(r);
  for (let i = 25; i < list.length; i++) { delete list[i].events; delete list[i].words; delete list[i].wordStats; delete list[i].charStats; }
  store.set('results', list.slice(0, 300));
}
export function updateLocalResult(id, patch) {
  const list = getLocalResults(); const x = list.find(r => r.id === id);
  if (x) { Object.assign(x, patch); store.set('results', list); }
}
export function deleteLocalResult(id) { store.set('results', getLocalResults().filter(r => r.id !== id)); }

function mergeCharStats(cs) {
  const all = store.get('charStats', {});
  for (const [c, v] of Object.entries(cs || {})) { const a = (all[c] = all[c] || { h: 0, m: 0, ms: 0, n: 0 }); a.h += v.h; a.m += v.m; a.ms += v.ms; a.n += v.n; }
  store.set('charStats', all);
}

// Full "finish a test" pipeline: validate -> records -> save locally -> save to cloud (queued if offline).
export async function saveFinishedResult(r) {
  r.personalBest = false;
  const pb = checkPB(r);
  r.personalBest = pb.wpm && !pb.first;
  mergeCharStats(r.charStats);
  if (!settings.saveResults || r.failed) return { pb, saved: false };
  addLocalResult(r);
  if (pb.wpm && !pb.first) addNotif({ type: 'pb', title: 'New personal best!', message: `${r.wpm} WPM in ${r.mode} ${r.modeValue || ''}`.trim(), link: '/account' });
  checkNewAchievements();
  if (cloud.user) uploadResult(r);
  return { pb, saved: true };
}

export async function uploadResult(r) {
  try { await cloud.saveResult(r); removePending(r.id); }
  catch (e) {
    addPending(r);
    if (e && e.code !== 'permission-denied') toast('Offline — result saved on this device and will upload later', 'err');
    else toast('Cloud save refused: ' + (e.message || e.code), 'err');
  }
}
const addPending = r => { const p = store.get('pending', []); if (!p.find(x => x.id === r.id)) { p.push(r); store.set('pending', p.slice(-20)); } };
const removePending = id => store.set('pending', store.get('pending', []).filter(x => x.id !== id));
export async function flushPending() {
  if (!cloud.user) return;
  for (const r of store.get('pending', [])) { try { await cloud.saveResult(r); removePending(r.id); } catch { break; } }
}

export async function loadAllResults() {
  if (cloud.user) { try { return await cloud.getResults(1000); } catch (e) { toast('Could not load cloud results: ' + (e.message || e), 'err'); } }
  return getLocalResults();
}

// ---------- statistics derived from stored results ----------
export const xpFor = r => Math.round(8 + r.duration * 0.4 + r.wpm * 0.15 + (r.accuracy >= 95 ? 8 : 0));
export const levelFromXp = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
export const xpForLevel = l => 40 * (l - 1) ** 2;

export function computeStats(results) {
  const ok = results.filter(r => !r.failed);
  const learn = store.get('learn', {});
  const lessonsDone = Object.values(learn).filter(x => x.done).length;
  const days = {};
  const off = (store.get('streakOffset', 0) || 0) * 3600e3;
  let xp = lessonsDone * 25;
  const s = { tests: ok.length, typingTime: 0, words: 0, chars: 0, bestWpm: 0, bestAcc: 0, bestConsistency: 0, bestBurst: 0, sumWpm: 0, bestAcc95: false, bestAcc99: false };
  for (const r of ok) {
    s.typingTime += r.duration; s.words += r.wordsDone || 0; s.chars += r.typedChars || 0; s.sumWpm += r.wpm;
    s.bestWpm = Math.max(s.bestWpm, r.wpm); s.bestAcc = Math.max(s.bestAcc, r.accuracy);
    s.bestConsistency = Math.max(s.bestConsistency, r.consistency || 0); s.bestBurst = Math.max(s.bestBurst, r.burst || 0);
    if (r.duration >= 15 && r.accuracy >= 95) s.bestAcc95 = true;
    if (r.duration >= 15 && r.accuracy >= 99) s.bestAcc99 = true;
    const k = dayKey(r.createdAt - off); (days[k] = days[k] || { tests: 0, time: 0, words: 0, xp: 0 });
    days[k].tests++; days[k].time += r.duration; days[k].words += r.wordsDone || 0; days[k].xp += xpFor(r);
    xp += xpFor(r);
  }
  s.avgWpm = s.tests ? s.sumWpm / s.tests : 0;
  s.days = days; s.xp = xp; s.level = levelFromXp(xp);
  const keys = Object.keys(days).sort();
  let longest = 0, run = 0, prev = null;
  for (const k of keys) {
    const d = new Date(k + 'T00:00:00');
    run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d;
  }
  let cur = 0; const t = new Date(Date.now() - off); t.setHours(0, 0, 0, 0);
  const d = new Date(t); if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]) { cur++; d.setDate(d.getDate() - 1); }
  s.currentStreak = cur; s.longestStreak = longest;
  s.learnComplete = lessonsDone >= 1 && store.get('learnTotal', 0) > 0 && lessonsDone >= store.get('learnTotal', 0);
  s.achievements = ACHIEVEMENTS.filter(a => a.check(s)).map(a => a.id);
  return s;
}

function checkNewAchievements() {
  const s = computeStats(getLocalResults());
  const known = store.get('ach', null);
  if (known === null) { store.set('ach', s.achievements); return; }
  for (const id of s.achievements) if (!known.includes(id)) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    addNotif({ type: 'achievement', title: 'Achievement unlocked: ' + a.name, message: a.desc, link: '/account' });
    toast('🏆 Achievement: ' + a.name);
  }
  store.set('ach', s.achievements);
}
export const levelInfo = () => { const s = computeStats(getLocalResults()); const lo = xpForLevel(s.level), hi = xpForLevel(s.level + 1); return { level: s.level, xp: s.xp, pct: Math.round(((s.xp - lo) / (hi - lo)) * 100) }; };

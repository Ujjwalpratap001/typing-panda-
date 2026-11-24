// Typing engine. No DOM here: it only consumes events {t, k, ch} and keeps state.
//   t  = milliseconds since the first keystroke (monotonic clock supplied by the caller)
//   k  = 'c' character, 's' space (commit word), 'b' backspace, 'w' delete whole word (Ctrl+Backspace)
// The same events can be replayed into a fresh engine, which is how Replay and the charts work.

const strip = c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const DEFAULT_OPTS = {
  zen: false, limitMs: null, stopOnError: 'off', confidence: 'off', freedom: false, strictSpace: false,
  quickEnd: false, lazy: false, failOn: null, minBurst: 0, maxExtra: 19
};

export class TypingEngine {
  constructor(words, opts = {}) {
    this.words = words;               // target words (array is shared so callers can append more)
    this.o = { ...DEFAULT_OPTS, ...opts };
    this.reset();
  }

  reset() {
    this.typed = []; this.cur = ''; this.wi = 0;
    this.started = false; this.ended = false; this.failed = null;
    this.events = [];
    this.correctKeys = 0; this.wrongKeys = 0;
    this.committedCorrect = 0; this.committedLen = 0;
    this.commitTs = []; this.wordMs = [];
    this.snaps = []; this.nextSec = 1; this.endT = 0;
    this._cs = {}; this.prevKeyT = null;
  }

  same(a, b) { return this.o.lazy ? strip(a) === strip(b) : a === b; }
  eq(a, b) { return this.o.lazy ? strip(a) === strip(b) : a === b; }
  prefixOk(typed, word) { return this.o.lazy ? strip(word).startsWith(strip(typed)) : word.startsWith(typed); }

  // ---- live numbers (cheap, O(1)) ----
  liveCorrect() {
    let c = this.committedCorrect;
    if (this.cur.length) {
      if (this.o.zen) c += this.cur.length;
      else { const w = this.words[this.wi]; if (w !== undefined && this.cur.length <= w.length && this.prefixOk(this.cur, w)) c += this.cur.length; }
    }
    return c;
  }
  liveTyped() { return this.committedLen + this.cur.length; }
  live(t) {
    const min = Math.max(t, 1) / 60000, k = this.correctKeys + this.wrongKeys;
    return { wpm: this.liveCorrect() / 5 / min, raw: this.liveTyped() / 5 / min, acc: k ? (this.correctKeys / k) * 100 : 100, errors: this.wrongKeys, words: this.wi, chars: this.liveTyped() };
  }

  snap(t) {
    while (this.nextSec * 1000 <= t) {
      this.snaps.push({ s: this.nextSec, c: this.liveCorrect(), r: this.liveTyped(), ek: this.wrongKeys, k: this.correctKeys + this.wrongKeys });
      this.nextSec++;
    }
  }

  // ---- the one entry point ----
  apply(ev) {
    if (this.ended) return false;
    if (!this.started) this.started = true;
    if (this.o.limitMs != null && ev.t >= this.o.limitMs) { this.finish(this.o.limitMs); return false; }
    this.snap(ev.t);
    let used = false;
    if (ev.k === 'c') used = this._char(ev);
    else if (ev.k === 's') used = this._space(ev);
    else if (ev.k === 'b') used = this._back(ev);
    else if (ev.k === 'w') used = this._wordDelete(ev);
    if (used) { this.events.push([ev.t, ev.k, ev.ch || '']); if (ev.k === 'c' || ev.k === 's') this.prevKeyT = ev.t; }
    return used;
  }

  _char(ev) {
    const zen = this.o.zen, w = zen ? null : this.words[this.wi];
    if (!zen && w === undefined) return false;
    const exp = zen ? undefined : w[this.cur.length];
    const ok = zen ? true : exp !== undefined && this.eq(ev.ch, exp);
    ev.e = zen ? ev.ch : (exp ?? ''); ev.ok = ok ? 1 : 0;
    if (ok) this.correctKeys++; else this.wrongKeys++;
    if (!zen && exp !== undefined) {
      const cs = (this._cs[exp] = this._cs[exp] || { h: 0, m: 0, ms: 0, n: 0 });
      if (ok) cs.h++; else cs.m++;
      const dt = this.prevKeyT == null ? null : ev.t - this.prevKeyT;
      if (dt != null && dt < 2000) { cs.ms += dt; cs.n++; }
    }
    if (!ok && this.o.stopOnError === 'letter') return true;                       // counted, not accepted
    if (!ok && exp === undefined && this.cur.length >= w.length + this.o.maxExtra) return true;
    this.cur += ev.ch;
    if (!ok && this.o.failOn === 'letter') { this.finish(ev.t, 'letter'); return true; }
    const last = !zen && this.o.limitMs == null && this.wi === this.words.length - 1;
    if (last && (this.cur === w || this.eq(this.cur, w) || (this.o.quickEnd && this.cur.length >= w.length))) {
      this._commit(ev.t, true);
      this.finish(ev.t);
    }
    return true;
  }

  _space(ev) {
    if (!this.cur.length) return false;                 // space on an empty word is ignored
    const zen = this.o.zen, w = zen ? '' : this.words[this.wi];
    if (!zen && w === undefined) return false;
    ev.e = ' ';
    if (!zen && this.o.strictSpace && this.cur.length < w.length) { this.wrongKeys++; ev.ok = 0; return true; }
    const ok = zen || this.same(this.cur, w);
    if (!ok && this.o.stopOnError === 'word') { this.wrongKeys++; ev.ok = 0; return true; }
    ev.ok = ok ? 1 : 0;
    if (ok) this.correctKeys++; else this.wrongKeys++;
    this._commit(ev.t, false);
    if (!ok && this.o.failOn === 'word') { this.finish(ev.t, 'word'); return true; }
    if (this.ended) return true;
    const ms = this.wordMs[this.wi - 1], len = this.typed[this.wi - 1].length;
    if (this.o.minBurst > 0 && ms > 0 && ((len + 1) / 5) / (ms / 60000) < this.o.minBurst) { this.finish(ev.t, 'burst'); return true; }
    if (!zen && this.o.limitMs == null && this.wi >= this.words.length) this.finish(ev.t);
    return true;
  }

  _commit(t, noSpace) {
    const zen = this.o.zen, w = zen ? this.cur : this.words[this.wi];
    const ok = zen || this.same(this.cur, w);
    this.typed[this.wi] = this.cur;
    this.committedLen += this.cur.length + (noSpace ? 0 : 1);
    if (ok) this.committedCorrect += w.length + (noSpace ? 0 : 1);
    const prev = this.wi > 0 ? this.commitTs[this.wi - 1] : 0;
    this.commitTs[this.wi] = t; this.wordMs[this.wi] = t - prev;
    this.cur = ''; this.wi++;
  }

  _back(ev) {
    const c = this.o.confidence;
    if (c === 'max') return false;
    if (this.cur.length) { this.cur = this.cur.slice(0, -1); return true; }
    if (this.wi === 0 || c === 'on' || this.o.zen) return false;
    const pt = this.typed[this.wi - 1], pw = this.words[this.wi - 1];
    if (!this.o.freedom && this.same(pt, pw)) return false;   // may only return to a wrong word
    this.wi--; this.cur = pt; this.typed.length = this.wi;
    this.committedLen -= pt.length + 1;
    if (this.same(pt, pw)) this.committedCorrect -= pw.length + 1;
    this.commitTs.length = this.wi; this.wordMs.length = this.wi;
    return true;
  }

  _wordDelete(ev) {
    if (this.o.confidence === 'max' || !this.cur.length) return false;
    this.cur = ''; return true;
  }

  finish(t, failReason) {
    if (this.ended) return;
    this.snap(t);
    this.ended = true; this.endT = Math.max(t, 1);
    if (failReason) this.failed = failReason;
    const s = this.endT / 1000, last = this.snaps[this.snaps.length - 1];
    if (!last || s - last.s > 0.05) this.snaps.push({ s, c: this.liveCorrect(), r: this.liveTyped(), ek: this.wrongKeys, k: this.correctKeys + this.wrongKeys });
  }

  // ---- final analysis ----
  summary() {
    const T = this.endT / 1000, min = T / 60;
    const correct = this.liveCorrect(), typedLen = this.liveTyped();
    const keys = this.correctKeys + this.wrongKeys;
    let cc = 0, ic = 0, xc = 0, mc = 0;
    const wordStats = [];
    const upto = this.wi + (this.cur.length ? 1 : 0);
    for (let i = 0; i < upto; i++) {
      const committed = i < this.wi;
      const typed = committed ? this.typed[i] : this.cur;
      const w = this.o.zen ? typed : (this.words[i] ?? '');
      for (let k = 0; k < Math.min(typed.length, w.length); k++) (this.eq(typed[k], w[k]) ? cc++ : ic++);
      if (typed.length > w.length) xc += typed.length - w.length;
      if (committed && typed.length < w.length) mc += w.length - typed.length;
      const ms = this.wordMs[i];
      wordStats.push({ i, target: w, typed, ok: this.same(typed, w), ms: committed ? ms : 0, wpm: committed && ms > 0 ? ((typed.length + 1) / 5) / (ms / 60000) : 0 });
    }
    const tl = this.timeline();
    const bursts = wordStats.filter(x => x.wpm > 0).map(x => x.wpm);
    return {
      duration: T,
      wpm: correct / 5 / min, rawWpm: typedLen / 5 / min,
      accuracy: keys ? (this.correctKeys / keys) * 100 : 0,
      consistency: consistency(tl.raw.filter((_, i) => tl.dt[i] >= 0.99)),
      burst: bursts.length ? Math.max(...bursts) : correct / 5 / min,
      correctChars: cc, incorrectChars: ic, extraChars: xc, missedChars: mc, typedChars: typedLen,
      correctKeys: this.correctKeys, wrongKeys: this.wrongKeys, wordsDone: this.wi,
      wordStats, charStats: this.charStats(), timeline: tl, burstHistory: wordStats.map(x => x.wpm)
    };
  }

  timeline() {
    const out = { labels: [], wpm: [], raw: [], err: [], acc: [], dt: [] };
    let pr = 0, pe = 0, pk = 0, ps = 0, pc = 0;
    for (const sn of this.snaps) {
      const dt = sn.s - ps; if (dt <= 0) continue;
      out.labels.push(+sn.s.toFixed(2)); out.dt.push(dt);
      out.wpm.push(sn.c / 5 / (sn.s / 60));
      out.raw.push((sn.r - pr) / 5 / (dt / 60));
      out.err.push(sn.ek - pe);
      out.acc.push(sn.k ? ((sn.k - sn.ek) / sn.k) * 100 : 100);
      pr = sn.r; pe = sn.ek; pk = sn.k; ps = sn.s; pc = sn.c;
    }
    return out;
  }

  charStats() { return this._cs; }
}

// Kogasa-style consistency: 100 when speed is perfectly steady, lower with variation.
export function consistency(vals) {
  const v = vals.filter(x => Number.isFinite(x));
  if (v.length < 2) return 100;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (mean <= 0) return 0;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const cv = sd / mean;
  return Math.max(0, Math.min(100, 100 * (1 - Math.tanh(cv + cv ** 3 / 3 + cv ** 5 / 5))));
}

// Build a fresh engine from a saved result and replay events up to time t (ms).
// endT is the recorded end time, so a replay of a finished test finishes at the same moment.
export function replayEngine(words, opts, events, t = Infinity, endT = null) {
  const e = new TypingEngine(words.slice(), { ...opts });
  for (const [et, k, ch] of events) { if (et > t) break; e.apply({ t: et, k, ch }); if (e.ended) break; }
  if (!e.ended) {
    const end = endT ?? opts.limitMs;
    if (end != null && t >= end) e.finish(end);
  }
  return e;
}

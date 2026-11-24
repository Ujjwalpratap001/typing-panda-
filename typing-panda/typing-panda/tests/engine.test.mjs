import { TypingEngine, replayEngine, consistency } from '../js/engine.js';
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL',m)} else console.log('ok  ',m) };
function type(e, str, t0=0, step=200){ let t=t0; for(const ch of str){ e.apply({t, k: ch===' '?'s':ch==='<'?'b':'c', ch}); t+=step; } return t; }
// 1 perfect words test: "hello world" typed in 3.0s => 11 chars with no trailing space => (11)/5 /(t/60)
let e=new TypingEngine(['hello','world']); let t=type(e,'hello world',0,300);
ok(e.ended,'words test ends at last letter'); const s=e.summary();
ok(s.accuracy===100,'accuracy 100'); ok(Math.abs(s.wpm - (11/5)/((10*300)/60000))<0.01,'wpm formula '+s.wpm.toFixed(2)); ok(Math.abs(s.wpm-s.rawWpm)<1e-9,'raw==wpm when perfect');
ok(s.correctChars===10 && s.incorrectChars===0,'char counts');
// 2 errors + backspace
e=new TypingEngine(['cat','dog']); type(e,'cx<at dog',0,100);
const s2=e.summary(); ok(e.ended,'ended'); ok(s2.wrongKeys===1 && s2.correctKeys>=6,'wrong keys counted once: '+s2.wrongKeys); ok(s2.accuracy<100,'acc<100');
// 3 extra and missing chars
e=new TypingEngine(['cat','dog','end']); type(e,'catss do end',0,100); const s3=e.summary();
ok(s3.extraChars===2,'extra chars '+s3.extraChars); ok(s3.missedChars===1,'missed chars '+s3.missedChars);
// 4 stop on letter
e=new TypingEngine(['abc'],{stopOnError:'letter'}); type(e,'axbc',0,100); ok(e.ended && e.summary().incorrectChars===0,'stopOnLetter ignores wrong letter');
// 5 expert fail
e=new TypingEngine(['abc','def'],{failOn:'word'}); type(e,'abx ',0,100); ok(e.failed==='word','expert fails on wrong word');
// 6 time mode ends at limit
e=new TypingEngine(Array(50).fill('abcde'),{limitMs:5000}); let tt=0; for(let i=0;i<100&&!e.ended;i++){ for(const ch of 'abcde'){e.apply({t:tt,k:'c',ch}); tt+=100;} e.apply({t:tt,k:'s',ch:' '}); tt+=100; }
ok(e.ended && e.endT===5000,'time test ends at limit '+e.endT); const s6=e.summary(); ok(s6.timeline.wpm.length===5,'5 timeline points '+s6.timeline.wpm.length);
ok(Math.abs(s6.wpm-120)<8,'wpm plausible '+s6.wpm.toFixed(1));
// 7 replay is deterministic
const r=replayEngine(e.words,{limitMs:5000},e.events,Infinity,e.endT); const sr=r.summary(); ok(Math.abs(sr.wpm-s6.wpm)<1e-9 && sr.accuracy===s6.accuracy,'replay gives same wpm/acc');
// 8 backspace to previous wrong word
e=new TypingEngine(['abc','def','ghi']); type(e,'abx <<c def',0,100); // after 'abx ' go back, delete x, type c
ok(e.typed[0]==='abc','went back and fixed word: '+JSON.stringify(e.typed));
// 9 confidence max
e=new TypingEngine(['abc','def'],{confidence:'max'}); type(e,'ab<c',0,100); ok(e.cur==='abc'||e.cur==='abc','no backspace in max');
// 10 zen
e=new TypingEngine([],{zen:true}); type(e,'hi there',0,200); e.finish(2000); const sz=e.summary(); ok(sz.accuracy===100 && sz.wordsDone===1 && sz.typedChars===8,'zen words '+sz.wordsDone);
// 11 consistency
ok(consistency([50,50,50,50])>99,'steady consistency'); ok(consistency([10,90,10,90])<50,'erratic lower');
// 12 strict space
e=new TypingEngine(['abc','def'],{strictSpace:true}); type(e,'ab ',0,100); ok(e.wi===0 && e.wrongKeys===1,'strict space rejects early space');
// 13 charstats
e=new TypingEngine(['cat']); type(e,'cxt',0,100); ok(e._cs.a && e._cs.a.m===1,'char stat miss on a');
console.log(fails?('FAILS: '+fails):'ALL PASSED');

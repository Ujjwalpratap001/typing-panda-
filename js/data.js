// Typing content: wordsets, code snippets, quotes, funbox list, achievements.
const W = s => s.split(/\s+/).filter(Boolean);

export const COMMON = W(`the be of and a to in he have it that for they I with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line city put close case force meet once water upon war build hear light unite live every country bring center let side try provide continue name certain power pay result question study woman member until far night always service away report something company week church toward start social room figure nature though young less enough almost read include president nothing yet better big boy cost business value second why clear expect family complete act sense mind experience art next near direct car law industry important girl god several matter usual rather per often kind among white reason action return foot care simple within love human along appear doctor believe speak active student month drive concern best door hope example inform body ever least probable understand reach effect different idea whole control condition field pass fall note special talk particular today measure walk teach low hour type carry rate remain full street easy although record sit determine level local sure receive thus moment spirit train college religion perhaps music grow free cause serve age book board recent sound office cut step class true history position above strong friend necessary add court deal tax support party whether land material happen education death agree arm mother across quite anything town past view society manage answer break organize half fire lose money stop actual already effort wait department European`).slice(0, 300).map(w => w.toLowerCase());

export const ADVANCED = W(`abandon ambiguous analogy arbitrary articulate benevolent bureaucracy candid catalyst cognitive coherent compelling concise conscientious contemplate controversy conventional credible criterion cumulative deliberate delegate diligent discrepancy dormant eloquent empirical enigma ephemeral equilibrium erratic exemplify exquisite facilitate fluctuate formidable fundamental gravity hypothesis illuminate imminent implicit inevitable ingenious innovative integrity intricate intuition jurisdiction juxtapose kinetic lucid magnitude meticulous nuance obsolete ominous optimal paradigm paradox perpetual pragmatic prerogative profound prolific proximity quantum rationale reciprocal redundant resilient rigorous scrutiny skeptical spontaneous stringent substantial succinct surplus synthesis tangible tenacious theoretical trajectory transient ubiquitous unanimous undermine unprecedented vague validate versatile vigilant volatile whimsical zealous aesthetic algorithm altruism ambivalent anomaly apparatus archetype autonomy bias capacity chronicle circumstance clarity compassion complexity compromise consensus consistent constraint context convergence correlation criterion curiosity dilemma discipline diversity dynamic efficiency elaborate elusive emphasis encounter endeavor entity essence evolve exceed explicit flexible framework generate genuine harmony heritage hierarchy horizon identity immense impulse inclusive inference inherent initiative insight instinct interpret isolate legitimate leverage logic mechanism mentor mindset momentum motive narrative navigate neutral objective obstacle orientation outcome overcome parallel patience perception perspective phenomenon potential precision principle priority proficiency progress prospect protocol rational reflect refine reliable resolve resource response restore revolution sequence significant sophisticated strategy structure sustain symbol tension threshold tradition transform transparent ultimate utilize vision wisdom`);

export const CODE = {
  javascript: W('const let var function return if else for while switch case break continue class extends import export default async await try catch throw new this typeof null undefined true false => console.log() arr.map(x=>x*2) obj.key [1,2,3] {a:1} ===  !== && || ?? `${name}` JSON.parse() Promise.all() document.querySelector() setTimeout() fetch(url)'),
  typescript: W('interface type enum readonly private public protected abstract implements namespace declare keyof typeof string number boolean unknown any never void Promise<void> Array<string> Record<string,number> x:number y?:string as<T> <T>(a:T)=>a import type export const let function return generic union |&'),
  python: W('def return if elif else for while in range() print() import from as class self __init__ lambda try except finally raise with open() len() list() dict() set() True False None and or not is pass yield async await [x for x in items] {k:v} f"{name}" enumerate() zip() sorted() input() str() int()'),
  java: W('public private protected static void main String[] args int double boolean class interface extends implements new return if else for while switch case break try catch finally throw System.out.println() ArrayList<String> HashMap<K,V> @Override import java.util.*; final abstract this super null true false'),
  cpp: W('#include <iostream> using namespace std; int main() { return 0; } cout << cin >> endl; vector<int> string const auto for(int i=0;i<n;i++) while if else class struct public: private: template<typename T> new delete nullptr std::map<K,V> void bool ::'),
  c: W('#include <stdio.h> int main(void) { return 0; } printf("%d\\n",x); scanf("%d",&n); char* int float double struct typedef void sizeof malloc() free() NULL for(i=0;i<n;i++) while if else switch case break continue const static #define'),
  html: W('<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <title></title> <body> <div class="box"> <p> <a href="#"> <img src="" alt=""> <ul> <li> <h1> <section> <button> <form> <input type="text"> <script src=""> </div> </body> </html>'),
  css: W('display:flex; justify-content:center; align-items:center; margin:0; padding:1rem; color:#fff; background:#000; font-size:16px; border-radius:8px; .card{} #app{} @media(max-width:600px){} grid-template-columns:1fr; position:relative; transition:all .2s; :hover ::after var(--main) calc(100%-2rem) !important'),
  sql: W('SELECT * FROM users WHERE id=1; INSERT INTO t VALUES (); UPDATE t SET a=1; DELETE FROM t; CREATE TABLE t (id INT PRIMARY KEY); JOIN ON GROUP BY ORDER BY LIMIT 10 HAVING COUNT(*) DISTINCT LEFT INNER AS AND OR NOT NULL LIKE IN BETWEEN ALTER DROP INDEX'),
  rust: W('fn main() { let mut x = 5; println!("{}", x); } struct enum impl trait pub use mod match Some(x) None Ok(()) Err(e) &str String Vec<i32> Option<T> Result<T,E> &mut loop while for in return -> unsafe async await .unwrap() ?'),
  go: W('package main import "fmt" func main() { fmt.Println("hi") } var x int := for range if else switch case return struct interface map[string]int []byte chan go defer select make() len() append() error nil true false := <- type'),
  php: W('<?php echo $name; ?> function return if else foreach while class public private static new $this-> array() => isset() empty() require_once include namespace use try catch throw null true false $_POST $_GET .= != === count() strlen() json_encode()'),
  csharp: W('using System; namespace App { class Program { static void Main(string[] args) { Console.WriteLine("hi"); } } } public private static void int string bool var new return if else foreach for while List<int> Dictionary<K,V> async await Task get; set; null true false => ?. ??')
};

export const WORDSETS = [
  { id: 'common', name: 'English — common 300', lang: 'English', desc: 'The most frequent English words. Best for everyday speed.', words: COMMON },
  { id: 'advanced', name: 'English — advanced', lang: 'English', desc: 'Longer, harder vocabulary for building accuracy.', words: ADVANCED },
  ...Object.entries(CODE).map(([id, words]) => ({ id: 'code-' + id, name: 'Code — ' + ({ cpp: 'C++', csharp: 'C#', html: 'HTML', css: 'CSS', sql: 'SQL', php: 'PHP', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', c: 'C', rust: 'Rust', go: 'Go' }[id]), lang: 'Code', desc: 'Keywords, symbols and short snippets (no spaces inside a token).', words }))
];

export const BRITISH = { color: 'colour', colors: 'colours', honor: 'honour', favorite: 'favourite', center: 'centre', organize: 'organise', realize: 'realise', recognize: 'recognise', analyze: 'analyse', defense: 'defence', labor: 'labour', neighbor: 'neighbour', program: 'programme', theater: 'theatre', gray: 'grey', behavior: 'behaviour', license: 'licence', catalog: 'catalogue', endeavor: 'endeavour', utilize: 'utilise', fulfill: 'fulfil', organization: 'organisation', travel: 'travel', mold: 'mould', plow: 'plough' };

const Q = (id, text, author, source) => ({ id, text, author, source, language: 'english', approvalStatus: 'approved', tags: [] });
export const QUOTES = [
  Q('q1', 'The only thing we have to fear is fear itself.', 'Franklin D. Roosevelt', 'First Inaugural Address, 1933'),
  Q('q2', 'I think, therefore I am.', 'René Descartes', 'Principles of Philosophy'),
  Q('q3', 'To be, or not to be, that is the question.', 'William Shakespeare', 'Hamlet'),
  Q('q4', 'Well done is better than well said.', 'Benjamin Franklin', "Poor Richard's Almanack"),
  Q('q5', 'The journey of a thousand miles begins with a single step.', 'Lao Tzu', 'Tao Te Ching'),
  Q('q6', 'Knowledge is power.', 'Francis Bacon', 'Meditationes Sacrae'),
  Q('q7', 'Premature optimization is the root of all evil.', 'Donald Knuth', 'Structured Programming with go to Statements'),
  Q('q8', 'Talk is cheap. Show me the code.', 'Linus Torvalds', 'Linux kernel mailing list, 2000'),
  Q('q9', 'Programs must be written for people to read, and only incidentally for machines to execute.', 'Harold Abelson', 'Structure and Interpretation of Computer Programs'),
  Q('q10', 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', 'Martin Fowler', 'Refactoring'),
  Q('q11', 'The best way to predict the future is to invent it.', 'Alan Kay', 'Xerox PARC, 1971'),
  Q('q12', 'When you have eliminated the impossible, whatever remains, however improbable, must be the truth.', 'Arthur Conan Doyle', 'The Sign of the Four'),
  Q('q13', 'To be great is to be misunderstood.', 'Ralph Waldo Emerson', 'Self-Reliance'),
  Q('q14', 'Happy families are all alike; every unhappy family is unhappy in its own way.', 'Leo Tolstoy', 'Anna Karenina (trans. Constance Garnett)'),
  Q('q15', 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', 'Jane Austen', 'Pride and Prejudice'),
  Q('q16', 'All the world\'s a stage, and all the men and women merely players; they have their exits and their entrances, and one man in his time plays many parts.', 'William Shakespeare', 'As You Like It'),
  Q('q17', 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.', 'Charles Dickens', 'A Tale of Two Cities'),
  Q('q18', 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.', 'Abraham Lincoln', 'Gettysburg Address, 1863'),
  Q('q19', 'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.', 'Thomas Jefferson', 'Declaration of Independence, 1776'),
  Q('q20', 'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.', 'Herman Melville', 'Moby-Dick'),
  Q('q21', 'Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live.', 'Abraham Lincoln', 'Gettysburg Address, 1863'),
  Q('q22', 'We shall defend our island, whatever the cost may be, we shall fight on the beaches, we shall fight on the landing grounds, we shall fight in the fields and in the streets, we shall fight in the hills; we shall never surrender.', 'Winston Churchill', 'House of Commons, 4 June 1940')
];
export const quoteLen = q => q.text.length < 100 ? 'short' : q.text.length < 200 ? 'medium' : q.text.length < 300 ? 'long' : 'very long';

export const FUNBOX = [
  { id: 'none', name: 'Off', desc: 'Normal typing test.' },
  { id: 'allcaps', name: 'ALL CAPS', desc: 'Every word in capital letters.' },
  { id: 'sponge', name: 'Sponge case', desc: 'rAnDoM cAsE letters inside each word.' },
  { id: 'reversed', name: 'Reversed words', desc: 'Each word is spelled backwards.' },
  { id: 'doubled', name: 'Double letters', desc: 'Every letter appears twice (hheelllloo).' },
  { id: 'numbers', name: 'Numbers only', desc: 'Random numbers instead of words.' },
  { id: 'binary', name: 'Binary', desc: 'Eight-digit binary words.' },
  { id: 'hex', name: 'Hexadecimal', desc: 'Random hex strings.' },
  { id: 'ipv4', name: 'IPv4', desc: 'Random IPv4 addresses.' },
  { id: 'ipv6', name: 'IPv6', desc: 'Random IPv6 addresses.' },
  { id: 'morse', name: 'Morse code', desc: 'Words converted to dots and dashes.' },
  { id: 'special', name: 'Special characters', desc: 'Words wrapped in symbols like #, @, $.' },
  { id: 'weakspots', name: 'Weak spots', desc: 'Words built around the letters you miss most (uses your history).' },
  { id: 'mirror', name: 'Mirror', desc: 'The text area is flipped horizontally.' },
  { id: 'upside', name: 'Upside down', desc: 'The text area is rotated 180°.' },
  { id: 'limited', name: 'Limited visibility', desc: 'Only the current word is visible.' },
  { id: 'memory', name: 'Memory', desc: 'Words vanish as soon as you start typing.' },
  { id: 'earthquake', name: 'Earthquake', desc: 'The text shakes while you type.' }
];

export const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..' };

export const ACHIEVEMENTS = [
  { id: 'first', name: 'First test', desc: 'Complete 1 test.', check: s => s.tests >= 1 },
  { id: 'w30', name: '30 WPM', desc: 'Reach 30 WPM in a test.', check: s => s.bestWpm >= 30 },
  { id: 'w50', name: '50 WPM', desc: 'Reach 50 WPM in a test.', check: s => s.bestWpm >= 50 },
  { id: 'w75', name: '75 WPM', desc: 'Reach 75 WPM in a test.', check: s => s.bestWpm >= 75 },
  { id: 'w100', name: '100 WPM', desc: 'Reach 100 WPM in a test.', check: s => s.bestWpm >= 100 },
  { id: 'a95', name: 'Sharp 95%', desc: '95% accuracy in a test of 15s+.', check: s => s.bestAcc95 },
  { id: 'a99', name: 'Precision 99%', desc: '99% accuracy in a test of 15s+.', check: s => s.bestAcc99 },
  { id: 's7', name: '7-day streak', desc: 'Practise 7 days in a row.', check: s => s.longestStreak >= 7 },
  { id: 's30', name: '30-day streak', desc: 'Practise 30 days in a row.', check: s => s.longestStreak >= 30 },
  { id: 't100', name: '100 tests', desc: 'Complete 100 tests.', check: s => s.tests >= 100 },
  { id: 't1000', name: '1,000 tests', desc: 'Complete 1,000 tests.', check: s => s.tests >= 1000 },
  { id: 'course', name: 'Course complete', desc: 'Finish every Learn lesson.', check: s => s.learnComplete }
];

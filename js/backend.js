// Firebase wrapper. If firebase-config.js is empty, `cloud.enabled` is false and every page
// falls back to local (guest) behaviour. Nothing here ever pretends to work when unconfigured.
import { firebaseConfig } from './firebase-config.js';
import { store } from './util.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;
let A, F, auth, db;
const listeners = new Set();

export const cloud = {
  enabled: !!(firebaseConfig.apiKey && firebaseConfig.projectId),
  user: null, profile: null, details: null, error: null, ready: null,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach(fn => fn()); }
};
const need = () => { if (!cloud.enabled) throw new Error('Cloud features are not configured yet (see README: Firebase setup).'); if (!db) throw new Error('Cloud is still loading — try again in a moment.'); };
const needUser = () => { need(); if (!cloud.user) throw new Error('Please sign in first.'); return cloud.user.uid; };
const lower = s => String(s).toLowerCase();
export const validUsername = u => /^[a-zA-Z0-9_]{3,20}$/.test(u);
const ms = t => (t && t.toMillis ? t.toMillis() : t || 0);
const clean = o => JSON.parse(JSON.stringify(o));

async function loadProfile() {
  const uid = cloud.user.uid;
  const snap = await F.getDoc(F.doc(db, 'users', uid));
  cloud.profile = snap.exists() ? snap.data() : null;
  cloud.details = null;
  if (cloud.profile) { const d = await F.getDoc(F.doc(db, 'profileDetails', uid)); cloud.details = d.exists() ? d.data() : {}; }
}

async function init() {
  if (!cloud.enabled) return;
  const [appM, authM, fsM] = await Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-firestore.js')]);
  A = authM; F = fsM;
  const app = appM.initializeApp(firebaseConfig);
  auth = A.getAuth(app); db = F.getFirestore(app);
  await new Promise(res => {
    let first = true;
    A.onAuthStateChanged(auth, async u => {
      cloud.user = u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified, displayName: u.displayName, providers: u.providerData.map(p => p.providerId) } : null;
      cloud.profile = null;
      try { if (u) await loadProfile(); } catch (e) { console.error(e); cloud.error = e; }
      cloud.emit();
      if (first) { first = false; res(); }
    });
  });
}
cloud.ready = init().catch(e => { console.error('Firebase failed to load', e); cloud.error = e; cloud.enabled = false; });

// ---------------- authentication ----------------
cloud.checkUsername = async name => {
  need(); if (!validUsername(name)) return false;
  return !(await F.getDoc(F.doc(db, 'usernames', lower(name)))).exists();
};
async function createProfile(username, displayName) {
  const uid = needUser(), lc = lower(username);
  if (!validUsername(username)) throw new Error('Username must be 3–20 letters, numbers or underscores.');
  await F.runTransaction(db, async tx => {
    const ref = F.doc(db, 'usernames', lc);
    if ((await tx.get(ref)).exists()) throw new Error('That username is taken.');
    tx.set(ref, { uid });
    tx.set(F.doc(db, 'users', uid), { username, usernameLower: lc, displayName: displayName || username, createdAt: F.serverTimestamp(), publicProfile: true, showActivity: true, leaderboardOptOut: false });
  });
  await loadProfile(); cloud.emit();
}
cloud.createProfile = createProfile;
cloud.signUp = async (email, pw, username, displayName) => {
  need();
  if (!(await cloud.checkUsername(username))) throw new Error('That username is not available.');
  const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
  try { await A.updateProfile(cred.user, { displayName: displayName || username }); } catch { /* not critical */ }
  cloud.user = { uid: cred.user.uid, email, emailVerified: false, displayName, providers: ['password'] };
  await createProfile(username, displayName);
  try { await A.sendEmailVerification(cred.user); } catch { /* not critical */ }
};
cloud.signIn = async (email, pw) => { need(); await A.signInWithEmailAndPassword(auth, email, pw); };
cloud.signInProvider = async name => { need(); await A.signInWithPopup(auth, name === 'google' ? new A.GoogleAuthProvider() : new A.GithubAuthProvider()); };
cloud.linkProvider = async name => { needUser(); await A.linkWithPopup(auth.currentUser, name === 'google' ? new A.GoogleAuthProvider() : new A.GithubAuthProvider()); cloud.user.providers = auth.currentUser.providerData.map(p => p.providerId); cloud.emit(); };
cloud.unlinkProvider = async id => { needUser(); if (auth.currentUser.providerData.length < 2) throw new Error('You need at least one sign-in method.'); await A.unlink(auth.currentUser, id); cloud.user.providers = auth.currentUser.providerData.map(p => p.providerId); cloud.emit(); };
cloud.reset = async email => { need(); await A.sendPasswordResetEmail(auth, email); };
cloud.resendVerification = async () => { needUser(); await A.sendEmailVerification(auth.currentUser); };
cloud.signOut = async () => { need(); await A.signOut(auth); };
cloud.changePassword = async (oldPw, newPw) => { needUser(); const u = auth.currentUser; await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, oldPw)); await A.updatePassword(u, newPw); };
cloud.changeEmail = async (pw, email) => { needUser(); const u = auth.currentUser; await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, pw)); await A.verifyBeforeUpdateEmail(u, email); };
cloud.errText = e => {
  const m = { 'auth/invalid-credential': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.', 'auth/wrong-password': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account.', 'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'That email address looks invalid.', 'auth/popup-closed-by-user': 'Sign-in window was closed.', 'auth/too-many-requests': 'Too many attempts. Try again later.', 'auth/network-request-failed': 'Network error. Check your connection.', 'auth/requires-recent-login': 'For safety, sign out and sign in again, then retry.', 'auth/account-exists-with-different-credential': 'This email already uses a different sign-in method.', 'permission-denied': 'Permission denied by security rules.' };
  return m[e.code] || e.message || 'Something went wrong.';
};

// ---------------- profile ----------------
cloud.updateProfile = async ({ displayName, bio, social, keyboard, publicProfile, showActivity, leaderboardOptOut }) => {
  const uid = needUser();
  const main = clean({ displayName, publicProfile, showActivity, leaderboardOptOut });
  await F.updateDoc(F.doc(db, 'users', uid), main);
  await F.setDoc(F.doc(db, 'profileDetails', uid), clean({ bio: (bio || '').slice(0, 300), social: social || {}, keyboard: (keyboard || '').slice(0, 80) }));
  await loadProfile(); cloud.emit();
};
cloud.changeUsername = async newName => {
  const uid = needUser(), old = cloud.profile.usernameLower, lc = lower(newName);
  if (!validUsername(newName)) throw new Error('Username must be 3–20 letters, numbers or underscores.');
  if (lc === old) { await F.updateDoc(F.doc(db, 'users', uid), { username: newName }); await loadProfile(); return cloud.emit(); }
  await F.runTransaction(db, async tx => {
    const nref = F.doc(db, 'usernames', lc);
    if ((await tx.get(nref)).exists()) throw new Error('That username is taken.');
    tx.set(nref, { uid }); tx.delete(F.doc(db, 'usernames', old));
    tx.update(F.doc(db, 'users', uid), { username: newName, usernameLower: lc });
  });
  await loadProfile(); cloud.emit();
};
cloud.getPublicProfile = async username => {
  need();
  const q = await F.getDocs(F.query(F.collection(db, 'users'), F.where('usernameLower', '==', lower(username)), F.limit(1)));
  if (q.empty) return null;
  const u = { uid: q.docs[0].id, ...q.docs[0].data() };
  u.createdAt = ms(u.createdAt);
  if (u.publicProfile) { try { const d = await F.getDoc(F.doc(db, 'profileDetails', u.uid)); u.details = d.exists() ? d.data() : {}; } catch { u.details = {}; } }
  return u;
};
cloud.searchUsers = async prefix => {
  need(); const p = lower(prefix);
  const q = await F.getDocs(F.query(F.collection(db, 'users'), F.where('usernameLower', '>=', p), F.where('usernameLower', '<=', p + '\uf8ff'), F.limit(8)));
  return q.docs.map(d => ({ uid: d.id, ...d.data() }));
};

// ---------------- results ----------------
cloud.saveResult = async r => {
  const uid = needUser();
  if (!cloud.profile) throw new Error('Finish creating your profile before saving results.');
  const { events, words, opts, charStats, ...rest } = r;
  const doc = clean({ ...rest, charStats: JSON.stringify(charStats || {}), userId: uid, username: cloud.profile.username, public: !cloud.profile.leaderboardOptOut, clientCreatedAt: r.createdAt });
  doc.createdAt = F.serverTimestamp();
  await F.setDoc(F.doc(db, 'results', r.id), doc);                       // same id => retrying never duplicates
  await F.setDoc(F.doc(db, 'resultEvents', r.id), { userId: uid, data: JSON.stringify({ events, words, opts, endT: r.endT }) });
};
const fromDoc = d => { const x = { ...d.data(), id: d.id }; x.createdAt = ms(x.createdAt) || x.clientCreatedAt; try { x.charStats = JSON.parse(x.charStats || '{}'); } catch { x.charStats = {}; } return x; };
cloud.getResults = async (n = 500) => {
  const uid = needUser();
  const q = await F.getDocs(F.query(F.collection(db, 'results'), F.where('userId', '==', uid), F.orderBy('createdAt', 'desc'), F.limit(n)));
  return q.docs.map(fromDoc);
};
cloud.getResultEvents = async id => { need(); const d = await F.getDoc(F.doc(db, 'resultEvents', id)); return d.exists() ? JSON.parse(d.data().data) : null; };
cloud.deleteResult = async id => { needUser(); await F.deleteDoc(F.doc(db, 'results', id)); try { await F.deleteDoc(F.doc(db, 'resultEvents', id)); } catch { /* ignore */ } };
cloud.setTags = async (id, tags) => { needUser(); await F.updateDoc(F.doc(db, 'results', id), { tags: tags.slice(0, 8) }); };
cloud.getUserPublicResults = async uid => {
  need();
  const q = await F.getDocs(F.query(F.collection(db, 'results'), F.where('userId', '==', uid), F.where('public', '==', true), F.limit(500)));
  return q.docs.map(fromDoc).sort((a, b) => b.createdAt - a.createdAt);
};

// ---------------- leaderboards (server-side filtering; best result per user) ----------------
cloud.getLeaderboard = async ({ period, mode, value, language, friendsOnly, limit = 100 }) => {
  need();
  const C = F.collection(db, 'results');
  let docs;
  if (friendsOnly) {
    const uid = needUser(), ids = (await cloud.getFriends()).friends.map(f => f.uid); ids.push(uid);
    const q = await F.getDocs(F.query(C, F.where('userId', 'in', ids.slice(0, 30)), F.where('validationStatus', '==', 'valid'), F.where('public', '==', true), F.limit(500)));
    docs = q.docs.map(fromDoc).filter(r => r.mode === mode && String(r.modeValue) === String(value) && r.language === language);
  } else {
    const eq = [F.where('validationStatus', '==', 'valid'), F.where('public', '==', true), F.where('mode', '==', mode), F.where('modeValue', '==', isNaN(value) ? value : Number(value)), F.where('language', '==', language)];
    if (period === 'alltime') docs = (await F.getDocs(F.query(C, ...eq, F.orderBy('wpm', 'desc'), F.limit(500)))).docs.map(fromDoc);
    else {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      if (period === 'weekly') since.setDate(since.getDate() - ((since.getDay() + 6) % 7));
      docs = (await F.getDocs(F.query(C, ...eq, F.where('createdAt', '>=', since), F.limit(500)))).docs.map(fromDoc);
    }
  }
  docs.sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
  const seen = new Set(), best = [];
  for (const r of docs) if (!seen.has(r.userId)) { seen.add(r.userId); best.push(r); }
  return best.slice(0, limit);
};

// ---------------- friends ----------------
const pair = (a, b) => [a, b].sort().join('_');
cloud.getFriends = async () => {
  const uid = needUser();
  const q = await F.getDocs(F.query(F.collection(db, 'friends'), F.where('users', 'array-contains', uid)));
  const out = { friends: [], incoming: [], outgoing: [], blocked: [] };
  const rows = q.docs.map(d => ({ id: d.id, ...d.data() }));
  const others = await Promise.all(rows.map(async r => { const o = r.users.find(x => x !== uid); const s = await F.getDoc(F.doc(db, 'users', o)); return { uid: o, ...(s.exists() ? s.data() : { username: 'unknown' }) }; }));
  rows.forEach((r, i) => {
    const item = { ...others[i], connectionId: r.id, status: r.status };
    if (r.status === 'accepted') out.friends.push(item);
    else if (r.status === 'pending') (r.receiverId === uid ? out.incoming : out.outgoing).push(item);
    else if (r.status === 'blocked' && r.blockerId === uid) out.blocked.push(item);
  });
  return out;
};
async function notifyUser(toUid, n) { await F.addDoc(F.collection(db, 'notifications'), { userId: toUid, fromId: cloud.user.uid, isRead: false, createdAt: F.serverTimestamp(), ...n }); }
cloud.sendFriendRequest = async username => {
  const uid = needUser();
  const target = await cloud.getPublicProfile(username);
  if (!target) throw new Error('No user with that username.');
  if (target.uid === uid) throw new Error("You can't add yourself.");
  const ref = F.doc(db, 'friends', pair(uid, target.uid));
  const ex = await F.getDoc(ref);
  if (ex.exists()) { const s = ex.data().status; throw new Error(s === 'accepted' ? 'Already friends.' : s === 'pending' ? 'A request already exists.' : 'This connection is not available.'); }
  await F.setDoc(ref, { users: [uid, target.uid].sort(), senderId: uid, receiverId: target.uid, status: 'pending', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
  try { await notifyUser(target.uid, { type: 'friend-request', title: 'New friend request', message: `${cloud.profile.username} wants to be your friend.`, link: '/friends' }); } catch { /* not critical */ }
};
cloud.respondFriend = async (id, accept) => {
  const uid = needUser(); const ref = F.doc(db, 'friends', id);
  if (!accept) return F.deleteDoc(ref);
  const s = await F.getDoc(ref); await F.updateDoc(ref, { status: 'accepted', updatedAt: F.serverTimestamp() });
  try { await notifyUser(s.data().senderId, { type: 'friend-accepted', title: 'Friend request accepted', message: `${cloud.profile.username} accepted your request.`, link: '/friends' }); } catch { /* ignore */ }
};
cloud.removeConnection = async id => { needUser(); await F.deleteDoc(F.doc(db, 'friends', id)); };
cloud.block = async otherUid => {
  const uid = needUser(); const ref = F.doc(db, 'friends', pair(uid, otherUid));
  try { await F.deleteDoc(ref); } catch { /* may not exist */ }
  await F.setDoc(ref, { users: [uid, otherUid].sort(), blockerId: uid, status: 'blocked', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
};

// ---------------- notifications ----------------
cloud.getNotifications = async () => {
  const uid = needUser();
  const q = await F.getDocs(F.query(F.collection(db, 'notifications'), F.where('userId', '==', uid), F.orderBy('createdAt', 'desc'), F.limit(30)));
  return q.docs.map(d => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt), cloud: true }));
};
cloud.markRead = async ids => { needUser(); await Promise.all(ids.map(id => F.updateDoc(F.doc(db, 'notifications', id), { isRead: true }))); };

// ---------------- settings / presets / saved texts / lesson progress ----------------
cloud.saveBlob = async blob => { const uid = needUser(); await F.setDoc(F.doc(db, 'userSettings', uid), { blob: JSON.stringify(blob), updatedAt: F.serverTimestamp() }); };
cloud.loadBlob = async () => { const uid = needUser(); const d = await F.getDoc(F.doc(db, 'userSettings', uid)); return d.exists() ? JSON.parse(d.data().blob) : null; };

// ---------------- quotes & reports ----------------
cloud.loadApprovedQuotes = async () => {
  need();
  const q = await F.getDocs(F.query(F.collection(db, 'quotes'), F.where('approvalStatus', '==', 'approved'), F.limit(300)));
  store.set('extraQuotes', q.docs.map(d => ({ id: 'c_' + d.id, ...d.data(), tags: d.data().tags || [] })));
};
cloud.submitQuote = async ({ text, author, source }) => { const uid = needUser(); await F.addDoc(F.collection(db, 'quoteSubmissions'), { text, author, source, userId: uid, language: 'english', approvalStatus: 'pending', createdAt: F.serverTimestamp() }); };
cloud.rateQuote = async (quoteId, rating) => { const uid = needUser(); await F.setDoc(F.doc(db, 'quoteRatings', quoteId + '_' + uid), { quoteId, userId: uid, rating, createdAt: F.serverTimestamp() }); };
cloud.report = async (kind, targetId, reason) => { const uid = needUser(); await F.addDoc(F.collection(db, 'reports'), { kind, targetId, reason: reason.slice(0, 500), userId: uid, createdAt: F.serverTimestamp() }); };

// ---------------- platform statistics (real aggregates only) ----------------
cloud.platformStats = async () => {
  need();
  const q = F.query(F.collection(db, 'results'), F.where('public', '==', true));
  const agg = await F.getAggregateFromServer(q, { tests: F.count(), time: F.sum('duration'), words: F.sum('wordsDone') });
  const users = await F.getCountFromServer(F.collection(db, 'users'));
  const d = agg.data();
  return { tests: d.tests, time: d.time, words: d.words, users: users.data().count };
};

// ---------------- account data ----------------
cloud.exportAll = async () => {
  const uid = needUser();
  return { profile: cloud.profile && { ...cloud.profile, createdAt: ms(cloud.profile.createdAt) }, details: cloud.details, settings: await cloud.loadBlob(), results: await cloud.getResults(2000), friends: await cloud.getFriends() };
};
cloud.deleteAccount = async () => {
  const uid = needUser();
  const del = async col => { const q = await F.getDocs(F.query(F.collection(db, col), F.where('userId', '==', uid))); await Promise.all(q.docs.map(d => F.deleteDoc(d.ref))); };
  await del('results'); await del('resultEvents'); await del('notifications');
  const fr = await F.getDocs(F.query(F.collection(db, 'friends'), F.where('users', 'array-contains', uid)));
  await Promise.all(fr.docs.map(d => F.deleteDoc(d.ref)));
  for (const [c, id] of [['userSettings', uid], ['profileDetails', uid]]) { try { await F.deleteDoc(F.doc(db, c, id)); } catch { /* ignore */ } }
  if (cloud.profile) { await F.deleteDoc(F.doc(db, 'usernames', cloud.profile.usernameLower)); await F.deleteDoc(F.doc(db, 'users', uid)); }
  await A.deleteUser(auth.currentUser);
};
cloud.resetRecords = async () => {
  const uid = needUser();
  const q = await F.getDocs(F.query(F.collection(db, 'results'), F.where('userId', '==', uid)));
  await Promise.all(q.docs.map(d => F.updateDoc(d.ref, { personalBest: false })));
};

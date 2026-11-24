// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE SETUP (optional — the site works without it in "guest / this device" mode)
//
// 1. Go to https://console.firebase.google.com → create/open your project.
// 2. Project settings → "Your apps" → Web app → copy the config values below.
//    (These web keys are NOT secrets. Your data is protected by firestore.rules.)
// 3. Authentication → Sign-in method → enable Email/Password, Google (and GitHub if you want).
//    Authentication → Settings → Authorized domains → add your GitHub Pages domain
//    (for example  yourname.github.io).
// 4. Firestore Database → create database → paste the contents of firestore.rules into
//    the Rules tab and publish. Import firestore.indexes.json (or click the index links
//    Firestore shows in the browser console the first time a query needs one).
// ─────────────────────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

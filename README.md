# Typing Panda 🐼 — Practice. Improve. Type Faster.

A free typing-practice website with the **Electric Blue `#1A4DFF` · Neon Lime `#C6FF00` · Deep Navy `#050D2E`** visual identity.
Plain HTML + CSS + JavaScript (ES modules) — **no build step**. Optional Firebase for accounts, cloud sync, leaderboards and friends.

## 1. Deploy this repository with GitHub Pages

The project files are already in the repository root. No ZIP extraction, npm install, or build command is required.

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then click **Save**.
4. Wait for GitHub Pages to publish the site.

Expected URL: https://ujjwalpratap001.github.io/typing-panda-/

The site runs immediately in **guest mode** (settings, results, presets and lesson progress are saved in the visitor's browser). Routes use hash URLs (for example, `/#/settings`) so refreshing app pages works on GitHub Pages. The `.nojekyll` file is included.

To run locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000 (ES modules need HTTP, not `file://`).

## 2. Turn on accounts, leaderboards, friends (Firebase)

1. Create a Firebase project → add a **Web app** → copy its config into `js/firebase-config.js` (these keys are public identifiers, not secrets).
2. **Authentication → Sign-in method**: enable Email/Password, Google, (GitHub optional — needs a GitHub OAuth app). Add your Pages domain under **Authorized domains**.
3. **Firestore Database → Create database.** Open the **Rules** tab, paste `firestore.rules`, Publish.
4. **Indexes:** import `firestore.indexes.json` (Firebase CLI: `firebase deploy --only firestore:indexes`) — or just open the site, and click the index link Firestore prints in the browser console the first time a page needs one.
5. Quotes: approved community quotes live in the `quotes` collection (add documents with `text, author, source, language, approvalStatus: "approved"`). Submissions arrive in `quoteSubmissions`, reports in `reports` — review them in the Firebase console.
6. Optional: set `supportEmail` / `repoUrl` in `js/site-config.js`.

No environment variables are used — everything is in `js/firebase-config.js` and `js/site-config.js`.

## Routes
`/#/` practice · `/#/learn` (`?lesson=home-1`) · `/#/leaderboards` (filters kept in the URL) · `/#/about` · `/#/settings` · `/#/login` · `/#/account` · `/#/account-settings` · `/#/profile` · `/#/profile/:username` · `/#/friends` · plus `terms-of-service.html`, `privacy-policy.html`, `security-policy.html`.

## Firestore collections
`users` (public basics) · `profileDetails` (bio/social, readable only if profile is public) · `usernames` (uniqueness) · `results` · `resultEvents` (keystroke data for replay) · `userSettings` (settings, presets, saved texts, lesson progress) · `friends` (one doc per pair) · `notifications` · `quotes` · `quoteSubmissions` · `quoteRatings` · `reports`.

## Project layout
```
index.html  404.html  css/styles.css
js/engine.js        typing engine (no DOM; replayable from events)   js/typing-ui.js  typing surface
js/results.js       result building, validation, PBs, XP, streaks    js/replay.js     replay
js/settings.js      typed settings schema                            js/commands.js   command palette
js/backend.js       Firebase wrapper (inactive until configured)     js/pages/*       one file per page
```
Engine unit tests: `node tests/engine.test.mjs`.

## Honest limitations
- **No Cloud Functions.** Result validation is done in the browser *and* by Firestore Security Rules (speed/character plausibility, ownership, ranked-eligibility). Rules cannot catch every cheat; add a Cloud Function if you need stricter anti-cheat.
- XP, level, streaks and achievements are **derived from stored results** (not stored counters), so there is no XP leaderboard. Daily/weekly boards read up to 500 recent results and rank them in the browser.
- Not included: developer API keys, Cloud-Function based moderation, pause/resume, layoutfluid/polyglot/opposite-shift modes, code snippets with indentation (code wordsets are space-free tokens), and 17 of the 35 listed Funbox modes.
- Personal-best and achievement notifications are created on the device; friend notifications come from Firestore.
- Email verification is requested but not enforced.

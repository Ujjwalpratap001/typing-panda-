// Keeps settings, presets, saved texts and lesson progress in sync with Firestore for signed-in users.
import { store, debounce } from './util.js';
import { settings, setMany, setSyncHook, DEFAULTS } from './settings.js';
import { cloud } from './backend.js';

let ready = false;
export const buildBlob = () => ({ settings, presets: store.get('presets', []), savedTexts: store.get('savedTexts', []), learn: store.get('learn', {}), favQuotes: store.get('favQuotes', []) });
const push = debounce(() => { if (ready && cloud.user) cloud.saveBlob(buildBlob()).catch(e => console.warn('sync failed', e)); }, 1500);
export const requestSync = () => push();
setSyncHook(push);

export async function pullAndMerge() {
  ready = false;
  try {
    const blob = await cloud.loadBlob();
    if (blob) {
      const clean = {};
      for (const k of Object.keys(DEFAULTS)) if (blob.settings && k in blob.settings && typeof blob.settings[k] === typeof DEFAULTS[k]) clean[k] = blob.settings[k];
      setMany(clean);
      store.set('presets', blob.presets || []); store.set('savedTexts', blob.savedTexts || []);
      const learn = store.get('learn', {});
      for (const [id, v] of Object.entries(blob.learn || {})) learn[id] = { ...(learn[id] || {}), ...v, done: !!(v.done || (learn[id] && learn[id].done)) };
      store.set('learn', learn);
      store.set('favQuotes', [...new Set([...(blob.favQuotes || []), ...store.get('favQuotes', [])])]);
    }
  } catch (e) { console.warn('could not load synced settings', e); }
  ready = true; push();
}
export const stopSync = () => { ready = false; };

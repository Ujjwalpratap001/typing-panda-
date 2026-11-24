// Local notifications (personal bests, achievements, lessons, announcements). Cloud ones are merged in the notifications modal.
import { store, uid } from './util.js';
export const notifBus = new EventTarget();
export const getLocalNotifs = () => store.get('notifs', []);
export function addNotif({ type, title, message, link = '' }) {
  const list = getLocalNotifs();
  list.unshift({ id: uid(), type, title, message, link, isRead: false, createdAt: Date.now() });
  store.set('notifs', list.slice(0, 50));
  notifBus.dispatchEvent(new Event('change'));
}
export function markLocalRead(id) {
  const list = getLocalNotifs();
  list.forEach(n => { if (!id || n.id === id) n.isRead = true; });
  store.set('notifs', list); notifBus.dispatchEvent(new Event('change'));
}
export function seedWelcome() {
  if (store.get('welcomed')) return;
  store.set('welcomed', true);
  addNotif({ type: 'system', title: 'Welcome to Typing Panda', message: 'Press Tab to restart, Ctrl+K for commands. Good luck!', link: '/about' });
}

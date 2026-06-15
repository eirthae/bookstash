import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// OS notifications for "a work you saved is now downloaded". These are LOCAL
// notifications fired by the app itself the moment an on-device fetch finishes —
// no push server needed. On web/dev they no-op.

let permAsked = false;
let nid = 1;

export async function ensureNotifyPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    if (cur.display === 'denied' || permAsked) return false;
    permAsked = true;
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch (e) { return false; }
}

// Fire one notification summarising the works that just became available.
export async function notifySavedAvailable(works) {
  const list = (works || []).filter(Boolean);
  if (!list.length || !Capacitor.isNativePlatform()) return;
  if (!(await ensureNotifyPermission())) return;
  const first = list[0].title || 'A saved work';
  const title = list.length === 1 ? 'Saved work ready to read' : `${list.length} saved works ready`;
  const body = list.length === 1
    ? `“${first}” finished downloading — tap to read.`
    : `“${first}” and ${list.length - 1} more are downloaded and ready.`;
  try {
    await LocalNotifications.schedule({
      notifications: [{ id: (nid = (nid % 2000000000) + 1), title, body }],
    });
  } catch (e) { /* notifications optional — never block the app */ }
}

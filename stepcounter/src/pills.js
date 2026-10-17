import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pills', {
      name: 'Таблетки', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400], sound: 'default',
    });
  }
}

export async function askPermission() {
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Каждый день в указанное время. Возвращает id уведомления.
export async function schedulePill(name, time) {
  const [hour, minute] = time.split(':').map(Number);
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Пора принять таблетки', body: name, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'pills' },
  });
}
export const cancelPill = (nid) => nid ? Notifications.cancelScheduledNotificationAsync(nid).catch(() => {}) : null;

export function normalizeTime(text) {
  const d = text.replace(/\D/g, '').slice(0, 4);
  if (d.length < 3) return null;
  const h = Number(d.slice(0, d.length - 2)), m = Number(d.slice(-2));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Свои звуки лежат в assets/sounds. На Android звук привязан к каналу, поэтому канал на каждый звук.
export const SOUNDS = [
  { id: 'default', name: 'Стандартный', file: null },
  { id: 'chime', name: 'Колокольчик', file: 'chime.wav' },
  { id: 'bell', name: 'Гонг', file: 'bell.wav' },
  { id: 'beep', name: 'Три сигнала', file: 'beep.wav' },
  { id: 'melody', name: 'Мелодия', file: 'melody.wav' },
];
const soundOf = (id) => SOUNDS.find((s) => s.id === id) || SOUNDS[0];
export const channelOf = (kind, sound) => `${kind}-${soundOf(sound).id}`;

async function ensureChannel(kind, sound) {
  if (Platform.OS !== 'android') return;
  const sd = soundOf(sound);
  await Notifications.setNotificationChannelAsync(channelOf(kind, sound), {
    name: `${kind === 'pill' ? 'Таблетки' : 'Тренировки'}: ${sd.name}`,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400], sound: sd.file || 'default',
  });
}

export async function askPermission() {
  await ensureChannel('pill', 'default');
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Проиграть звук для проверки: мгновенное уведомление
export async function preview(kind, sound) {
  await ensureChannel(kind, sound);
  const sd = soundOf(sound);
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Проверка звука', body: sd.name, sound: sd.file || 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: channelOf(kind, sound) },
  });
}

// r: { kind: 'pill'|'workout', name, time 'HH:MM', sound, days: [1..7] (1 = понедельник) или пусто = каждый день }
// Возвращает массив id уведомлений.
export async function schedule(r) {
  const kind = r.kind || 'pill';
  await ensureChannel(kind, r.sound);
  const [hour, minute] = r.time.split(':').map(Number);
  const sd = soundOf(r.sound);
  const content = kind === 'pill'
    ? { title: 'Пора принять таблетки', body: r.name, sound: sd.file || 'default' }
    : { title: 'Пора на тренировку', body: r.name || 'Время двигаться', sound: sd.file || 'default' };
  const channelId = channelOf(kind, r.sound);
  const T = Notifications.SchedulableTriggerInputTypes;
  const days = r.days && r.days.length && r.days.length < 7 ? r.days : null;
  if (!days) return [await Notifications.scheduleNotificationAsync({ content, trigger: { type: T.DAILY, hour, minute, channelId } })];
  const ids = [];
  for (const d of days) {
    // в expo: 1 = воскресенье, 2 = понедельник ... 7 = суббота
    const weekday = d === 7 ? 1 : d + 1;
    ids.push(await Notifications.scheduleNotificationAsync({ content, trigger: { type: T.WEEKLY, weekday, hour, minute, channelId } }));
  }
  return ids;
}
export async function cancel(ids) {
  for (const id of [].concat(ids || [])) { if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {}); }
}

export function normalizeTime(text) {
  const d = text.replace(/\D/g, '').slice(0, 4);
  if (d.length < 3) return null;
  const h = Number(d.slice(0, d.length - 2)), m = Number(d.slice(-2));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

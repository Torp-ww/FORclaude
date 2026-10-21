import AsyncStorage from '@react-native-async-storage/async-storage';

const K = { active: 'active.v2', history: 'history.v2', profile: 'profile.v2', pills: 'pills.v2', moods: 'moods.v1', sleep: 'sleep.v1', restHr: 'resthr.v1' };

async function read(key, fallback) {
  try { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
async function write(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const loadActive = () => read(K.active, null);
export const saveActive = (s) => write(K.active, s);
export const clearActive = () => AsyncStorage.removeItem(K.active).catch(() => {});
export const loadHistory = () => read(K.history, []);
export const saveHistory = (h) => write(K.history, h);
export const loadProfile = () => read(K.profile, { weight: 70, height: 170, goalKm: 3, goalMin: 30 });
export const saveProfile = (p) => write(K.profile, p);
export const loadPills = () => read(K.pills, []);
export const savePills = (p) => write(K.pills, p);
export const loadMoods = () => read(K.moods, {});
export const saveMoods = (m) => write(K.moods, m);
export const loadSleep = () => read(K.sleep, {});
export const saveSleep = (m) => write(K.sleep, m);
export const loadRestHr = () => read(K.restHr, {});
export const saveRestHr = (m) => write(K.restHr, m);
export const FEATURES = [
  ['stats', 'Статистика, рекорды и отчёты'],
  ['health', 'Раздел «Здоровье»'],
  ['coach', 'Советы тренера'],
  ['mood', 'Шкала настроения'],
  ['sleep', 'Рекомендации по сну'],
  ['weight', 'Калькулятор веса'],
  ['pulse', 'Пульс: зоны и советы отдохнуть'],
  ['liveTips', 'Подсказки во время тренировки'],
  ['headphones', 'Совет про громкость наушников'],
  ['pushups', 'Счётчик отжиманий'],
  ['awards', 'Достижения'],
  ['pills', 'Напоминания (таблетки и тренировки)'],
];
export const feat = (profile, key) => !(profile && profile.features && profile.features[key] === false);
export const loadPushups = () => read('pushups.v1', []);
export const savePushups = (p) => write('pushups.v1', p);

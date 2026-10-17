import AsyncStorage from '@react-native-async-storage/async-storage';

const K = { active: 'active.v2', history: 'history.v2', profile: 'profile.v2', pills: 'pills.v2' };

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
export const loadProfile = () => read(K.profile, { weight: 70, height: 170 });
export const saveProfile = (p) => write(K.profile, p);
export const loadPills = () => read(K.pills, []);
export const savePills = (p) => write(K.pills, p);

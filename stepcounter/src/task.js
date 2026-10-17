// Фоновая задача: получает координаты, даже когда приложение свёрнуто или экран выключен.
// Должна импортироваться на верхнем уровне (App.js), до рендера.
import * as TaskManager from 'expo-task-manager';
import { addFix } from './tracker';
import { loadActive, saveActive } from './store';

export const LOCATION_TASK = 'step-counter-location';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  let s = await loadActive();
  if (!s || s.pausedAt || s.endedAt) return;
  for (const loc of data.locations) {
    s = addFix(s, {
      lat: loc.coords.latitude, lon: loc.coords.longitude, t: loc.timestamp,
      accuracy: loc.coords.accuracy, speed: loc.coords.speed,
    });
  }
  await saveActive(s);
});

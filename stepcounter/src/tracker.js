// Чистая логика подсчёта: без React и без датчиков, поэтому легко тестируется.
export const MOVE_THRESHOLD = 0.5;   // м/с: медленнее считаем «стоим»
export const MAX_ACCURACY = 25;      // м: фиксы с худшей точностью отбрасываем
export const MAX_SPEED = 20;         // м/с: выше считаем скачком GPS

export function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// MET по скорости (км/ч): ходьба медленная, быстрая, бег.
export function met(kmh) {
  if (kmh < 3.2) return 2.0;
  if (kmh < 4.8) return 2.8;
  if (kmh < 5.6) return 3.5;
  if (kmh < 6.4) return 4.3;
  if (kmh < 7.2) return 5.0;
  if (kmh < 8.4) return 8.3;
  if (kmh < 9.7) return 9.8;
  return 11.0;
}

export function createSession(now = Date.now(), profile = {}) {
  const weight = profile.weight || 70, height = profile.height || 170;
  return {
    startedAt: now, endedAt: null, points: [],
    distance: 0, movingMs: 0, maxSpeed: 0, minSpeed: null, calories: 0,
    weight, stride: (height / 100) * 0.413,           // длина шага в метрах
    pausedAt: null, pausedMs: 0, pausedSteps: 0, skipNext: false, finalSteps: null,
    lastSpeed: 0, hr: null,
  };
}

export function pauseSession(s, now = Date.now()) {
  return s.pausedAt ? s : { ...s, pausedAt: now };
}
export function resumeSession(s, now = Date.now()) {
  if (!s.pausedAt) return s;
  return { ...s, pausedMs: s.pausedMs + (now - s.pausedAt), pausedAt: null, skipNext: true };
}
export function finishSession(s, now = Date.now()) {
  const r = resumeSession(s, now);
  return { ...r, skipNext: false, endedAt: now };
}

// fix: { lat, lon, t (мс), accuracy, speed (м/с или null) }
export function addFix(s, fix) {
  if (s.pausedAt || s.endedAt) return s;
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY) return s;
  const last = s.points[s.points.length - 1];
  if (!last || s.skipNext) {
    // после паузы начинаем новый отрезок: расстояние через паузу не считаем
    return { ...s, skipNext: false, points: [...s.points, { lat: fix.lat, lon: fix.lon, t: fix.t, brk: !!last }] };
  }
  const dt = (fix.t - last.t) / 1000;
  if (dt <= 0) return s;
  const d = haversine(last, fix);
  // Скорость 0 или её отсутствие считаем неизвестными: тогда скорость берём из смещения,
  // а мелкие смещения в пределах точности GPS не считаем движением.
  const reported = fix.speed != null && fix.speed > 0;
  const acc = fix.accuracy != null ? fix.accuracy : 10;
  const v = reported ? fix.speed : d / dt;
  if (v > MAX_SPEED) return s;
  const minMove = reported ? 1 : Math.max(2.5, Math.min(acc * 0.8, 12));
  const next = { ...s, points: [...s.points] };
  if (v >= MOVE_THRESHOLD && d >= minMove) {
    next.distance += d;
    next.movingMs += dt * 1000;
    next.calories += met(v * 3.6) * s.weight * dt / 3600;
    next.lastSpeed = v;
    next.maxSpeed = Math.max(next.maxSpeed, v);
    next.minSpeed = next.minSpeed == null ? v : Math.min(next.minSpeed, v);
    next.points.push({ lat: fix.lat, lon: fix.lon, t: fix.t });
  } else {
    next.lastSpeed = 0;
    // без скорости окно измерения не сдвигаем вплотную, чтобы шаг считался за реальное время
    const t = reported ? fix.t : Math.max(last.t, fix.t - 8000);
    next.points[next.points.length - 1] = { ...last, t };
  }
  return next;
}

// liveSteps: точное число шагов от шагомера (iOS), если есть
export function summarize(s, now = Date.now(), liveSteps = null) {
  const end = s.endedAt ?? s.pausedAt ?? now;
  const totalMs = Math.max(0, end - s.startedAt - s.pausedMs);
  const movingMs = Math.min(s.movingMs, totalMs);
  const steps = s.finalSteps ?? liveSteps ?? Math.round(s.distance / s.stride);
  return {
    steps, distance: s.distance, calories: s.calories,
    totalMs, movingMs, idleMs: totalMs - movingMs,
    avgSpeed: movingMs > 0 ? s.distance / (movingMs / 1000) : 0,
    maxSpeed: s.maxSpeed, minSpeed: s.minSpeed ?? 0,
    speed: s.pausedAt || s.endedAt ? 0 : s.lastSpeed,
    hrAvg: s.hr ? s.hr.avg : null, hrMax: s.hr ? s.hr.max : null, hrMin: s.hr ? s.hr.min : null,
  };
}

export const kmh = (ms) => ms * 3.6;
export function fmtDuration(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600),
        m = Math.floor((t % 3600) / 60), sec = t % 60, p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
export function fmtDistance(m) {
  return m >= 1000 ? { v: (m / 1000).toFixed(2), u: 'км' } : { v: Math.round(m).toString(), u: 'м' };
}

export function fmtPace(speed) {
  if (!speed || speed < 0.3) return '—';
  const sec = Math.round(1000 / speed), m = Math.floor(sec / 60), r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
export const fmtKm = (m) => (m / 1000).toFixed(2);
export const fmtMeters = (m) => `${Math.round(m).toLocaleString('ru-RU')} м`;

// Счётчик отжиманий по акселерометру. Телефон закреплён на теле (плечо, нагрудный карман, чехол на руку).
// Ориентация телефона не важна: берём составляющую ускорения вдоль силы тяжести.
// Положение получаем двойным интегрированием с «утечкой», это приближение, а не точное измерение.

export const CFG = {
  g: 9.80665,
  gravTau: 1.0,       // с: сглаживание для оценки направления силы тяжести
  velTau: 1.2,        // с: утечка скорости
  posTau: 2.5,        // с: утечка положения
  hysteresis: 0.03,   // м: минимальный ход для смены направления
  fullDepth: 0.07,    // м: глубина полноценного повторения (в шкале оценки)
  partialDepth: 0.03, // м: глубже считаем «неполным»
  minRepSec: 0.9,     // быстрее: слишком быстро (рывком)
  maxRepSec: 7,       // медленнее: пауза, не повторение
};

export function createCounter(cfg = CFG) {
  return {
    cfg, t: null, grav: null, v: 0, p: 0,
    dir: 0, extreme: 0, extremeT: 0, lastMax: null, lastMaxT: 0, pendingMin: null,
    correct: 0, partial: 0, fast: 0, last: null,
  };
}

// s: состояние, (tMs, ax, ay, az) в g. Возвращает событие {type:'correct'|'partial'|'fast', amp, sec} или null.
export function feed(s, tMs, ax, ay, az) {
  const c = s.cfg;
  if (s.t === null) { s.t = tMs; s.grav = [ax, ay, az]; return null; }
  const dt = Math.min(0.2, Math.max(0.001, (tMs - s.t) / 1000)); s.t = tMs;
  const k = 1 - Math.exp(-dt / c.gravTau);
  s.grav = s.grav.map((g, i) => g + ((i === 0 ? ax : i === 1 ? ay : az) - g) * k);
  const gn = Math.hypot(...s.grav) || 1;
  // вертикальное ускорение, м/с²: проекция на направление силы тяжести без самой гравитации
  const a = ((ax * s.grav[0] + ay * s.grav[1] + az * s.grav[2]) / gn - gn) * c.g;
  s.v = (s.v + a * dt) * Math.exp(-dt / c.velTau);
  s.p = (s.p + s.v * dt) * Math.exp(-dt / c.posTau);
  // акселерометр с лежащим экраном вверх даёт +g при покое, поэтому «вверх» — это положительное p после проекции
  return track(s, s.p, tMs / 1000);
}

function track(s, p, t) {
  const c = s.cfg;
  if (s.dir === 0) { s.dir = 1; s.extreme = p; s.extremeT = t; return null; }
  if (s.dir === 1) { // идём вверх, ищем максимум
    if (p > s.extreme) { s.extreme = p; s.extremeT = t; return null; }
    if (s.extreme - p >= c.hysteresis) { // развернулись вниз: максимум зафиксирован
      const prevMax = s.lastMax, prevT = s.lastMaxT;
      s.lastMax = s.extreme; s.lastMaxT = s.extremeT;
      s.dir = -1; s.extreme = p; s.extremeT = t;
      return finish(s, prevMax, prevT, true);
    }
    return null;
  }
  // идём вниз, ищем минимум
  if (p < s.extreme) { s.extreme = p; s.extremeT = t; return null; }
  if (p - s.extreme >= c.hysteresis) { s.pendingMin = s.extreme; s.dir = 1; s.extreme = p; s.extremeT = t; }
  return null;
}

// Повторение закрывается на очередном максимуме после минимума: считаем ход и длительность
function finish(s, prevMax, prevT, isMax) {
  const c = s.cfg;
  if (prevMax === null || s.pendingMin === null) return null;
  const amp = Math.min(prevMax, s.lastMax) - s.pendingMin;
  const sec = s.lastMaxT - prevT;
  s.pendingMin = null;
  let type;
  if (amp < c.partialDepth) return null;                // шум или дрожь
  if (sec > c.maxRepSec) return null;                   // долгая пауза
  if (sec < c.minRepSec) type = 'fast';
  else if (amp < c.fullDepth) type = 'partial';
  else type = 'correct';
  s[type] += 1;
  s.last = { type, amp, sec };
  return s.last;
}

export const summary = (s) => ({ correct: s.correct, partial: s.partial, fast: s.fast, total: s.correct + s.partial + s.fast });
export const advice = (r) => {
  if (r.total === 0) return 'Движений не засчитано. Проверьте, как закреплён телефон, или считайте вручную кнопкой «+1».';
  const bad = r.partial + r.fast;
  if (bad === 0) return 'Отличная техника: все повторения полные и в хорошем темпе.';
  if (r.fast > r.partial) return 'Много слишком быстрых повторений. Опускайтесь за 1-2 секунды и поднимайтесь плавно.';
  return 'Есть неполные повторения. Опускайтесь ниже, пока грудь не будет в нескольких сантиметрах от пола.';
};

const assert = require('assert');
(async () => {
  const T = await import('./tracker.js');
  let s = T.createSession(0, { weight: 70, height: 170 });
  const step = 0.0000250; // ≈1.55 м по долготе на широте 56
  let t = 0, lon = 60;
  const fix = (speed = null, acc = 5) => ({ lat: 56, lon, t, accuracy: acc, speed });
  for (let i = 0; i <= 10; i++) { s = T.addFix(s, fix()); t += 1000; lon += step; }
  // стоим 5 секунд
  lon -= step; t -= 1000;
  for (let i = 0; i < 5; i++) { t += 1000; s = T.addFix(s, fix(0.1)); }
  // пауза 60 секунд; GPS в паузе игнорируется
  s = T.pauseSession(s, t);
  s = T.addFix(s, { lat: 56, lon: 61, t: t + 5000, accuracy: 5, speed: 1.5 });
  const dist1 = s.distance;
  t += 60000;
  s = T.resumeSession(s, t);
  // после паузы переехали далеко: расстояние через паузу не считается
  s = T.addFix(s, { lat: 56.01, lon: 60.01, t, accuracy: 5, speed: 1.5 });
  assert.strictEqual(s.distance, dist1);
  assert(s.points[s.points.length - 1].brk);
  // плохая точность игнорируется
  s = T.addFix(s, { lat: 57, lon: 61, t: t + 1000, accuracy: 80, speed: null });
  assert.strictEqual(s.distance, dist1);
  const r = T.summarize(s, t);
  console.log(r);
  assert(r.distance > 14 && r.distance < 17);
  assert(Math.abs(r.totalMs - 15000) < 1, 'пауза не входит во время');
  assert(Math.abs(r.idleMs - 5000) < 1);
  assert(r.calories > 0.5 && r.calories < 2, 'калории ~ 2.8*70*10/3600 ≈ 0.54..');
  assert(r.steps > 15 && r.steps < 30);
  // калории за час быстрой ходьбы 5.5 км/ч при 70 кг ≈ 3.5*70 = 245
  assert(Math.abs(T.met(5.5) * 70 - 245) < 1);
  console.log('OK');
})();

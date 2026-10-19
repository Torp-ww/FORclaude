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
  assert(r.distance > 13 && r.distance < 17);
  assert(Math.abs(r.totalMs - 15000) < 1, 'пауза не входит во время');
  assert(Math.abs(r.idleMs - 5000) < 2001);
  assert(r.calories > 0.5 && r.calories < 2, 'калории ~ 2.8*70*10/3600 ≈ 0.54..');
  assert(r.steps > 15 && r.steps < 30);
  // калории за час быстрой ходьбы 5.5 км/ч при 70 кг ≈ 3.5*70 = 245
  assert(Math.abs(T.met(5.5) * 70 - 245) < 1);
  console.log('OK');
})();
// Телефон сообщает скорость 0, но человек идёт: расстояние должно считаться
(async () => {
  const T = await import('./tracker.js');
  let s = T.createSession(0, { weight: 70, height: 170 });
  let lon = 60;
  const step = 0.0000250;  // ≈1.55 м
  for (let i = 0; i <= 30; i++) { s = T.addFix(s, { lat: 56, lon, t: i * 1000, accuracy: 5, speed: 0 }); lon += step; }
  const r = T.summarize(s, 30000);
  console.log('speed0 walk', r.distance.toFixed(1), (r.movingMs / 1000).toFixed(1), kmhs(r.avgSpeed));
  assert(r.distance > 38 && r.distance < 50, 'ходьба при speed=0 считается');
  assert(r.avgSpeed > 1.2 && r.avgSpeed < 2.0, 'средняя скорость правдоподобна');
  assert(r.maxSpeed < 3, 'нет всплесков скорости');
  // стоим на месте с дрейфом GPS ±2 м и точностью 10: движения нет
  let q = T.createSession(0, {});
  for (let i = 0; i <= 40; i++) q = T.addFix(q, { lat: 56 + (i % 2 ? 0.000012 : -0.000012), lon: 60 + (i % 3 ? 0.00001 : -0.00001), t: i * 1000, accuracy: 10, speed: 0 });
  assert(T.summarize(q, 40000).distance < 3, 'дрейф GPS не считается ходьбой');
  console.log('OK 2');
  function kmhs(v) { return (v * 3.6).toFixed(1); }
})();

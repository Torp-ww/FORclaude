import assert from 'node:assert/strict';
import { createCounter, feed, summary, advice } from './pushups.js';

// Симуляция: телефон лежит экраном вверх, вертикальное движение x(t) = A/2 * (1 - cos(2πt/T)) вокруг покоя.
// Акселерометр (в g): z = 1 + x''(t)/g, плюс небольшой шум.
function run({ reps, amp, period, noise = 0.004, hz = 25, lead = 3, tilt = 0 }) {
  const c = createCounter(); const g = 9.80665; let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const T = reps * period + lead * 2, dt = 1 / hz;
  for (let t = 0; t <= T; t += dt) {
    const u = t - lead;
    const inRep = u >= 0 && u <= reps * period;
    const w = (2 * Math.PI) / period;
    const acc = inRep ? (amp / 2) * w * w * Math.cos(w * u) : 0;
    const z = 1 + acc / g, sn = Math.sin(tilt), cs = Math.cos(tilt);
    feed(c, Math.round(t * 1000), z * sn + noise * rnd(), noise * rnd(), z * cs + noise * rnd());
  }
  return summary(c);
}
// Хорошие повторения: ход 12 см, 2.5 с на повторение
let r = run({ reps: 10, amp: 0.12, period: 2.5 });
assert.ok(r.correct >= 8 && r.correct <= 10, 'хорошие: ' + JSON.stringify(r));
assert.equal(r.fast, 0);
// Тот же ритм под другим углом телефона: ориентация не важна — проверяем на уровне формулы через поворот осей
r = run({ reps: 10, amp: 0.12, period: 2.5, tilt: 1.2 });
assert.ok(r.correct >= 8, 'наклон: ' + JSON.stringify(r));
// Мелкие движения не считаются полноценными
r = run({ reps: 10, amp: 0.045, period: 2.5 });
assert.ok(r.correct === 0, 'мелкие: ' + JSON.stringify(r));
// Рывками: период 0.7 с
r = run({ reps: 10, amp: 0.12, period: 0.7 });
assert.ok(r.correct === 0 && r.fast >= 5, 'быстрые: ' + JSON.stringify(r));
// Тишина: ничего не считаем
r = run({ reps: 0, amp: 0, period: 2 });
assert.equal(r.total, 0);
assert.ok(advice({ correct: 5, partial: 0, fast: 0, total: 5 }).includes('Отличная'));
assert.ok(advice({ correct: 0, partial: 0, fast: 0, total: 0 }).includes('+1'));
console.log('pushups: всё прошло', JSON.stringify(run({ reps: 10, amp: 0.12, period: 2.5 })));

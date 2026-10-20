import assert from 'node:assert/strict';
import { perDay, isActive, periodRange, daySeries, totals, streaks, records, goalStats, fitnessIndex, buildReport, change, mondayOf } from './stats.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
// активность: distance м за min минут
const act = (t, distance, min, extra = {}) => ({
  startedAt: t, endedAt: t + min * 60000, points: [], distance, movingMs: min * 60000, maxSpeed: 2, minSpeed: 1,
  calories: distance / 20, weight: 70, stride: 0.7, pausedMs: 0, pausedAt: null, finalSteps: null, ...extra,
});

const NOW = at(2026, 10, 21); // среда
const h = [
  act(at(2026, 10, 19), 3000, 40), // пн
  act(at(2026, 10, 20, 8), 500, 5), act(at(2026, 10, 20, 18), 700, 8), // вт: два заезда = 1200 м
  act(at(2026, 10, 21), 2000, 25), // ср
  act(at(2026, 10, 12), 4000, 50), // пн прошлой недели
];

assert.equal(new Date(mondayOf(NOW)).getDate(), 19);
assert.equal(perDay(h).size, 4);
const week = periodRange('week', NOW, 0);
assert.equal(week.days.length, 7);
const d = daySeries(h, week);
assert.equal(Math.round(d[1].distance), 1200);            // вторник: активности суммируются
assert.equal(isActive(d[1]), true);                       // 1200 м >= 1 км
assert.equal(isActive(d[3]), false);                      // четверг пустой
const t = totals(d);
assert.equal(t.activeDays, 3); assert.equal(Math.round(t.distance), 6200);
assert.equal(streaks(h, NOW).current, 3);                 // пн, вт, ср
assert.equal(streaks(h, at(2026, 10, 22)).current, 3);    // четверг ещё пуст: серия не рвётся
assert.equal(streaks(h, at(2026, 10, 23)).current, 0);    // пятница: серия оборвана
assert.equal(streaks(h, NOW).best, 3);
const r = records(h);
assert.equal(Math.round(r.distance.value), 4000);
assert.equal(Math.round(r.dayDistance.value), 4000);
assert.equal(r.streak, 3);
const gs = goalStats(d, { goalKm: 2 }, NOW);
assert.equal(gs.elapsed, 3); assert.equal(gs.km, 2);       // пн 3 км и ср 2 км
assert.equal(change(6200, 4000), 55); assert.equal(change(1, 0), null);
assert.equal(fitnessIndex(daySeries([], week)), 0);
assert.ok(fitnessIndex(d) > 0 && fitnessIndex(d) <= 100);
const m = periodRange('month', NOW, 0); assert.equal(m.days.length, 31);
const rep = buildReport(h, 'week', NOW, 0, {});
assert.ok(rep.text.includes('Дистанция: 6.20 км')); assert.ok(rep.text.includes('+55%'));
console.log('stats: всё прошло');

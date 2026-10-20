// Статистика по истории активностей. Чистая логика, без React.
import { summarize } from './tracker.js';

export const ACTIVE_MIN_MS = 10 * 60000;   // день активный: 10 минут в движении
export const ACTIVE_MIN_DIST = 1000;       // или 1 км
export const DAY = 86400000;
export const DEFAULT_GOALS = { goalKm: 3, goalMin: 30 };

export const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const mondayOf = (t) => { const d = new Date(dayStart(t)); const wd = (d.getDay() + 6) % 7; return addDays(d.getTime(), -wd); };

const empty = (t0) => ({ t0, distance: 0, calories: 0, steps: 0, movingMs: 0, totalMs: 0, count: 0, maxSpeed: 0 });

// Суммы по дням: ключ dayKey -> итоги дня
export function perDay(history) {
  const m = new Map();
  for (const h of history) {
    const t0 = dayStart(h.startedAt), k = dayKey(t0);
    const r = summarize(h);
    const d = m.get(k) || empty(t0);
    d.distance += r.distance; d.calories += r.calories; d.steps += r.steps;
    d.movingMs += r.movingMs; d.totalMs += r.totalMs; d.count += 1;
    d.maxSpeed = Math.max(d.maxSpeed, r.maxSpeed);
    m.set(k, d);
  }
  return m;
}

export const isActive = (d) => !!d && (d.movingMs >= ACTIVE_MIN_MS || d.distance >= ACTIVE_MIN_DIST);

// Период: неделя (с понедельника) или месяц; offset: 0 — текущий, -1 — предыдущий
export function periodRange(kind, now, offset = 0) {
  let from, to;
  if (kind === 'week') {
    from = addDays(mondayOf(now), offset * 7); to = addDays(from, 7);
  } else {
    const d = new Date(now); const f = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    from = f.getTime(); to = new Date(f.getFullYear(), f.getMonth() + 1, 1).getTime();
  }
  const days = [];
  for (let t = from; t < to; t = addDays(t, 1)) days.push(t);
  return { kind, from, to, days };
}

export function periodLabel(r) {
  const f = (t, o) => new Date(t).toLocaleDateString('ru-RU', o);
  if (r.kind === 'month') { const s = f(r.from, { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
  const last = addDays(r.to, -1);
  return `${f(r.from, { day: 'numeric', month: 'short' })} – ${f(last, { day: 'numeric', month: 'short' })}`;
}

// Итоги по каждому дню периода (нули, если активности не было)
export function daySeries(history, range) {
  const m = perDay(history);
  return range.days.map((t) => m.get(dayKey(t)) || empty(t));
}

export function totals(days) {
  const r = { distance: 0, calories: 0, steps: 0, movingMs: 0, count: 0, activeDays: 0 };
  for (const d of days) {
    r.distance += d.distance; r.calories += d.calories; r.steps += d.steps;
    r.movingMs += d.movingMs; r.count += d.count; if (isActive(d)) r.activeDays += 1;
  }
  r.avgKmh = r.movingMs > 0 ? (r.distance / (r.movingMs / 1000)) * 3.6 : 0;
  return r;
}

// Изменение в процентах к прошлому периоду; null, если сравнивать не с чем
export const change = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

// Серия активных дней. Если сегодня ещё не активен, серия не обрывается: считаем от вчера.
export function streaks(history, now = Date.now()) {
  const m = perDay(history);
  const act = (t) => isActive(m.get(dayKey(t)));
  let t = dayStart(now);
  if (!act(t)) t = addDays(t, -1);
  let current = 0;
  while (act(t)) { current += 1; t = addDays(t, -1); }
  const keys = [...m.values()].filter(isActive).map((d) => d.t0).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    run = prev !== null && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = k;
  }
  return { current, best: Math.max(best, current) };
}

// Цели: сколько дней периода выполнены (только прошедшие дни и сегодня)
export function goalStats(days, goals, now = Date.now()) {
  const g = { ...DEFAULT_GOALS, ...goals };
  const today = dayStart(now);
  const past = days.filter((d) => d.t0 <= today);
  const km = past.filter((d) => d.distance >= g.goalKm * 1000).length;
  const min = past.filter((d) => d.movingMs >= g.goalMin * 60000).length;
  return { elapsed: past.length, km, min };
}

export function dayProgress(d, goals) {
  const g = { ...DEFAULT_GOALS, ...goals };
  return {
    km: Math.min(1, d.distance / (g.goalKm * 1000)),
    min: Math.min(1, d.movingMs / (g.goalMin * 60000)),
  };
}

// Рекорды за всё время
export function records(history) {
  const rec = {};
  const best = (key, val, h) => { if (val > 0 && (!rec[key] || val > rec[key].value)) rec[key] = { value: val, t: h.startedAt }; };
  for (const h of history) {
    const r = summarize(h);
    best('distance', r.distance, h);
    best('duration', r.totalMs, h);
    best('maxSpeed', r.maxSpeed, h);
    best('calories', r.calories, h);
    if (r.distance >= 1000) best('pace', r.avgSpeed, h);           // лучший средний темп на 1 км и дальше
    if (h.hr) best('hrMax', h.hr.max, h);
  }
  const days = [...perDay(history).values()];
  for (const d of days) {
    best('dayDistance', d.distance, { startedAt: d.t0 });
    best('daySteps', d.steps, { startedAt: d.t0 });
  }
  rec.streak = streaks(history).best;
  return rec;
}

// Простой индекс формы за неделю, от 0 до 100: объём, регулярность, скорость
export function fitnessIndex(days) {
  const t = totals(days);
  const minutes = t.movingMs / 60000;
  const volume = Math.min(1, minutes / 150);          // 150 мин в неделю — норма ВОЗ
  const regular = Math.min(1, t.activeDays / 5);
  const pace = Math.min(1, t.avgKmh / 6.5);
  return Math.round(volume * 40 + regular * 30 + pace * 30);
}
export function fitnessSeries(history, now = Date.now(), weeks = 8) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const r = periodRange('week', now, -i);
    out.push({ from: r.from, value: fitnessIndex(daySeries(history, r)) });
  }
  return out;
}
export function fitnessLabel(v) {
  return v >= 80 ? 'Отличная' : v >= 60 ? 'Хорошая' : v >= 35 ? 'Средняя' : 'Невысокая';
}

// Текстовый отчёт за период
export function buildReport(history, kind, now = Date.now(), offset = 0, goals = {}) {
  const range = periodRange(kind, now, offset), prevRange = periodRange(kind, now, offset - 1);
  const days = daySeries(history, range), cur = totals(days), prev = totals(daySeries(history, prevRange));
  const g = goalStats(days, goals, now);
  const km = (cur.distance / 1000).toFixed(2), hrs = Math.floor(cur.movingMs / 3600000), mins = Math.round((cur.movingMs % 3600000) / 60000);
  const dd = change(cur.distance, prev.distance);
  const lines = [
    `Дистанция: ${km} км`,
    `Время в движении: ${hrs > 0 ? `${hrs} ч ` : ''}${mins} мин`,
    `Активностей: ${cur.count}, активных дней: ${cur.activeDays} из ${range.days.length}`,
    `Шаги: ${cur.steps.toLocaleString('ru-RU')}, калории: ${Math.round(cur.calories)} ккал`,
  ];
  if (cur.avgKmh > 0) lines.push(`Средняя скорость: ${cur.avgKmh.toFixed(1)} км/ч`);
  if (g.elapsed > 0) lines.push(`Цель по дистанции выполнена ${g.km} из ${g.elapsed} дней`);
  if (dd !== null) lines.push(`К прошлому ${kind === 'week' ? 'периоду' : 'месяцу'}: ${dd >= 0 ? '+' : ''}${dd}%`);
  const title = `${kind === 'week' ? 'Отчёт за неделю' : 'Отчёт за месяц'}, ${periodLabel(range)}`;
  return { title, lines, text: [title, ...lines].join('\n'), cur, prev, range, days };
}

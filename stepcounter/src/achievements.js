// Достижения. ctx: { history, pushups: [{t, correct, partial, fast}], moods, sleep, goals }
import { summarize } from './tracker.js';
import { streaks, perDay, dayKey, DEFAULT_GOALS } from './stats.js';

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const hour = (t) => new Date(t).getHours();

export function evaluate(ctx) {
  const { history = [], pushups = [], moods = {}, sleep = {}, goals = {} } = ctx;
  const g = { ...DEFAULT_GOALS, ...goals };
  const rs = history.map(summarize);
  const totalKm = sum(rs, (r) => r.distance) / 1000;
  const bestKm = Math.max(0, ...rs.map((r) => r.distance)) / 1000;
  const maxKmh = Math.max(0, ...rs.map((r) => r.maxSpeed)) * 3.6;
  const cal = sum(rs, (r) => r.calories);
  const best = streaks(history).best;
  const days = [...perDay(history).values()];
  const goalDays = days.filter((d) => d.distance >= g.goalKm * 1000).length;
  const early = history.some((h) => hour(h.startedAt) < 7 && summarize(h).distance >= 500);
  const late = history.some((h) => hour(h.startedAt) >= 22 && summarize(h).distance >= 500);
  const withHr = history.some((h) => h.hr && h.hr.samples && h.hr.samples.length > 2);
  const pushTotal = sum(pushups, (p) => p.correct);
  const pushSet = Math.max(0, ...pushups.map((p) => p.correct));
  const moodDays = Object.keys(moods).length;
  const goodSleep = Object.values(sleep).filter((s) => s.h >= 7 && s.h <= 9).length;

  const A = (id, icon, name, desc, value, target, unit = '') => ({ id, icon, name, desc, value, target, unit, done: value >= target });
  return [
    A('first', '👟', 'Первый шаг', 'Запишите первую активность', history.length, 1),
    A('km10', '🌱', 'Десятка', 'Пройдите 10 км в сумме', totalKm, 10, 'км'),
    A('km100', '🥾', 'Сотня', 'Пройдите 100 км в сумме', totalKm, 100, 'км'),
    A('km500', '🧭', 'Путешественник', 'Пройдите 500 км в сумме', totalKm, 500, 'км'),
    A('one5', '⛰️', 'Пятёрка за раз', 'Пройдите 5 км за одну прогулку', bestKm, 5, 'км'),
    A('one10', '🏔️', 'Десять за раз', 'Пройдите 10 км за одну прогулку', bestKm, 10, 'км'),
    A('one21', '🏅', 'Полумарафон', 'Пройдите 21 км за одну прогулку', bestKm, 21.1, 'км'),
    A('streak3', '🔥', 'Три дня подряд', 'Серия активных дней: 3', best, 3, 'дн.'),
    A('streak7', '🔥', 'Неделя огня', 'Серия активных дней: 7', best, 7, 'дн.'),
    A('streak30', '💎', 'Железный месяц', 'Серия активных дней: 30', best, 30, 'дн.'),
    A('goal5', '🎯', 'Мастер цели', `Выполните цель ${g.goalKm} км в 5 разных днях`, goalDays, 5, 'дн.'),
    A('lark', '🌅', 'Жаворонок', 'Выйдите на прогулку до 7 утра (от 500 м)', early ? 1 : 0, 1),
    A('owl', '🦉', 'Сова', 'Прогуляйтесь после 22:00 (от 500 м)', late ? 1 : 0, 1),
    A('speed', '💨', 'Ветерок', 'Разгонитесь до 8 км/ч', maxKmh, 8, 'км/ч'),
    A('cal', '⚡', 'Тысяча калорий', 'Сожгите 1000 ккал в сумме', cal, 1000, 'ккал'),
    A('hr', '❤️', 'Сердце в деле', 'Запишите прогулку с датчиком пульса', withHr ? 1 : 0, 1),
    A('push10', '💪', 'Десять чистых', 'Сделайте 10 правильных отжиманий за подход', pushSet, 10),
    A('push100', '🦾', 'Сотня отжиманий', 'Сделайте 100 правильных отжиманий в сумме', pushTotal, 100),
    A('mood7', '🙂', 'Осознанность', 'Отметьте настроение в 7 разных днях', moodDays, 7, 'дн.'),
    A('sleep5', '😴', 'Выспаться', 'Запишите 5 ночей сна по 7-9 часов', goodSleep, 5, 'ноч.'),
  ];
}

export const shareText = (a) => `${a.icon} Достижение «${a.name}» в приложении «Шагомер»: ${a.desc.charAt(0).toLowerCase()}${a.desc.slice(1)}. Присоединяйтесь!`;
export function shareSummary(list) {
  const done = list.filter((a) => a.done);
  return `Мои достижения в «Шагомере»: ${done.length} из ${list.length}.${done.length ? '\n' + done.map((a) => `${a.icon} ${a.name}`).join('\n') : ''}`;
}

// Правила здоровья и советы. Чистая логика, без React. Это ориентиры, не медицинские рекомендации.
import { haversine } from './tracker.js';

export const bmi = (w, h) => w / ((h / 100) ** 2);
export const bmiLabel = (v) => (v < 18.5 ? 'Недостаточный вес' : v < 25 ? 'Норма' : v < 30 ? 'Избыточный вес' : 'Ожирение');
export const healthyRange = (h) => [18.5, 24.9].map((b) => Math.round(b * (h / 100) ** 2 * 10) / 10);

// Формула Миффлина-Сан Жеора
export function bmr(p) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * (p.age || 30);
  return Math.round(p.sex === 'f' ? base - 161 : base + 5);
}
export const dailyCalories = (p, factor = 1.375) => Math.round(bmr(p) * factor);

// Цель по весу: сколько калорий в день и за сколько недель
export function weightPlan(p, target) {
  const diff = Math.round((target - p.weight) * 10) / 10;
  const tdee = dailyCalories(p);
  if (Math.abs(diff) < 0.5) return { dir: 'keep', diff: 0, calories: tdee, weeks: 0, tips: KEEP_TIPS };
  if (diff < 0) {
    const floor = p.sex === 'f' ? 1200 : 1500;
    const calories = Math.max(floor, tdee - 500);
    return { dir: 'lose', diff, calories, weeks: Math.ceil(-diff / 0.5), tips: LOSE_TIPS, floored: calories === floor };
  }
  return { dir: 'gain', diff, calories: tdee + 300, weeks: Math.ceil(diff / 0.25), tips: GAIN_TIPS };
}
const LOSE_TIPS = [
  'Безопасный темп: около 0,5 кг в неделю. Быстрее не нужно.',
  'Белок в каждом приёме пищи помогает не терять мышцы и дольше не хочется есть.',
  'Сахарные напитки заменяйте водой, это самая простая экономия калорий.',
  'Ходьба 30-45 минут в день добавляет заметный расход без стресса для суставов.',
  'Спите 7-9 часов: при недосыпе растёт аппетит.',
];
const GAIN_TIPS = [
  'Безопасный темп: 0,25-0,5 кг в неделю, чтобы набирался не только жир.',
  'Добавьте 2-3 перекуса: орехи, творог, банан с арахисовой пастой.',
  'Силовые тренировки 2-3 раза в неделю направляют набор в мышцы.',
  'Белок: примерно 1,6-2 г на кг веса в день.',
  'Не пропускайте завтрак и ешьте через равные промежутки.',
];
const KEEP_TIPS = ['Ваш вес близок к цели. Поддерживайте режим сна, ходьбу и разнообразное питание.'];
export const WEIGHT_NOTE = 'Расчёт приблизительный. При хронических заболеваниях, беременности и резких изменениях веса посоветуйтесь с врачом.';

// Пульс
export const maxHr = (age) => 220 - (age || 30);
export function hrZone(bpm, age, resting = false) {
  if (resting) return 'rest';
  const p = bpm / maxHr(age);
  return p < 0.5 ? 'rest' : p < 0.7 ? 'walk' : 'sport';
}
export const ZONES = { rest: 'Покой', walk: 'Ходьба', sport: 'Спорт' };

// Совет при высоком пульсе во время активности
export function restAdvice(bpm, age) {
  if (!bpm) return null;
  const p = bpm / maxHr(age);
  if (p >= 0.92) return { level: 'high', text: `Пульс ${bpm}: очень высокий. Остановитесь, присядьте, дышите глубоко и пейте воду. Если есть боль в груди или головокружение, обратитесь за помощью.` };
  if (p >= 0.85) return { level: 'mid', text: `Пульс ${bpm}: высокий. Снизьте темп или передохните минуту-две.` };
  return null;
}
export function restingRating(bpm) {
  return bpm < 50 ? 'Очень низкий, у тренированных это нормально' : bpm <= 60 ? 'Отличный' : bpm <= 80 ? 'Нормальный' : bpm <= 100 ? 'Повышенный' : 'Высокий, стоит обратиться к врачу';
}
// Минуты по зонам пульса для записанной активности
export function hrBreakdown(session, age) {
  const sm = session.hr && session.hr.samples;
  if (!sm || sm.length < 2) return null;
  const out = { rest: 0, walk: 0, sport: 0 };
  for (let i = 0; i < sm.length - 1; i++) {
    const dt = Math.min(30, sm[i + 1][0] - sm[i][0]);
    out[hrZone(sm[i][1], age)] += Math.max(0, dt);
  }
  const total = out.rest + out.walk + out.sport;
  return total > 0 ? { ...out, total } : null;
}

// Интенсивность по скорости на отрезках маршрута: доли времени
export function intensity(session) {
  const pts = session.points || [];
  const o = { low: 0, mid: 0, high: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (b.brk) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0 || dt > 120) continue;
    const kmh = (haversine(a, b) / dt) * 3.6;
    if (kmh < 0.5 * 3.6) continue;
    o[kmh < 4 ? 'low' : kmh < 6.4 ? 'mid' : 'high'] += dt;
  }
  const total = o.low + o.mid + o.high;
  if (total < 30) return null;
  return { low: o.low / total, mid: o.mid / total, high: o.high / total, total };
}

// Сон
export function sleepRange(age) { age = age || 30; return age < 18 ? [8, 10] : age < 65 ? [7, 9] : [7, 8]; }
export function sleepAdvice(hours, age) {
  const [lo, hi] = sleepRange(age);
  if (hours < lo - 1.5) return { level: 'bad', text: `Сна мало: нужно ${lo}-${hi} ч. Сегодня ляжьте раньше и избегайте кофеина после обеда.` };
  if (hours < lo) return { level: 'warn', text: `Немного не хватает сна, цель ${lo}-${hi} ч. Попробуйте лечь на 30-60 минут раньше.` };
  if (hours > hi + 1.5) return { level: 'warn', text: `Сна больше ${hi} ч. Если при этом вы разбиты, обратите внимание на качество сна.` };
  return { level: 'ok', text: `Сон в норме (${lo}-${hi} ч). Сохраняйте режим, в том числе в выходные.` };
}
// Когда лечь, чтобы проснуться в wake (HH:MM): циклы по 90 минут и 15 минут на засыпание
export function bedtimes(wake) {
  const [h, m] = wake.split(':').map(Number);
  return [6, 5, 4].map((c) => {
    let t = h * 60 + m - c * 90 - 15; t = ((t % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  });
}

// Жизненные силы 0..100 из доступных показателей
export function vitality({ sleepH, mood, activeMin, goalMin, restHr, age }) {
  const parts = [];
  if (sleepH != null) { const [lo, hi] = sleepRange(age); const s = sleepH >= lo && sleepH <= hi ? 1 : sleepH < lo ? Math.max(0, 1 - (lo - sleepH) / 4) : Math.max(0.5, 1 - (sleepH - hi) / 6); parts.push(['Сон', Math.round(s * 100)]); }
  if (mood != null) parts.push(['Настроение', Math.round(((mood - 1) / 4) * 100)]);
  if (activeMin != null) parts.push(['Активность', Math.round(Math.min(1, activeMin / (goalMin || 30)) * 100)]);
  if (restHr != null) parts.push(['Пульс покоя', Math.round(Math.max(0, Math.min(1, (95 - restHr) / 40)) * 100)]);
  // одной активности мало: без сна, настроения или пульса показатель ничего не говорит о силах
  if (!parts.some((p) => p[0] !== 'Активность')) return null;
  return { value: Math.round(parts.reduce((a, p) => a + p[1], 0) / parts.length), parts };
}
export const vitalityLabel = (v) => (v >= 75 ? 'Много сил' : v >= 50 ? 'Нормально' : v >= 30 ? 'Силы на исходе' : 'Нужен отдых');

export const MOODS = [
  { v: 1, e: '😞', t: 'Плохо' }, { v: 2, e: '🙁', t: 'Так себе' }, { v: 3, e: '😐', t: 'Нормально' },
  { v: 4, e: '🙂', t: 'Хорошо' }, { v: 5, e: '😄', t: 'Отлично' },
];

// Советы во время тренировки. mins — сколько идёт запись
export function liveTip({ mins, bpm, age, kmh, headphones = true }) {
  const r = restAdvice(bpm, age);
  if (r) return { level: r.level, text: r.text };
  if (mins >= 25 && headphones) return { level: 'info', text: 'Если слушаете музыку в наушниках, держите громкость не выше 60%: так слух защищён, а вы лучше слышите улицу.' };
  if (mins >= 20) return { level: 'info', text: 'Пора сделать несколько глотков воды, даже если жажды нет.' };
  if (mins >= 10 && kmh > 0 && kmh < 3) return { level: 'info', text: 'Темп спокойный. Чтобы получить пользу для сердца, попробуйте шагать чуть бодрее: чтобы можно было говорить, но не петь.' };
  if (mins >= 3 && mins < 10) return { level: 'info', text: 'Держите спину ровно, шаг естественный, руки согнуты и двигаются в такт.' };
  return null;
}
export const SETUP_TIPS = [
  'Перед стартом 3-5 минут разомнитесь: круги плечами, наклоны, шаги на месте.',
  'Выберите удобную обувь и возьмите воду, если идёте дольше 30 минут.',
  'Новичку: начните с 20-30 минут в удобном темпе и добавляйте по 5 минут в неделю.',
  'Если слушаете музыку в наушниках, поставьте громкость не выше 60%.',
  'Подключите датчик пульса, чтобы приложение подсказывало, когда пора снизить темп.',
];

// Правила «тренера»: советы по данным пользователя
export function coach(ctx) {
  const { streak = 0, daysSince = null, weekChange = null, sleepH = null, mood = null, restHr = null, profile, activeToday = false } = ctx;
  const out = [];
  if (daysSince === null) out.push('Запишите первую прогулку, и я начну давать советы по вашим данным.');
  else if (daysSince >= 3) out.push(`Вы не двигались ${daysSince} ${daysSince < 5 ? 'дня' : 'дней'}. Начните с 15 минут лёгкой ходьбы, главное вернуть привычку.`);
  else if (!activeToday) out.push('Сегодня вы ещё не двигались. Даже 10 минут ходьбы сохранят вашу серию.');
  if (streak >= 3) out.push(`Серия ${streak} дней подряд. Не забывайте про день лёгкой нагрузки раз в неделю.`);
  if (weekChange !== null) {
    if (weekChange >= 40) out.push(`Нагрузка выросла на ${weekChange}% к прошлой неделе. Прибавляйте не больше 10-20% за раз, чтобы избежать травм.`);
    else if (weekChange <= -30) out.push(`Нагрузка упала на ${Math.abs(weekChange)}%. Если это не плановый отдых, вернитесь к привычному объёму постепенно.`);
  }
  if (sleepH !== null) { const a = sleepAdvice(sleepH, profile && profile.age); if (a.level !== 'ok') out.push(a.text); }
  if (mood !== null && mood <= 2) out.push('Настроение низкое. Прогулка на свежем воздухе в светлое время суток часто помогает. Если плохое настроение держится долго, поговорите с близкими или специалистом.');
  if (restHr !== null && restHr > 80) out.push(`Пульс покоя ${restHr} уд/мин повышен. Помогают регулярная ходьба, сон и меньше кофеина. Если держится выше 100, обратитесь к врачу.`);
  if (profile) {
    const b = bmi(profile.weight, profile.height);
    if (b >= 25) out.push('Для мягкого снижения веса увеличивайте ежедневную ходьбу, вес можно рассчитать на вкладке «Здоровье».');
    else if (b < 18.5) out.push('Вес ниже нормы: сочетайте достаточное питание с силовой нагрузкой.');
  }
  if (!out.length) out.push('Всё идёт хорошо. Продолжайте в том же духе и следите за сном и водой.');
  return out.slice(0, 5);
}

// Достижения для функции «поделиться» будут на следующем этапе.

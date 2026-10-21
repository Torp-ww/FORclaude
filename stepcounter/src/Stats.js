import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { C } from './theme';
import { Icon, Card, Button } from './ui';
import { BarChart, Ring, DayDot, LineChart } from './charts';
import { fmtDuration, fmtKm, kmh, fmtPace } from './tracker.js';
import * as S from './stats.js';
import Awards from './Awards';
import { feat } from './store';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const METRICS = {
  distance: { name: 'Км', get: (d) => d.distance / 1000, fmt: (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)), goal: (g) => g.goalKm },
  minutes: { name: 'Минуты', get: (d) => d.movingMs / 60000, fmt: (v) => String(Math.round(v)), goal: (g) => g.goalMin },
  steps: { name: 'Шаги', get: (d) => d.steps, fmt: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'к' : String(v)) },
  calories: { name: 'Ккал', get: (d) => d.calories, fmt: (v) => String(Math.round(v)) },
};
const fmtDay = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function Chips({ items, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {items.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[st.chip, value === k && st.chipOn]}>
          <Text style={[st.chipText, value === k && { color: '#fff' }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Stats({ history, profile, historyView }) {
  const [seg, setSeg] = useState('week');
  const [offset, setOffset] = useState(0);
  const [metric, setMetric] = useState('distance');
  const now = Date.now();
  const kind = seg === 'month' ? 'month' : 'week';
  const goals = { goalKm: profile.goalKm, goalMin: profile.goalMin };
  const g = { ...S.DEFAULT_GOALS, ...goals };

  const data = useMemo(() => {
    if (seg === 'history' || seg === 'awards') return null;
    const range = S.periodRange(kind, now, offset);
    const days = S.daySeries(history, range);
    const cur = S.totals(days), prev = S.totals(S.daySeries(history, S.periodRange(kind, now, offset - 1)));
    return {
      range, days, cur, prev,
      goal: S.goalStats(days, goals, now),
      streak: S.streaks(history, now),
      rec: S.records(history),
      fit: S.fitnessSeries(history, now, 8),
      report: S.buildReport(history, kind, now, offset, goals),
    };
  }, [history, seg, offset, profile.goalKm, profile.goalMin]);

  const header = (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={st.h1}>Статистика</Text>
      <View style={st.seg}>
        {[['week', 'Неделя'], ['month', 'Месяц'], ['history', 'История'], ...(feat(profile, 'awards') ? [['awards', 'Награды']] : [])].map(([k, l]) => (
          <Pressable key={k} onPress={() => { setSeg(k); setOffset(0); }} style={[st.segItem, seg === k && st.segOn]}>
            <Text style={[st.segText, seg === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
  if (seg === 'history') return <View style={{ flex: 1 }}>{header}<View style={{ flex: 1 }}>{historyView}</View></View>;
  if (seg === 'awards') return <View style={{ flex: 1 }}>{header}<View style={{ flex: 1 }}><Awards history={history} profile={profile} /></View></View>;

  const { range, days, cur, prev, goal, streak, rec, fit, report } = data;
  const todayT = S.dayStart(now);
  const delta = S.change(cur.distance, prev.distance);
  const m = METRICS[metric];
  const bars = days.map((d, i) => ({
    label: kind === 'week' ? WD[i] : String(new Date(d.t0).getDate()),
    value: m.get(d), mark: m.goal ? m.get(d) >= m.goal(g) : false,
  }));
  const fitNow = fit[fit.length - 1].value, fitPrev = fit[fit.length - 2].value;
  const offsetDay = (new Date(range.from).getDay() + 6) % 7; // для календаря месяца
  const empty = history.length === 0;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      {header}
      <View style={{ padding: 20, gap: 12 }}>
        <View style={st.nav}>
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={14}><Icon name="chevron" size={22} color={C.fg} style={{ transform: [{ rotate: '180deg' }] }} /></Pressable>
          <Text style={st.navText}>{S.periodLabel(range)}</Text>
          <Pressable onPress={() => offset < 0 && setOffset(offset + 1)} hitSlop={14}><Icon name="chevron" size={22} color={offset < 0 ? C.fg : C.line} /></Pressable>
        </View>

        {empty && <Text style={st.sub}>Пока нет записанных активностей. Запишите первую прогулку, и здесь появятся графики, рекорды и отчёты.</Text>}

        <Card style={{ paddingVertical: 18 }}>
          <Text style={st.label}>ДИСТАНЦИЯ ЗА {kind === 'week' ? 'НЕДЕЛЮ' : 'МЕСЯЦ'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={st.hero}>{fmtKm(cur.distance)}</Text><Text style={st.unit}>км</Text>
            {delta !== null && <Text style={[st.delta, { color: delta >= 0 ? C.green : C.stop }]}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</Text>}
          </View>
          <Text style={st.sub}>{delta !== null ? 'к прошлому периоду · ' : ''}{cur.count} активн., {fmtDuration(cur.movingMs)} в движении</Text>
        </Card>

        <Card>
          <Text style={[st.label, { marginBottom: 12 }]}>АКТИВНЫЕ ДНИ · {cur.activeDays} из {days.length}</Text>
          {kind === 'week' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {days.map((d, i) => <DayDot key={i} label={WD[i]} fill={Math.max(S.dayProgress(d, goals).km, S.dayProgress(d, goals).min)} active={S.isActive(d)} today={d.t0 === todayT} />)}
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>{WD.map((w) => <Text key={w} style={st.calHead}>{w}</Text>)}</View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: offsetDay }).map((_, i) => <View key={'e' + i} style={st.calCell} />)}
                {days.map((d, i) => {
                  const p = Math.max(S.dayProgress(d, goals).km, S.dayProgress(d, goals).min), act = S.isActive(d);
                  return (
                    <View key={i} style={st.calCell}>
                      <View style={[st.calDot, { borderColor: d.t0 === todayT ? C.fg : act ? C.accent : C.line, backgroundColor: act ? `rgba(255,90,31,${(0.35 + p * 0.65).toFixed(2)})` : C.surface2 }]}>
                        <Text style={{ color: act ? '#fff' : C.dim, fontSize: 11, fontWeight: '700' }}>{new Date(d.t0).getDate()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <Text style={[st.sub, { marginTop: 12 }]}>День считается активным, если набрано 10 минут в движении или 1 км. Заливка кружка показывает выполнение вашей цели.</Text>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={st.flame}><Icon name="flame" size={30} color={streak.current > 0 ? C.accent : C.dim} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>СЕРИЯ АКТИВНЫХ ДНЕЙ</Text>
            <Text style={st.val}>{streak.current} <Text style={st.unit}>{plural(streak.current, 'день', 'дня', 'дней')} подряд</Text></Text>
            <Text style={st.sub}>Лучшая серия: {streak.best} {plural(streak.best, 'день', 'дня', 'дней')}</Text>
          </View>
        </Card>

        <Card>
          <Text style={[st.label, { marginBottom: 10 }]}>РЕЗУЛЬТАТЫ ПО ДНЯМ</Text>
          <Chips items={Object.entries(METRICS).map(([k, v]) => [k, v.name])} value={metric} onChange={setMetric} />
          <View style={{ height: 14 }} />
          <BarChart data={bars} goal={m.goal ? m.goal(g) : undefined} fmt={m.fmt} showEvery={kind === 'month' ? 2 : 1} height={150} />
          {m.goal && <Text style={[st.sub, { marginTop: 8 }]}>Зелёная линия и столбцы: ваша цель ({m.goal(g)} {metric === 'distance' ? 'км' : 'мин'} в день).</Text>}
        </Card>

        <Card>
          <Text style={[st.label, { marginBottom: 12 }]}>ВЫПОЛНЕНИЕ ЦЕЛЕЙ</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <GoalRing value={goal.km} total={Math.max(1, goal.elapsed)} label={`${g.goalKm} км в день`} />
            <GoalRing value={goal.min} total={Math.max(1, goal.elapsed)} label={`${g.goalMin} мин в день`} color={C.green} />
          </View>
          <Text style={[st.sub, { marginTop: 12, textAlign: 'center' }]}>Цели меняются в разделе «Профиль».</Text>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={st.label}>ФИЗИЧЕСКАЯ ФОРМА</Text>
              <Text style={st.val}>{fitNow}<Text style={st.unit}> из 100 · {S.fitnessLabel(fitNow)}</Text></Text>
            </View>
            {fitNow !== fitPrev && <Text style={[st.delta, { color: fitNow > fitPrev ? C.green : C.stop }]}>{fitNow > fitPrev ? '▲' : '▼'} {Math.abs(fitNow - fitPrev)}</Text>}
          </View>
          <View style={{ height: 8 }} />
          <LineChart values={fit.map((f) => f.value)} labels={fit.map((f) => new Date(f.from).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }))} />
          <Text style={[st.sub, { marginTop: 8 }]}>Упрощённый индекс по неделям: сколько минут вы двигались (норма 150 в неделю), сколько дней были активны и с какой скоростью. Это не медицинский показатель.</Text>
        </Card>

        <Card>
          <Text style={[st.label, { marginBottom: 8 }]}>ПРОГРЕСС: ЭТОТ ПЕРИОД И ПРОШЛЫЙ</Text>
          <Compare label="Дистанция" cur={cur.distance / 1000} prev={prev.distance / 1000} unit="км" />
          <Compare label="Время в движении" cur={cur.movingMs / 60000} prev={prev.movingMs / 60000} unit="мин" />
          <Compare label="Активных дней" cur={cur.activeDays} prev={prev.activeDays} unit="" />
          <Compare label="Ср. скорость" cur={cur.avgKmh} prev={prev.avgKmh} unit="км/ч" />
        </Card>

        <Card>
          <Text style={[st.label, { marginBottom: 8 }]}>ТАБЛИЦА РЕКОРДОВ</Text>
          <Rec icon="🏃" name="Самая длинная прогулка" v={rec.distance && `${fmtKm(rec.distance.value)} км`} t={rec.distance?.t} />
          <Rec icon="⏱" name="Самая долгая активность" v={rec.duration && fmtDuration(rec.duration.value)} t={rec.duration?.t} />
          <Rec icon="⚡" name="Максимальная скорость" v={rec.maxSpeed && `${kmh(rec.maxSpeed.value).toFixed(1)} км/ч`} t={rec.maxSpeed?.t} />
          <Rec icon="🎯" name="Лучший темп (от 1 км)" v={rec.pace && `${fmtPace(rec.pace.value)} /км`} t={rec.pace?.t} />
          <Rec icon="📅" name="Больше всего за день" v={rec.dayDistance && `${fmtKm(rec.dayDistance.value)} км`} t={rec.dayDistance?.t} />
          <Rec icon="👟" name="Больше всего шагов за день" v={rec.daySteps && rec.daySteps.value.toLocaleString('ru-RU')} t={rec.daySteps?.t} />
          <Rec icon="🔥" name="Больше всего калорий" v={rec.calories && `${Math.round(rec.calories.value)} ккал`} t={rec.calories?.t} />
          <Rec icon="❤️" name="Максимальный пульс" v={rec.hrMax && `${rec.hrMax.value} уд/мин`} t={rec.hrMax?.t} />
          <Rec icon="🏅" name="Лучшая серия" v={rec.streak > 0 ? `${rec.streak} ${plural(rec.streak, 'день', 'дня', 'дней')}` : null} last />
        </Card>

        <Card>
          <Text style={st.label}>{kind === 'week' ? 'ОТЧЁТ ЗА НЕДЕЛЮ' : 'ОТЧЁТ ЗА МЕСЯЦ'}</Text>
          <Text style={[st.val, { fontSize: 18, marginBottom: 8 }]}>{S.periodLabel(range)}</Text>
          {report.lines.map((l, i) => <Text key={i} style={st.line}>• {l}</Text>)}
          <Button text="Поделиться отчётом" onPress={() => Share.share({ message: report.text }).catch(() => {})} style={{ marginTop: 14 }} />
        </Card>
      </View>
    </ScrollView>
  );
}

function plural(n, a, b, c) { const m = n % 100, d = n % 10; return m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }

function GoalRing({ value, total, label, color = C.accent }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Ring progress={value / total} size={92} color={color}>
        <Text style={{ color: C.fg, fontSize: 18, fontWeight: '800' }}>{value}/{total}</Text>
      </Ring>
      <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.dim, fontSize: 11 }}>дней выполнено</Text>
    </View>
  );
}

function Compare({ label, cur, prev, unit }) {
  const max = Math.max(cur, prev, 0.0001), dp = S.change(cur, prev);
  const f = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.fg, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: dp === null ? C.dim : dp >= 0 ? C.green : C.stop, fontSize: 13, fontWeight: '700' }}>{dp === null ? 'нет данных' : `${dp >= 0 ? '+' : ''}${dp}%`}</Text>
      </View>
      <View style={{ marginTop: 6, gap: 4 }}>
        <View style={st.cmpRow}><View style={{ flex: 1 }}><View style={[st.cmpBar, { width: `${Math.max(2, (cur / max) * 100)}%`, backgroundColor: C.accent }]} /></View><Text style={st.cmpVal}>{f(cur)} {unit}</Text></View>
        <View style={st.cmpRow}><View style={{ flex: 1 }}><View style={[st.cmpBar, { width: `${Math.max(2, (prev / max) * 100)}%`, backgroundColor: C.dim }]} /></View><Text style={st.cmpVal}>{f(prev)} {unit}</Text></View>
      </View>
    </View>
  );
}

function Rec({ icon, name, v, t, last }) {
  return (
    <View style={[st.recRow, !last && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
      <Text style={{ fontSize: 20, width: 32 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.fg, fontSize: 14, fontWeight: '600' }}>{name}</Text>
        {t ? <Text style={st.sub}>{fmtDay(t)}</Text> : null}
      </View>
      <Text style={{ color: v ? C.accent : C.dim, fontSize: 16, fontWeight: '800' }}>{v || '—'}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { color: C.fg, fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.dim, fontWeight: '700', fontSize: 13 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  navText: { color: C.fg, fontSize: 17, fontWeight: '700' },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  hero: { color: C.fg, fontSize: 52, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  unit: { color: C.dim, fontSize: 16, fontWeight: '700' },
  val: { color: C.fg, fontSize: 28, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  delta: { fontSize: 15, fontWeight: '800', marginLeft: 6 },
  sub: { color: C.dim, fontSize: 13 },
  line: { color: C.fg, fontSize: 15, lineHeight: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface2 },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.dim, fontWeight: '700', fontSize: 13 },
  flame: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  calHead: { width: `${100 / 7}%`, textAlign: 'center', color: C.dim, fontSize: 11, fontWeight: '700' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  calDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmpBar: { height: 8, borderRadius: 4 },
  cmpVal: { color: C.dim, fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 70, textAlign: 'right' },
  recRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});

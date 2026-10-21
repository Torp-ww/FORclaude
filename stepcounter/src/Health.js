import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { C } from './theme';
import { Card, Button, Icon } from './ui';
import { BarChart, Ring } from './charts';
import * as DB from './store';
import * as H from './health.js';
import * as S from './stats.js';
import Pushups from './Pushups';

const key = (t = Date.now()) => S.dayKey(t);
const num = (v) => Number(String(v).replace(',', '.'));

export default function Health({ history, profile }) {
  const on = (k) => DB.feat(profile, k);
  const [moods, setMoods] = useState({});
  const [sleep, setSleep] = useState({});
  const [rest, setRest] = useState({});
  const [sleepIn, setSleepIn] = useState('');
  const [restIn, setRestIn] = useState('');
  const [wake, setWake] = useState('07:00');
  const [target, setTarget] = useState('');
  const [pushOpen, setPushOpen] = useState(false);
  useEffect(() => { Promise.all([DB.loadMoods(), DB.loadSleep(), DB.loadRestHr()]).then(([m, s, r]) => { setMoods(m); setSleep(s); setRest(r); }); }, []);

  const now = Date.now(), today = key(now);
  const age = profile.age || 30;
  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => S.addDays(S.dayStart(now), i - 13)), [today]);
  const moodBars = days14.map((t) => ({ label: String(new Date(t).getDate()), value: moods[key(t)]?.v || 0 }));
  const moodAvg = (() => { const v = days14.map((t) => moods[key(t)]?.v).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
  const restVals = days14.slice(-7).map((t) => rest[key(t)]?.avg).filter(Boolean);
  const restAvg = restVals.length ? Math.round(restVals.reduce((a, b) => a + b, 0) / restVals.length) : null;

  const per = S.perDay(history);
  const last7 = S.totals(days14.slice(-7).map((t) => per.get(key(t)) || { t0: t, distance: 0, calories: 0, steps: 0, movingMs: 0, totalMs: 0, count: 0, maxSpeed: 0 }));
  const prev7 = S.totals(days14.slice(0, 7).map((t) => per.get(key(t)) || { t0: t, distance: 0, calories: 0, steps: 0, movingMs: 0, totalMs: 0, count: 0, maxSpeed: 0 }));
  const todayAct = per.get(today);
  const lastActive = [...per.values()].filter(S.isActive).map((d) => d.t0).sort((a, b) => b - a)[0];
  const daysSince = lastActive == null ? null : Math.round((S.dayStart(now) - lastActive) / S.DAY);
  const sleepToday = sleep[today]?.h ?? null;
  const moodToday = moods[today]?.v ?? null;

  const vit = H.vitality({ sleepH: sleepToday, mood: moodToday, activeMin: todayAct ? todayAct.movingMs / 60000 : 0, goalMin: profile.goalMin, restHr: restAvg, age });
  const tips = on('coach') ? H.coach({
    streak: S.streaks(history, now).current, daysSince, weekChange: S.change(last7.distance, prev7.distance),
    sleepH: sleepToday, mood: moodToday, restHr: restAvg, profile, activeToday: S.isActive(todayAct),
  }) : [];

  const setMood = async (v) => { const m = { ...moods, [today]: { v, t: Date.now() } }; setMoods(m); await DB.saveMoods(m); };
  const saveSleep = async () => {
    const h = num(sleepIn);
    if (!(h >= 1 && h <= 16)) return Alert.alert('Проверьте данные', 'Сон от 1 до 16 часов.');
    const m = { ...sleep, [today]: { h } }; setSleep(m); await DB.saveSleep(m); setSleepIn('');
  };
  const saveRest = async () => {
    const b = num(restIn);
    if (!(b >= 30 && b <= 150)) return Alert.alert('Проверьте данные', 'Пульс покоя от 30 до 150 уд/мин.');
    const m = { ...rest, [today]: { avg: Math.round(b), n: 1 } }; setRest(m); await DB.saveRestHr(m); setRestIn('');
  };

  const bmiV = H.bmi(profile.weight, profile.height);
  const [lo, hi] = H.healthyRange(profile.height);
  const tw = num(target);
  const plan = tw >= 30 && tw <= 250 ? H.weightPlan({ ...profile, age }, tw) : null;
  const mx = H.maxHr(age);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>Здоровье</Text>

      {tips.length > 0 && (
        <Card>
          <Text style={st.label}>ТРЕНЕР СОВЕТУЕТ</Text>
          {tips.map((t, i) => <Text key={i} style={st.tip}>• {t}</Text>)}
          <Text style={[st.sub, { marginTop: 8 }]}>Советы строятся по правилам из ваших данных, это не медицинские рекомендации.</Text>
        </Card>
      )}

      {on('pushups') && (
        <Pressable onPress={() => setPushOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: 20, padding: 16 }}>
          <Text style={{ fontSize: 30 }}>💪</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.fg, fontSize: 17, fontWeight: '800' }}>Счётчик отжиманий</Text>
            <Text style={st.sub}>Считает правильные повторения по датчику движения</Text>
          </View>
          <Icon name="chevron" size={18} color={C.dim} />
        </Pressable>
      )}
      <Pushups visible={pushOpen} onClose={() => setPushOpen(false)} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring progress={vit ? vit.value / 100 : 0} size={92} color={vit && vit.value < 30 ? C.stop : vit && vit.value < 50 ? C.warn : C.green}>
          <Text style={{ color: C.fg, fontSize: 22, fontWeight: '800' }}>{vit ? vit.value : '—'}</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>ЖИЗНЕННЫЕ СИЛЫ</Text>
          <Text style={st.val}>{vit ? H.vitalityLabel(vit.value) : 'Нет данных'}</Text>
          <Text style={st.sub}>{vit ? vit.parts.map((p) => `${p[0]} ${p[1]}`).join(' · ') : 'Отметьте настроение или сон, и показатель появится.'}</Text>
        </View>
      </Card>

      {on('mood') && (
        <Card>
          <Text style={[st.label, { marginBottom: 12 }]}>КАК ВЫ СЕБЯ ЧУВСТВУЕТЕ СЕГОДНЯ</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {H.MOODS.map((m) => (
              <Pressable key={m.v} onPress={() => setMood(m.v)} accessibilityLabel={m.t} style={[st.mood, moodToday === m.v && st.moodOn]}>
                <Text style={{ fontSize: 28 }}>{m.e}</Text>
                <Text style={{ color: moodToday === m.v ? '#fff' : C.dim, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{m.t}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[st.label, { marginTop: 16, marginBottom: 8 }]}>НАСТРОЕНИЕ ЗА 14 ДНЕЙ{moodAvg ? ` · СРЕДНЕЕ ${moodAvg.toFixed(1)} ИЗ 5` : ''}</Text>
          <BarChart data={moodBars} height={90} color={C.warn} fmt={(v) => H.MOODS[v - 1]?.e || ''} showEvery={2} />
        </Card>
      )}

      {on('sleep') && (
        <Card style={{ gap: 8 }}>
          <Text style={st.label}>СОН</Text>
          <Text style={st.sub}>Для вашего возраста нужно {H.sleepRange(age).join('-')} часов.{sleepToday != null ? ` Сегодня записано: ${sleepToday} ч.` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[st.input, { flex: 1 }]} value={sleepIn} onChangeText={setSleepIn} placeholder="Сколько часов спали?" placeholderTextColor={C.dim} keyboardType="decimal-pad" />
            <Button text="Сохранить" onPress={saveSleep} style={{ paddingHorizontal: 18, justifyContent: 'center' }} />
          </View>
          {sleepToday != null && <Text style={[st.tip, { color: { ok: C.green, warn: C.warn, bad: C.stop }[H.sleepAdvice(sleepToday, age).level] }]}>{H.sleepAdvice(sleepToday, age).text}</Text>}
          <Text style={[st.label, { marginTop: 8 }]}>ВО СКОЛЬКО ВАМ ВСТАВАТЬ</Text>
          <TextInput style={st.input} value={wake} onChangeText={setWake} placeholder="07:00" placeholderTextColor={C.dim} keyboardType="numbers-and-punctuation" maxLength={5} />
          {/^\d{1,2}:\d{2}$/.test(wake) && Number(wake.split(':')[0]) < 24 && Number(wake.split(':')[1]) < 60 && (
            <Text style={st.tip}>Чтобы проснуться бодрым, ложитесь в {H.bedtimes(wake).join(', ')}. Это целое число 90-минутных циклов сна плюс 15 минут на засыпание.</Text>
          )}
        </Card>
      )}

      {on('pulse') && (
        <Card style={{ gap: 8 }}>
          <Text style={st.label}>ПУЛЬС</Text>
          <Text style={st.val}>{restAvg ?? '—'}<Text style={st.unit}> уд/мин в покое</Text></Text>
          {restAvg != null && <Text style={st.sub}>{H.restingRating(restAvg)}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[st.input, { flex: 1 }]} value={restIn} onChangeText={setRestIn} placeholder="Пульс покоя сейчас" placeholderTextColor={C.dim} keyboardType="number-pad" maxLength={3} />
            <Button text="Сохранить" onPress={saveRest} style={{ paddingHorizontal: 18, justifyContent: 'center' }} />
          </View>
          <Text style={st.sub}>Если подключён датчик пульса, покой измеряется сам, когда вы на экране «Запись» и не двигаетесь. Лучше мерить утром до вставания.</Text>
          <Text style={[st.label, { marginTop: 8 }]}>ЗОНЫ ПУЛЬСА (ВОЗРАСТ {age}, МАКС. {mx})</Text>
          <Zone color={C.dim} name="Покой" range={`до ${Math.round(mx * 0.5)}`} />
          <Zone color={C.green} name="Ходьба" range={`${Math.round(mx * 0.5)}-${Math.round(mx * 0.7)}`} />
          <Zone color={C.accent} name="Спорт" range={`${Math.round(mx * 0.7)}-${Math.round(mx * 0.85)}`} />
          <Zone color={C.stop} name="Пора отдохнуть" range={`выше ${Math.round(mx * 0.85)}`} />
          <Text style={st.sub}>Возраст указывается в «Профиле», от него зависит максимальный пульс (220 минус возраст).</Text>
        </Card>
      )}

      {on('weight') && (
        <Card style={{ gap: 8 }}>
          <Text style={st.label}>КАЛЬКУЛЯТОР ВЕСА</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={st.val}>{bmiV.toFixed(1)}</Text><Text style={st.unit}>ИМТ · {H.bmiLabel(bmiV)}</Text>
          </View>
          <Text style={st.sub}>Для роста {profile.height} см здоровый вес примерно {lo}-{hi} кг. Ваш вес: {profile.weight} кг (меняется в «Профиле»).</Text>
          <Text style={st.sub}>Ориентир по калориям на день при обычной активности: {H.dailyCalories({ ...profile, age })} ккал.</Text>
          <Text style={[st.label, { marginTop: 8 }]}>ЦЕЛЕВОЙ ВЕС, КГ</Text>
          <TextInput style={st.input} value={target} onChangeText={setTarget} placeholder={`Например, ${Math.round((lo + hi) / 2)}`} placeholderTextColor={C.dim} keyboardType="decimal-pad" />
          {plan && (
            <View style={{ gap: 6 }}>
              <Text style={[st.val, { fontSize: 20 }]}>{plan.dir === 'keep' ? 'Поддерживать вес' : plan.dir === 'lose' ? `Сбросить ${Math.abs(plan.diff)} кг` : `Набрать ${plan.diff} кг`}</Text>
              <Text style={st.tip}>Калории: около {plan.calories} ккал в день{plan.dir !== 'keep' ? `, срок примерно ${plan.weeks} нед.` : ''}.{plan.floored ? ' Ниже этого уровня опускаться не стоит.' : ''}</Text>
              {plan.tips.map((t, i) => <Text key={i} style={st.tip}>• {t}</Text>)}
              <Text style={st.sub}>{H.WEIGHT_NOTE}</Text>
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

function Zone({ color, name, range }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ color: C.fg, fontSize: 14, flex: 1 }}>{name}</Text>
      <Text style={{ color: C.dim, fontSize: 14, fontVariant: ['tabular-nums'] }}>{range} уд/мин</Text>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { color: C.fg, fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  val: { color: C.fg, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { color: C.dim, fontSize: 14, fontWeight: '600' },
  sub: { color: C.dim, fontSize: 13, lineHeight: 18 },
  tip: { color: C.fg, fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: C.bg, color: C.fg, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16 },
  mood: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14, minWidth: 58 },
  moodOn: { backgroundColor: C.accent },
});

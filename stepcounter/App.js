import './src/task';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Platform, SafeAreaView, TextInput, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import RouteMap from './src/RouteMap';
import { LOCATION_TASK } from './src/task';
import * as P from './src/pills';
import * as DB from './src/store';
import { createSession, pauseSession, resumeSession, finishSession, summarize, kmh, fmtDuration, fmtDistance } from './src/tracker';

const C = { bg: '#0B1217', card: '#131D25', line: '#26363F', fg: '#F2F6F8', dim: '#8896A0', acc: '#5EEAD4', warn: '#FBBF24', stop: '#FB7185' };
const IOS = Platform.OS === 'ios';

// Точные шаги даёт только iOS (история CoreMotion). На Android шаги считаются по расстоянию и длине шага.
async function iosSteps(from, to) {
  if (!IOS) return null;
  try { return (await Pedometer.getStepCountAsync(new Date(from), new Date(to))).steps; } catch { return null; }
}
async function liveSteps(s) {
  if (!IOS) return null;
  const end = s.endedAt ?? Date.now();
  const all = await iosSteps(s.startedAt, end);
  if (all == null) return null;
  const inPause = s.pausedAt ? (await iosSteps(s.pausedAt, end)) ?? 0 : 0;
  return Math.max(0, all - s.pausedSteps - inPause);
}

function startUpdates() {
  return Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000,
    pausesUpdatesAutomatically: false, activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: 'Шагомер', notificationBody: 'Идёт запись активности', notificationColor: '#5EEAD4' },
  });
}
async function stopUpdates() {
  try { if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK); } catch {}
}

function Big({ label, value, unit }) {
  return (
    <View style={s.big}>
      <Text style={s.bigLabel}>{label}</Text>
      <Text style={s.bigValue} adjustsFontSizeToFit numberOfLines={1}>{value}<Text style={s.bigUnit}> {unit}</Text></Text>
    </View>
  );
}
function Small({ label, value, unit }) {
  return (
    <View style={s.small}>
      <Text style={s.smallLabel}>{label}</Text>
      <Text style={s.smallValue}>{value}{unit ? <Text style={s.smallUnit}> {unit}</Text> : null}</Text>
    </View>
  );
}

function Summary({ session, steps, expanded, onToggle }) {
  const r = summarize(session, Date.now(), steps);
  const d = fmtDistance(r.distance);
  return (
    <View>
      <View style={s.grid}>
        <Big label="Шаги" value={r.steps.toLocaleString('ru-RU')} unit="" />
        <Big label="Пройдено" value={d.v} unit={d.u} />
        <Big label="Калории" value={Math.round(r.calories)} unit="ккал" />
        <Big label="Время" value={fmtDuration(r.totalMs)} unit="" />
      </View>
      <Pressable onPress={onToggle} style={s.link}><Text style={s.linkText}>{expanded ? 'Скрыть подробности' : 'Подробнее'}</Text></Pressable>
      {expanded && (
        <View>
          <View style={s.smallRow}>
            <Small label="В движении" value={fmtDuration(r.movingMs)} />
            <Small label="Стоял" value={fmtDuration(r.idleMs)} />
          </View>
          <View style={s.smallRow}>
            <Small label="Средняя" value={kmh(r.avgSpeed).toFixed(1)} unit="км/ч" />
            <Small label="Макс." value={kmh(r.maxSpeed).toFixed(1)} unit="км/ч" />
            <Small label="Мин." value={kmh(r.minSpeed).toFixed(1)} unit="км/ч" />
          </View>
          <View style={s.card}><RouteMap points={session.points} /></View>
          {!IOS && <Text style={s.note}>На Android шаги считаются по расстоянию и вашему росту, это приблизительно.</Text>}
        </View>
      )}
    </View>
  );
}

function Walk({ profile }) {
  const [session, setSession] = useState(null);
  const [steps, setSteps] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [, tick] = useState(0);
  const active = session && !session.endedAt;
  const paused = active && !!session.pausedAt;

  // Подхватываем активность, которая шла в фоне, и обновляем экран каждую секунду.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const a = await DB.loadActive();
      if (!alive || !a) return;
      setSession(a); setSteps(await liveSteps(a)); tick((n) => n + 1);
    };
    DB.loadActive().then((a) => a && setSession(a));
    const id = setInterval(pull, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const start = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) { Alert.alert('Нужна геолокация', 'Разрешите доступ к геолокации в настройках телефона.'); return; }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) Alert.alert('Фоновая запись выключена', 'Чтобы считать шаги при выключенном экране, выберите для геолокации «Всегда» в настройках телефона.');
    if (IOS) { try { await Pedometer.requestPermissionsAsync(); } catch {} }
    const s0 = createSession(Date.now(), profile);
    await DB.saveActive(s0); setSession(s0); setSteps(0); setExpanded(false);
    await startUpdates();
  }, [profile]);

  const pause = async () => {
    await stopUpdates();
    const s1 = pauseSession((await DB.loadActive()) ?? session);
    await DB.saveActive(s1); setSession(s1);
  };
  const resume = async () => {
    let s1 = (await DB.loadActive()) ?? session;
    if (IOS && s1.pausedAt) {
      const inPause = (await iosSteps(s1.pausedAt, Date.now())) ?? 0;
      s1 = { ...s1, pausedSteps: s1.pausedSteps + inPause };
    }
    s1 = resumeSession(s1);
    await DB.saveActive(s1); setSession(s1);
    await startUpdates();
  };
  const stop = async () => {
    await stopUpdates();
    let s1 = (await DB.loadActive()) ?? session;
    const st = await liveSteps(s1);
    s1 = finishSession(s1); s1.finalSteps = st;
    const hist = await DB.loadHistory();
    if (s1.distance > 0) await DB.saveHistory([{ id: String(s1.startedAt), ...s1 }, ...hist].slice(0, 100));
    await DB.clearActive();
    setSession(s1); setSteps(st);
  };
  const reset = () => { setSession(null); setSteps(null); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.body}>
        {!session && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Готовы идти?</Text>
            <Text style={s.emptyText}>Нажмите «Старт» и идите. Телефон можно убрать в карман, экран может быть выключен.</Text>
          </View>
        )}
        {session && (
          <>
            <Text style={[s.state, paused && { color: C.warn }, !active && { color: C.dim }]}>
              {!active ? 'ГОТОВО' : paused ? 'ПАУЗА' : 'ИДЁТ ЗАПИСЬ'}
            </Text>
            <Summary session={session} steps={steps} expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </>
        )}
      </ScrollView>
      <View style={s.footer}>
        {!session && <Btn text="Старт" onPress={start} />}
        {active && !paused && (<View style={s.btnRow}><Btn text="Пауза" color={C.warn} onPress={pause} /><Btn text="Стоп" color={C.stop} onPress={stop} /></View>)}
        {paused && (<View style={s.btnRow}><Btn text="Продолжить" onPress={resume} /><Btn text="Стоп" color={C.stop} onPress={stop} /></View>)}
        {session && !active && <Btn text="Готово" onPress={reset} />}
      </View>
    </View>
  );
}

function Btn({ text, onPress, color = C.acc }) {
  return <Pressable onPress={onPress} style={[s.btn, { backgroundColor: color }]}><Text style={s.btnText}>{text}</Text></Pressable>;
}

function History() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => { DB.loadHistory().then(setList); }, []);
  const remove = async (id) => { const n = list.filter((h) => h.id !== id); setList(n); setOpen(null); await DB.saveHistory(n); };
  const fmt = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  if (open) return (
    <ScrollView contentContainerStyle={s.body}>
      <Pressable onPress={() => setOpen(null)}><Text style={s.back}>← Назад</Text></Pressable>
      <Text style={s.state}>{fmt(open.startedAt).toUpperCase()}</Text>
      <Summary session={open} steps={null} expanded onToggle={() => {}} />
      <Pressable onPress={() => remove(open.id)} style={s.del}><Text style={s.delText}>Удалить</Text></Pressable>
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={s.body}>
      {list.length === 0 && <Text style={s.emptyText}>Здесь появятся ваши прогулки.</Text>}
      {list.map((h) => {
        const r = summarize(h), d = fmtDistance(r.distance);
        return (
          <Pressable key={h.id} style={s.item} onPress={() => setOpen(h)}>
            <View><Text style={s.itemTitle}>{fmt(h.startedAt)}</Text><Text style={s.itemSub}>{fmtDuration(r.totalMs)} · {Math.round(r.calories)} ккал</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Text style={s.itemVal}>{d.v} {d.u}</Text><Text style={s.itemSub}>{r.steps.toLocaleString('ru-RU')} шагов</Text></View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Pills() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  useEffect(() => { DB.loadPills().then(setList); }, []);
  const commit = async (n) => { setList(n); await DB.savePills(n); };

  const add = async () => {
    const t = P.normalizeTime(time);
    if (!name.trim()) return Alert.alert('Введите название таблетки');
    if (!t) return Alert.alert('Введите время', 'Например 08:30');
    if (!(await P.askPermission())) return Alert.alert('Уведомления выключены', 'Разрешите уведомления в настройках телефона.');
    const nid = await P.schedulePill(name.trim(), t);
    await commit([...list, { id: String(Date.now()), name: name.trim(), time: t, on: true, nid }].sort((a, b) => a.time.localeCompare(b.time)));
    setName(''); setTime('');
  };
  const toggle = async (p) => {
    let nid = null;
    if (p.on) await P.cancelPill(p.nid); else nid = await P.schedulePill(p.name, p.time);
    await commit(list.map((x) => (x.id === p.id ? { ...x, on: !p.on, nid } : x)));
  };
  const remove = async (p) => { await P.cancelPill(p.nid); await commit(list.filter((x) => x.id !== p.id)); };

  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      {list.map((p) => (
        <View key={p.id} style={s.item}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pillTime, !p.on && { color: C.dim }]}>{p.time}</Text>
            <Text style={s.itemSub}>{p.name}</Text>
          </View>
          <Switch value={p.on} onValueChange={() => toggle(p)} trackColor={{ true: C.acc, false: C.line }} />
          <Pressable onPress={() => remove(p)} style={{ paddingLeft: 16 }}><Text style={s.delText}>✕</Text></Pressable>
        </View>
      ))}
      {list.length === 0 && <Text style={[s.emptyText, { marginBottom: 16 }]}>Напоминаний пока нет. Добавьте первое, телефон будет напоминать каждый день.</Text>}
      <View style={s.card2}>
        <Text style={s.label}>Название</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Например, Витамин D" placeholderTextColor={C.dim} />
        <Text style={s.label}>Время</Text>
        <TextInput style={s.input} value={time} onChangeText={setTime} placeholder="08:30" placeholderTextColor={C.dim} keyboardType="numbers-and-punctuation" maxLength={5} />
        <Btn text="Добавить напоминание" onPress={add} />
      </View>
    </ScrollView>
  );
}

function Me({ profile, setProfile }) {
  const [w, setW] = useState(String(profile.weight));
  const [h, setH] = useState(String(profile.height));
  const save = async () => {
    const weight = Number(w.replace(',', '.')), height = Number(h.replace(',', '.'));
    if (!(weight >= 30 && weight <= 250) || !(height >= 100 && height <= 230)) return Alert.alert('Проверьте данные', 'Вес от 30 до 250 кг, рост от 100 до 230 см.');
    const p = { weight, height }; setProfile(p); await DB.saveProfile(p); Alert.alert('Сохранено', 'Данные применятся к новой прогулке.');
  };
  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Text style={[s.emptyText, { marginBottom: 16 }]}>Вес нужен для калорий, рост для длины шага.</Text>
      <View style={s.card2}>
        <Text style={s.label}>Вес, кг</Text>
        <TextInput style={s.input} value={w} onChangeText={setW} keyboardType="decimal-pad" />
        <Text style={s.label}>Рост, см</Text>
        <TextInput style={s.input} value={h} onChangeText={setH} keyboardType="decimal-pad" />
        <Btn text="Сохранить" onPress={save} />
      </View>
    </ScrollView>
  );
}

export default function App() {
  const [tab, setTab] = useState('walk');
  const [profile, setProfile] = useState({ weight: 70, height: 170 });
  const [ready, setReady] = useState(false);
  useEffect(() => { DB.loadProfile().then((p) => { setProfile(p); setReady(true); }); }, []);
  const tabs = [['walk', 'Ходьба'], ['history', 'История'], ['pills', 'Таблетки'], ['me', 'Я']];
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {ready && tab === 'walk' && <Walk profile={profile} />}
        {ready && tab === 'history' && <History />}
        {ready && tab === 'pills' && <Pills />}
        {ready && tab === 'me' && <Me profile={profile} setProfile={setProfile} />}
      </View>
      <View style={s.tabs}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={s.tab}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>{l}</Text>
            <View style={[s.dot, tab === k && { backgroundColor: C.acc }]} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 32 : 0 },
  body: { padding: 16, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  big: { width: '47.5%', flexGrow: 1, backgroundColor: C.card, borderRadius: 18, padding: 16 },
  bigLabel: { color: C.dim, fontSize: 14, marginBottom: 6 },
  bigValue: { color: C.fg, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigUnit: { color: C.dim, fontSize: 16, fontWeight: '500' },
  small: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12 },
  smallRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  smallLabel: { color: C.dim, fontSize: 12, marginBottom: 4 },
  smallValue: { color: C.fg, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  smallUnit: { color: C.dim, fontSize: 12, fontWeight: '500' },
  link: { paddingVertical: 14, alignItems: 'center' },
  linkText: { color: C.acc, fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  card2: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 8 },
  note: { color: C.dim, fontSize: 13, marginTop: 12 },
  state: { color: C.acc, fontSize: 13, letterSpacing: 1.5, fontWeight: '700', marginBottom: 12 },
  empty: { paddingVertical: 48 },
  emptyTitle: { color: C.fg, fontSize: 32, fontWeight: '800', marginBottom: 12 },
  emptyText: { color: C.dim, fontSize: 17, lineHeight: 25 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.line },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#06201C', fontSize: 19, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12, gap: 6 },
  tabText: { color: C.dim, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: C.fg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 10 },
  itemTitle: { color: C.fg, fontSize: 16, fontWeight: '600' },
  itemVal: { color: C.acc, fontSize: 18, fontWeight: '700' },
  itemSub: { color: C.dim, fontSize: 14, marginTop: 3 },
  pillTime: { color: C.fg, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { color: C.dim, fontSize: 14, marginTop: 4 },
  input: { backgroundColor: C.bg, color: C.fg, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 18 },
  back: { color: C.acc, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  del: { alignItems: 'center', padding: 16, marginTop: 8 },
  delText: { color: C.stop, fontSize: 16, fontWeight: '600' },
});

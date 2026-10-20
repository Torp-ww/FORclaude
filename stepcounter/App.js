import './src/task';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Platform, TextInput, Switch, Modal, ActivityIndicator, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline } from 'react-native-svg';
import { LOCATION_TASK } from './src/task';
import * as P from './src/pills';
import * as DB from './src/store';
import * as HR from './src/hr';
import MapView, { RouteThumb } from './src/MapView';
import { C } from './src/theme';
import { Icon, Card, Metric, Button, RoundButton } from './src/ui';
import Stats from './src/Stats';
import { Ring } from './src/charts';
import { DEFAULT_GOALS } from './src/stats.js';
import { createSession, pauseSession, resumeSession, finishSession, summarize, kmh, fmtDuration, fmtPace, fmtKm, fmtMeters } from './src/tracker';

const IOS = Platform.OS === 'ios';
const HR_DEVICE_KEY = 'hr.device.v1';

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
    foregroundService: { notificationTitle: 'Шагомер', notificationBody: 'Идёт запись активности', notificationColor: '#FF5A1F' },
  });
}
async function stopUpdates() {
  try { if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK); } catch {}
}

const fmtDate = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const dayName = (t) => {
  const h = new Date(t).getHours();
  return h < 6 ? 'Ночная прогулка' : h < 12 ? 'Утренняя прогулка' : h < 18 ? 'Дневная прогулка' : 'Вечерняя прогулка';
};

function HrSpark({ samples }) {
  if (!samples || samples.length < 3) return null;
  const W = 300, H = 56;
  const vals = samples.map((s) => s[1]);
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(max - min, 10);
  const t1 = samples[samples.length - 1][0] || 1;
  const pts = samples.map((s) => `${(s[0] / t1) * W},${H - 4 - ((s[1] - min) / span) * (H - 8)}`).join(' ');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Polyline points={pts} fill="none" stroke={C.heart} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// Экран с итогами активности: карта, расстояние в км и метрах, время, темп, скорости, калории, пульс.
function ActivityView({ session, steps, bpm, live }) {
  const r = summarize(session, Date.now(), steps);
  const points = session.points;
  return (
    <View style={{ gap: 12 }}>
      <MapView points={points} height={live ? 240 : 280} />
      <Card style={{ paddingVertical: 20 }}>
        <Text style={s.label}>РАССТОЯНИЕ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={s.hero}>{fmtKm(r.distance)}</Text>
          <Text style={s.heroUnit}>км</Text>
        </View>
        <Text style={s.sub}>{fmtMeters(r.distance)}</Text>
      </Card>
      <Card>
        <View style={s.row}>
          <Metric label="Время" value={fmtDuration(r.totalMs)} />
          <Metric label={live ? 'Темп сейчас' : 'Средний темп'} value={fmtPace(live ? r.speed : r.avgSpeed)} unit="/км" />
          <Metric label="Шаги" value={r.steps.toLocaleString('ru-RU')} />
        </View>
      </Card>
      <Card>
        <Text style={[s.label, { marginBottom: 12 }]}>СКОРОСТЬ, КМ/Ч</Text>
        <View style={s.row}>
          <Metric label="Средняя" value={kmh(r.avgSpeed).toFixed(1)} />
          <Metric label="Максимальная" value={kmh(r.maxSpeed).toFixed(1)} />
          <Metric label="Минимальная" value={kmh(r.minSpeed).toFixed(1)} />
        </View>
        {live && <Text style={[s.sub, { marginTop: 10 }]}>Сейчас: {kmh(r.speed).toFixed(1)} км/ч</Text>}
      </Card>
      <View style={s.row2}>
        <Card style={{ flex: 1 }}>
          <View style={s.iconRow}><Icon name="flame" size={16} color={C.accent} /><Text style={s.label}>КАЛОРИИ</Text></View>
          <Text style={s.val}>{Math.round(r.calories)}<Text style={s.unit}> ккал</Text></Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={s.iconRow}><Icon name="heart" size={16} color={C.heart} fill={C.heart} /><Text style={s.label}>ПУЛЬС</Text></View>
          {live ? (
            <Text style={[s.val, { color: bpm ? C.heart : C.dim }]}>{bpm || '—'}<Text style={s.unit}> уд/мин</Text></Text>
          ) : (
            <Text style={s.val}>{r.hrAvg ?? '—'}<Text style={s.unit}> {r.hrAvg ? 'средний' : ''}</Text></Text>
          )}
          {!live && r.hrMax ? <Text style={s.sub}>макс. {r.hrMax}, мин. {r.hrMin}</Text> : null}
        </Card>
      </View>
      {!live && session.hr && session.hr.samples && session.hr.samples.length > 2 && (
        <Card><Text style={[s.label, { marginBottom: 8 }]}>ПУЛЬС ПО ХОДУ АКТИВНОСТИ</Text><HrSpark samples={session.hr.samples} /></Card>
      )}
      <Card>
        <View style={s.row}>
          <Metric label="В движении" value={fmtDuration(r.movingMs)} />
          <Metric label="Стоял" value={fmtDuration(r.idleMs)} />
        </View>
      </Card>
      {!IOS && <Text style={[s.sub, { textAlign: 'center' }]}>На Android шаги считаются по расстоянию и росту, это приблизительно.</Text>}
    </View>
  );
}

function HrModal({ visible, onClose, onPicked }) {
  const [devices, setDevices] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let stop = () => {};
    let alive = true;
    (async () => {
      setDevices([]); setMsg('Ищем датчики рядом...');
      try {
        if (!(await HR.requestPermissions())) { setMsg('Разрешите доступ к Bluetooth в настройках телефона.'); return; }
        stop = HR.startScan((d) => alive && setDevices((l) => [...l, d]), (e) => alive && setMsg(e));
      } catch (e) { setMsg('Bluetooth недоступен на этом устройстве.'); }
    })();
    return () => { alive = false; stop(); };
  }, [visible]);
  const pick = async (d) => { setBusy(true); try { await onPicked(d); onClose(); } catch (e) { setMsg('Не удалось подключиться. Проверьте, что датчик включён и не подключён к другому телефону.'); } setBusy(false); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, minHeight: 320 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={s.h2}>Датчик пульса</Text>
            <Pressable onPress={onClose} hitSlop={12}><Icon name="x" size={24} color={C.dim} /></Pressable>
          </View>
          <Text style={[s.sub, { marginBottom: 12 }]}>Подойдёт нагрудный ремень или часы с режимом «передача пульса» по Bluetooth.</Text>
          {devices.map((d) => (
            <Pressable key={d.id} onPress={() => pick(d)} style={s.device}>
              <Icon name="bluetooth" size={20} color={C.accent} />
              <Text style={{ color: C.fg, fontSize: 16, flex: 1 }}>{d.name}</Text>
              <Icon name="chevron" size={18} color={C.dim} />
            </Pressable>
          ))}
          {devices.length === 0 && <Text style={s.sub}>{msg}</Text>}
          {busy && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}
        </View>
      </View>
    </Modal>
  );
}

function Walk({ profile, history, reloadHistory }) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [steps, setSteps] = useState(null);
  const [, tick] = useState(0);
  const [bpm, setBpm] = useState(0);
  const [hrName, setHrName] = useState('');
  const [hrOpen, setHrOpen] = useState(false);
  const [daySteps, setDaySteps] = useState(null);
  const hrRef = useRef({ sum: 0, count: 0, max: 0, min: 999, samples: [], lastSample: 0 });
  const active = session && !session.endedAt;
  const paused = active && !!session.pausedAt;

  const onBpm = useCallback((v) => {
    setBpm(v);
    if (!hrRef.current.recording) return;
    const h = hrRef.current;
    h.sum += v; h.count += 1; h.max = Math.max(h.max, v); h.min = Math.min(h.min, v);
    const t = Date.now();
    if (t - h.lastSample >= 5000 && h.samples.length < 3000) { h.samples.push([Math.round((t - h.t0) / 1000), v]); h.lastSample = t; }
  }, []);
  const connectSaved = useCallback(async (dev) => {
    const name = await HR.connect(dev.id, onBpm, () => setBpm(0));
    setHrName(name);
    await AsyncStorage.setItem(HR_DEVICE_KEY, JSON.stringify({ id: dev.id, name })).catch(() => {});
  }, [onBpm]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const a = await DB.loadActive();
      if (!alive || !a) return;
      setSession(a); setSteps(await liveSteps(a)); tick((n) => n + 1);
    };
    DB.loadActive().then((a) => { if (a) { setSession(a); hrRef.current.recording = !a.pausedAt; hrRef.current.t0 = a.startedAt; } });
    const id = setInterval(pull, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // На iOS шаги за весь день берём из системного шагомера, на Android считаются только записанные активности
  useEffect(() => {
    if (session || !IOS) return;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    iosSteps(t0.getTime(), Date.now()).then(setDaySteps);
  }, [session, history]);

  const start = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) { Alert.alert('Нужна геолокация', 'Разрешите доступ к геолокации в настройках телефона.'); return; }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) Alert.alert('Фоновая запись выключена', 'Чтобы считать шаги при выключенном экране, выберите для геолокации «Всегда» в настройках телефона.');
    if (IOS) { try { await Pedometer.requestPermissionsAsync(); } catch {} }
    const s0 = createSession(Date.now(), profile);
    hrRef.current = { sum: 0, count: 0, max: 0, min: 999, samples: [], lastSample: 0, recording: true, t0: s0.startedAt };
    await DB.saveActive(s0); setSession(s0); setSteps(0);
    await startUpdates();
    // пробуем подключить сохранённый датчик пульса (без ожидания)
    AsyncStorage.getItem(HR_DEVICE_KEY).then((v) => { if (v) { HR.requestPermissions().then((ok) => ok && connectSaved(JSON.parse(v)).catch(() => {})); } }).catch(() => {});
  }, [profile, connectSaved]);

  const pause = async () => {
    await stopUpdates(); hrRef.current.recording = false;
    const s1 = pauseSession((await DB.loadActive()) ?? session);
    await DB.saveActive(s1); setSession(s1);
  };
  const resume = async () => {
    let s1 = (await DB.loadActive()) ?? session;
    if (IOS && s1.pausedAt) {
      const inPause = (await iosSteps(s1.pausedAt, Date.now())) ?? 0;
      s1 = { ...s1, pausedSteps: s1.pausedSteps + inPause };
    }
    s1 = resumeSession(s1); hrRef.current.recording = true;
    await DB.saveActive(s1); setSession(s1);
    await startUpdates();
  };
  const stop = async () => {
    await stopUpdates(); hrRef.current.recording = false;
    let s1 = (await DB.loadActive()) ?? session;
    const st = await liveSteps(s1);
    s1 = finishSession(s1); s1.finalSteps = st;
    const h = hrRef.current;
    if (h.count > 0) s1.hr = { avg: Math.round(h.sum / h.count), max: h.max, min: h.min, samples: h.samples };
    if (s1.distance > 0) await DB.saveHistory([{ id: String(s1.startedAt), ...s1 }, ...(await DB.loadHistory())].slice(0, 100));
    await DB.clearActive();
    HR.disconnect(); setBpm(0);
    setSession(s1); setSteps(st); reloadHistory();
  };
  const reset = () => { setSession(null); setSteps(null); };

  const today = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    let d = 0, k = 0, st = 0;
    history.filter((h) => h.startedAt >= t0.getTime()).forEach((h) => { const r = summarize(h); d += r.distance; k += r.calories; st += r.steps; });
    return { d, k, st };
  }, [history]);

  return (
    <View style={{ flex: 1 }}>
      {!session && (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <Text style={s.h1}>Сегодня</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ring progress={today.d / 1000 / (profile.goalKm || DEFAULT_GOALS.goalKm)} size={92} color={today.d / 1000 >= (profile.goalKm || DEFAULT_GOALS.goalKm) ? C.green : C.accent}>
                <Text style={{ color: C.fg, fontSize: 17, fontWeight: '800' }}>{Math.min(999, Math.round((today.d / 1000 / (profile.goalKm || DEFAULT_GOALS.goalKm)) * 100))}%</Text>
              </Ring>
              <View style={{ flex: 1, gap: 12 }}>
                <Text style={s.label}>АКТИВНОСТЬ ЗА ДЕНЬ · ЦЕЛЬ {profile.goalKm || DEFAULT_GOALS.goalKm} КМ</Text>
                <View style={s.row}>
                  <Metric label="Пройдено" value={fmtKm(today.d)} unit="км" />
                  <Metric label="Шаги" value={Math.max(today.st, daySteps || 0).toLocaleString('ru-RU')} />
                  <Metric label="Ккал" value={Math.round(today.k)} />
                </View>
              </View>
            </View>
          </Card>
          <Pressable onPress={() => setHrOpen(true)} style={s.hrChip}>
            <Icon name="heart" size={18} color={C.heart} fill={bpm ? C.heart : 'none'} />
            <Text style={{ color: C.fg, fontSize: 15, flex: 1 }}>{hrName ? `Пульс: ${hrName}${bpm ? `, ${bpm} уд/мин` : ''}` : 'Подключить датчик пульса'}</Text>
            <Icon name="chevron" size={18} color={C.dim} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={s.ring}>
              <Pressable onPress={start} accessibilityLabel="Старт" style={({ pressed }) => [s.startBtn, pressed && { opacity: 0.85 }]}>
                <Text style={s.startText}>СТАРТ</Text>
              </Pressable>
            </View>
            <Text style={[s.sub, { marginTop: 20, textAlign: 'center' }]}>Телефон можно убрать в карман, экран может быть выключен.</Text>
          </View>
        </View>
      )}
      {session && (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: active ? 150 : 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={[s.dot, { backgroundColor: !active ? C.dim : paused ? C.warn : C.green }]} />
              <Text style={s.status}>{!active ? dayName(session.startedAt).toUpperCase() : paused ? 'ПАУЗА' : 'ЗАПИСЬ'}</Text>
              {!active && <Text style={[s.sub, { marginLeft: 'auto' }]}>{fmtDate(session.startedAt)}</Text>}
            </View>
            <ActivityView session={session} steps={steps} bpm={bpm} live={active} />
            {!active && <Button text="Готово" onPress={reset} style={{ marginTop: 16 }} />}
          </ScrollView>
          {active && (
            <View style={[s.controls, { paddingBottom: 16 }]}>
              {!paused ? <RoundButton icon="pause" label="Пауза" onPress={pause} /> : (
                <View style={{ flexDirection: 'row', gap: 40 }}>
                  <RoundButton icon="play" label="Продолжить" color={C.green} onPress={resume} />
                  <RoundButton icon="stop" label="Завершить" color={C.stop} onPress={stop} />
                </View>
              )}
            </View>
          )}
        </>
      )}
      <HrModal visible={hrOpen} onClose={() => setHrOpen(false)} onPicked={connectSaved} />
    </View>
  );
}

function History({ history, reload, embedded }) {
  const [open, setOpen] = useState(null);
  const remove = async (id) => { await DB.saveHistory(history.filter((h) => h.id !== id)); setOpen(null); reload(); };
  if (open) return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      <Pressable onPress={() => setOpen(null)} style={{ marginBottom: 12 }}><Text style={s.back}>‹ Все активности</Text></Pressable>
      <Text style={s.h2}>{dayName(open.startedAt)}</Text>
      <Text style={[s.sub, { marginBottom: 14 }]}>{fmtDate(open.startedAt)}</Text>
      <ActivityView session={open} steps={null} live={false} />
      <Pressable onPress={() => remove(open.id)} style={{ alignItems: 'center', padding: 18 }}><Text style={{ color: C.stop, fontSize: 16, fontWeight: '600' }}>Удалить запись</Text></Pressable>
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      {!embedded && <Text style={s.h1}>Активности</Text>}
      {history.length === 0 && <Text style={s.sub}>Здесь появятся ваши прогулки, с картой маршрута и статистикой.</Text>}
      {history.map((h) => {
        const r = summarize(h);
        return (
          <Pressable key={h.id} onPress={() => setOpen(h)} style={s.item}>
            <RouteThumb points={h.points} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{dayName(h.startedAt)}</Text>
              <Text style={s.sub}>{fmtDate(h.startedAt)}</Text>
              <Text style={[s.sub, { marginTop: 4 }]}>{fmtDuration(r.totalMs)} · {kmh(r.avgSpeed).toFixed(1)} км/ч · {Math.round(r.calories)} ккал</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.accent, fontSize: 22, fontWeight: '800' }}>{fmtKm(r.distance)}</Text>
              <Text style={s.sub}>км</Text>
            </View>
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
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Таблетки</Text>
      {list.map((p) => (
        <View key={p.id} style={s.item}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pillTime, !p.on && { color: C.dim }]}>{p.time}</Text>
            <Text style={s.sub}>{p.name}</Text>
          </View>
          <Switch value={p.on} onValueChange={() => toggle(p)} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
          <Pressable onPress={() => remove(p)} hitSlop={10} style={{ paddingLeft: 16 }}><Icon name="x" size={20} color={C.dim} /></Pressable>
        </View>
      ))}
      {list.length === 0 && <Text style={[s.sub, { marginBottom: 16 }]}>Напоминаний пока нет. Добавьте первое, телефон будет напоминать каждый день.</Text>}
      <Card style={{ gap: 8 }}>
        <Text style={s.label}>НАЗВАНИЕ</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Например, Витамин D" placeholderTextColor={C.dim} />
        <Text style={s.label}>ВРЕМЯ</Text>
        <TextInput style={s.input} value={time} onChangeText={setTime} placeholder="08:30" placeholderTextColor={C.dim} keyboardType="numbers-and-punctuation" maxLength={5} />
        <Button text="Добавить напоминание" onPress={add} style={{ marginTop: 6 }} />
      </Card>
    </ScrollView>
  );
}

function Me({ profile, setProfile }) {
  const [w, setW] = useState(String(profile.weight));
  const [h, setH] = useState(String(profile.height));
  const [gk, setGk] = useState(String(profile.goalKm ?? DEFAULT_GOALS.goalKm));
  const [gm, setGm] = useState(String(profile.goalMin ?? DEFAULT_GOALS.goalMin));
  const save = async () => {
    const num = (v) => Number(String(v).replace(',', '.'));
    const weight = num(w), height = num(h), goalKm = num(gk), goalMin = num(gm);
    if (!(weight >= 30 && weight <= 250) || !(height >= 100 && height <= 230)) return Alert.alert('Проверьте данные', 'Вес от 30 до 250 кг, рост от 100 до 230 см.');
    if (!(goalKm >= 0.5 && goalKm <= 100) || !(goalMin >= 5 && goalMin <= 600)) return Alert.alert('Проверьте цели', 'Дистанция от 0,5 до 100 км, время от 5 до 600 минут.');
    const p = { ...profile, weight, height, goalKm, goalMin }; setProfile(p); await DB.saveProfile(p); Alert.alert('Сохранено', 'Данные применятся к новой прогулке.');
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Профиль</Text>
      <Text style={[s.sub, { marginBottom: 16 }]}>Вес нужен для калорий, рост для длины шага, цели для статистики.</Text>
      <Card style={{ gap: 8 }}>
        <Text style={s.label}>ВЕС, КГ</Text>
        <TextInput style={s.input} value={w} onChangeText={setW} keyboardType="decimal-pad" />
        <Text style={s.label}>РОСТ, СМ</Text>
        <TextInput style={s.input} value={h} onChangeText={setH} keyboardType="decimal-pad" />
        <Text style={s.label}>ЦЕЛЬ НА ДЕНЬ: КИЛОМЕТРЫ</Text>
        <TextInput style={s.input} value={gk} onChangeText={setGk} keyboardType="decimal-pad" />
        <Text style={s.label}>ЦЕЛЬ НА ДЕНЬ: МИНУТЫ В ДВИЖЕНИИ</Text>
        <TextInput style={s.input} value={gm} onChangeText={setGm} keyboardType="decimal-pad" />
        <Button text="Сохранить" onPress={save} style={{ marginTop: 6 }} />
      </Card>
    </ScrollView>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('walk');
  const [profile, setProfile] = useState({ weight: 70, height: 170, goalKm: 3, goalMin: 30 });
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const reloadHistory = useCallback(() => DB.loadHistory().then(setHistory), []);
  useEffect(() => { Promise.all([DB.loadProfile().then((p) => setProfile({ goalKm: 3, goalMin: 30, ...p })), reloadHistory()]).then(() => setReady(true)); }, [reloadHistory]);
  const tabs = [['walk', 'Запись', 'record'], ['stats', 'Статистика', 'chart'], ['pills', 'Таблетки', 'pill'], ['me', 'Профиль', 'user']];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {ready && tab === 'walk' && <Walk profile={profile} history={history} reloadHistory={reloadHistory} />}
        {ready && tab === 'stats' && <Stats history={history} profile={profile} historyView={<History history={history} reload={reloadHistory} embedded />} />}
        {ready && tab === 'pills' && <Pills />}
        {ready && tab === 'me' && <Me profile={profile} setProfile={setProfile} />}
      </View>
      <View style={[s.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map(([k, l, icon]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={s.tab} accessibilityLabel={l}>
            <Icon name={icon} size={24} color={tab === k ? C.accent : C.dim} />
            <Text style={[s.tabText, tab === k && { color: C.accent }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  h1: { color: C.fg, fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 16 },
  h2: { color: C.fg, fontSize: 22, fontWeight: '800' },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  hero: { color: C.fg, fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  heroUnit: { color: C.dim, fontSize: 22, fontWeight: '700' },
  sub: { color: C.dim, fontSize: 14 },
  val: { color: C.fg, fontSize: 28, fontWeight: '800', marginTop: 6, fontVariant: ['tabular-nums'] },
  unit: { color: C.dim, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { color: C.fg, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hrChip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 16, padding: 14, marginTop: 12 },
  ring: { width: 214, height: 214, borderRadius: 107, borderWidth: 3, borderColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  startBtn: { width: 180, height: 180, borderRadius: 90, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  startText: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  tabText: { color: C.dim, fontSize: 11, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: 20, padding: 14, marginBottom: 12 },
  pillTime: { color: C.fg, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  input: { backgroundColor: C.bg, color: C.fg, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 18 },
  back: { color: C.accent, fontSize: 17, fontWeight: '600' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface2, borderRadius: 14, padding: 14, marginBottom: 8 },
});

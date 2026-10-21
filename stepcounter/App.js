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
import * as DB from './src/store';
import * as HR from './src/hr';
import MapView, { RouteThumb } from './src/MapView';
import { C } from './src/theme';
import { Icon, Card, Metric, Button, RoundButton } from './src/ui';
import Stats from './src/Stats';
import Health from './src/Health';
import Reminders from './src/Reminders';
import * as HL from './src/health.js';
import { Ring } from './src/charts';
import { DEFAULT_GOALS } from './src/stats.js';
import * as S from './src/stats.js';
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
function IntensityCard({ session, profile }) {
  const it = HL.intensity(session);
  if (!it) return null;
  const parts = [['Лёгкая', it.low, C.dim], ['Умеренная', it.mid, C.green], ['Интенсивная', it.high, C.accent]];
  return (
    <Card>
      <Text style={[s.label, { marginBottom: 10 }]}>АКТИВНОСТЬ ВО ВРЕМЯ ЗАНЯТИЯ</Text>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: C.line }}>
        {parts.map(([n, v, c]) => (v > 0 ? <View key={n} style={{ flex: v, backgroundColor: c }} /> : null))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        {parts.map(([n, v, c]) => (
          <View key={n} style={{ alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><Text style={s.sub}>{n}</Text></View>
            <Text style={{ color: C.fg, fontSize: 16, fontWeight: '800' }}>{Math.round(v * 100)}%</Text>
          </View>
        ))}
      </View>
      <Text style={[s.sub, { marginTop: 8 }]}>По скорости: до 4 км/ч, 4-6,4 км/ч и быстрее.</Text>
    </Card>
  );
}
function HrZonesCard({ session, profile }) {
  const b = HL.hrBreakdown(session, profile.age);
  if (!b) return null;
  const rows = [['rest', C.dim], ['walk', C.green], ['sport', C.accent]];
  return (
    <Card>
      <Text style={[s.label, { marginBottom: 10 }]}>ПУЛЬС: ПОКОЙ, ХОДЬБА, СПОРТ</Text>
      {rows.map(([k, c]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Text style={{ color: C.fg, width: 70, fontSize: 14 }}>{HL.ZONES[k]}</Text>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.line }}><View style={{ width: `${Math.round((b[k] / b.total) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: c }} /></View>
          <Text style={[s.sub, { width: 52, textAlign: 'right' }]}>{fmtDuration(b[k] * 1000)}</Text>
        </View>
      ))}
    </Card>
  );
}
function TipCard({ tip }) {
  if (!tip) return null;
  const col = tip.level === 'high' ? C.stop : tip.level === 'mid' ? C.warn : C.accent;
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 16, borderLeftWidth: 4, borderLeftColor: col }}>
      <Text style={[s.label, { color: col, marginBottom: 6 }]}>{tip.level === 'info' ? 'СОВЕТ ТРЕНЕРА' : 'ВНИМАНИЕ'}</Text>
      <Text style={{ color: C.fg, fontSize: 15, lineHeight: 22 }}>{tip.text}</Text>
    </View>
  );
}

function ActivityView({ session, steps, bpm, live, profile }) {
  const r = summarize(session, Date.now(), steps);
  const pulseOn = DB.feat(profile, 'pulse');
  let tip = null;
  if (live && !session.pausedAt) {
    tip = HL.liveTip({ mins: r.totalMs / 60000, bpm: pulseOn ? bpm : 0, age: profile.age, kmh: kmh(r.speed), headphones: DB.feat(profile, 'headphones') });
    if (tip && tip.level === 'info' && !DB.feat(profile, 'liveTips') && !(tip.text.includes('наушниках') && DB.feat(profile, 'headphones'))) tip = null;
  }
  const points = session.points;
  return (
    <View style={{ gap: 12 }}>
      <TipCard tip={tip} />
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
      <IntensityCard session={session} profile={profile} />
      {!live && pulseOn && <HrZonesCard session={session} profile={profile} />}
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
  const restRef = useRef({ sum: 0, n: 0 });
  const hrRef = useRef({ sum: 0, count: 0, max: 0, min: 999, samples: [], lastSample: 0 });
  const active = session && !session.endedAt;
  const paused = active && !!session.pausedAt;

  const onBpm = useCallback((v) => {
    setBpm(v);
    if (!hrRef.current.recording) {
      // вне записи копим пульс покоя: средний за серию измерений сохраняем за сегодня
      const q = restRef.current; q.sum += v; q.n += 1;
      if (q.n >= 30) {
        const avg = Math.round(q.sum / q.n); q.sum = 0; q.n = 0;
        DB.loadRestHr().then((m) => { const k = S.dayKey(Date.now()); const o = m[k]; m[k] = { avg: o ? Math.round((o.avg + avg) / 2) : avg, n: (o ? o.n : 0) + 1 }; return DB.saveRestHr(m); });
      }
      return;
    }
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
            <ActivityView session={session} steps={steps} bpm={bpm} live={active} profile={profile} />
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

function History({ history, reload, embedded, profile }) {
  const [open, setOpen] = useState(null);
  const remove = async (id) => { await DB.saveHistory(history.filter((h) => h.id !== id)); setOpen(null); reload(); };
  if (open) return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      <Pressable onPress={() => setOpen(null)} style={{ marginBottom: 12 }}><Text style={s.back}>‹ Все активности</Text></Pressable>
      <Text style={s.h2}>{dayName(open.startedAt)}</Text>
      <Text style={[s.sub, { marginBottom: 14 }]}>{fmtDate(open.startedAt)}</Text>
      <ActivityView session={open} steps={null} live={false} profile={profile} />
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

function Me({ profile, setProfile }) {
  const [w, setW] = useState(String(profile.weight));
  const [h, setH] = useState(String(profile.height));
  const [age, setAge] = useState(String(profile.age ?? 30));
  const [gk, setGk] = useState(String(profile.goalKm ?? DEFAULT_GOALS.goalKm));
  const [gm, setGm] = useState(String(profile.goalMin ?? DEFAULT_GOALS.goalMin));
  const [sex, setSex] = useState(profile.sex || 'm');
  const [watch, setWatch] = useState(false);
  const save = async () => {
    const num = (v) => Number(String(v).replace(',', '.'));
    const weight = num(w), height = num(h), goalKm = num(gk), goalMin = num(gm), a = num(age);
    if (!(weight >= 30 && weight <= 250) || !(height >= 100 && height <= 230)) return Alert.alert('Проверьте данные', 'Вес от 30 до 250 кг, рост от 100 до 230 см.');
    if (!(a >= 5 && a <= 100)) return Alert.alert('Проверьте возраст', 'Возраст от 5 до 100 лет.');
    if (!(goalKm >= 0.5 && goalKm <= 100) || !(goalMin >= 5 && goalMin <= 600)) return Alert.alert('Проверьте цели', 'Дистанция от 0,5 до 100 км, время от 5 до 600 минут.');
    const p = { ...profile, weight, height, goalKm, goalMin, age: a, sex }; setProfile(p);
    await DB.saveProfile(p); Alert.alert('Сохранено', 'Данные применятся к новой прогулке.');
  };
  const setFeature = async (k, v) => {
    const p = { ...profile, features: { ...(profile.features || {}), [k]: v } };
    setProfile(p); await DB.saveProfile(p);
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Профиль</Text>
      <Text style={s.sub}>Вес нужен для калорий, рост для длины шага, возраст для зон пульса, цели для статистики.</Text>
      <Card style={{ gap: 8 }}>
        <Text style={s.label}>ВЕС, КГ</Text>
        <TextInput style={s.input} value={w} onChangeText={setW} keyboardType="decimal-pad" />
        <Text style={s.label}>РОСТ, СМ</Text>
        <TextInput style={s.input} value={h} onChangeText={setH} keyboardType="decimal-pad" />
        <Text style={s.label}>ВОЗРАСТ</Text>
        <TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
        <Text style={s.label}>ПОЛ (ДЛЯ РАСЧЁТА КАЛОРИЙ)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['m', 'Мужской'], ['f', 'Женский']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setSex(k)} style={[s.pick, sex === k && { backgroundColor: C.accent }]}><Text style={{ color: sex === k ? '#fff' : C.dim, fontWeight: '700' }}>{l}</Text></Pressable>
          ))}
        </View>
        <Text style={s.label}>ЦЕЛЬ НА ДЕНЬ: КИЛОМЕТРЫ</Text>
        <TextInput style={s.input} value={gk} onChangeText={setGk} keyboardType="decimal-pad" />
        <Text style={s.label}>ЦЕЛЬ НА ДЕНЬ: МИНУТЫ В ДВИЖЕНИИ</Text>
        <TextInput style={s.input} value={gm} onChangeText={setGm} keyboardType="decimal-pad" />
        <Button text="Сохранить" onPress={save} style={{ marginTop: 6 }} />
      </Card>

      <Text style={[s.h2, { marginTop: 12 }]}>Функции</Text>
      <Text style={s.sub}>Отключите то, что вам не нужно: вкладки и подсказки исчезнут.</Text>
      <Card style={{ paddingVertical: 4 }}>
        {DB.FEATURES.map(([k, l], i) => (
          <View key={k} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <Text style={{ color: C.fg, fontSize: 15, flex: 1, paddingRight: 12 }}>{l}</Text>
            <Switch value={DB.feat(profile, k)} onValueChange={(v) => setFeature(k, v)} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
          </View>
        ))}
      </Card>

      <Pressable onPress={() => setWatch(!watch)} style={[s.item, { marginBottom: 0, marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.fg, fontSize: 16, fontWeight: '700' }}>Как использовать с умными часами</Text>
          <Text style={s.sub}>Пульс с часов и уведомления на запястье</Text>
        </View>
        <Icon name="chevron" size={18} color={C.dim} style={{ transform: [{ rotate: watch ? '90deg' : '0deg' }] }} />
      </Pressable>
      {watch && (
        <Card style={{ gap: 8 }}>
          <Text style={s.label}>ВАЖНО</Text>
          <Text style={s.tip}>Отдельной версии приложения для часов пока нет: приложение работает на телефоне, а часы можно подключить двумя способами.</Text>
          <Text style={[s.label, { marginTop: 8 }]}>1. ПУЛЬС С ЧАСОВ</Text>
          <Text style={s.tip}>На часах включите режим «Передача пульса» (Heart rate broadcast): он есть в Garmin, Amazfit и Zepp, Polar, Suunto, Huawei и многих браслетах Xiaomi. Затем на экране «Запись» нажмите «Подключить датчик пульса» и выберите часы в списке. Часы Apple Watch и Wear OS напрямую не определяются: для них нужны сторонние приложения, которые передают пульс по Bluetooth.</Text>
          <Text style={[s.label, { marginTop: 8 }]}>2. УВЕДОМЛЕНИЯ НА ЧАСАХ</Text>
          <Text style={s.tip}>Напоминания о таблетках приходят как обычные уведомления телефона. Если часы связаны с телефоном в приложении производителя (Mi Fitness, Zepp, Garmin Connect, Samsung Wearable и т. д.), включите там пересылку уведомлений для приложения «Шагомер».</Text>
          <Text style={[s.label, { marginTop: 8 }]}>ЕСЛИ НЕ ПОЛУЧАЕТСЯ</Text>
          <Text style={s.tip}>Закройте приложение производителя часов, которое могло занять Bluetooth-подключение, и повторите поиск. Разрешите «Шагомеру» доступ к Bluetooth и геолокации «Всегда».</Text>
        </Card>
      )}
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
  const f = (k) => DB.feat(profile, k);
  const tabs = [['walk', 'Запись', 'record'], f('stats') && ['stats', 'Статистика', 'chart'], f('health') && ['health', 'Здоровье', 'heart'], f('pills') && ['pills', 'Напоминания', 'pill'], ['me', 'Профиль', 'user']].filter(Boolean);
  useEffect(() => { if (!tabs.some((t) => t[0] === tab)) setTab('me'); }, [profile.features]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {ready && tab === 'walk' && <Walk profile={profile} history={history} reloadHistory={reloadHistory} />}
        {ready && tab === 'stats' && <Stats history={history} profile={profile} historyView={<History history={history} reload={reloadHistory} embedded profile={profile} />} />}
        {ready && tab === 'health' && <Health history={history} profile={profile} />}
        {ready && tab === 'pills' && <Reminders />}
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
  pick: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center' },
  tip: { color: C.fg, fontSize: 14, lineHeight: 21 },
  back: { color: C.accent, fontSize: 17, fontWeight: '600' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface2, borderRadius: 14, padding: 14, marginBottom: 8 },
});

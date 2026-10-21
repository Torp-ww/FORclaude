import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Vibration, StyleSheet } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { C } from './theme';
import { Card, Button, Icon } from './ui';
import * as DB from './store';
import * as PU from './pushups.js';

const fmtDate = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Pushups({ visible, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | countdown | running | done
  const [count, setCount] = useState(5);
  const [r, setR] = useState({ correct: 0, partial: 0, fast: 0, total: 0 });
  const [last, setLast] = useState(null);
  const [saved, setSaved] = useState([]);
  const cnt = useRef(null), sub = useRef(null), t0 = useRef(0), manual = useRef(0);
  useEffect(() => { if (visible) DB.loadPushups().then(setSaved); }, [visible]);

  const stopSensor = () => { if (sub.current) { sub.current.remove(); sub.current = null; } deactivateKeepAwake('pushups'); };
  useEffect(() => stopSensor, []);

  const begin = useCallback(() => {
    cnt.current = PU.createCounter(); manual.current = 0; setR({ correct: 0, partial: 0, fast: 0, total: 0 }); setLast(null);
    t0.current = Date.now(); setPhase('running');
    activateKeepAwakeAsync('pushups').catch(() => {});
    Accelerometer.setUpdateInterval(40);
    sub.current = Accelerometer.addListener(({ x, y, z }) => {
      const ev = PU.feed(cnt.current, Date.now(), x, y, z);
      if (ev) {
        Vibration.vibrate(ev.type === 'correct' ? 40 : [0, 40, 60, 40]);
        setLast(ev);
        const s = PU.summary(cnt.current); setR({ ...s, correct: s.correct + manual.current, total: s.total + manual.current });
      }
    });
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) { begin(); return; }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count, begin]);

  const start = () => { setCount(5); setPhase('countdown'); };
  const addManual = (d) => {
    if (d < 0 && r.correct <= 0) return;
    manual.current += d;
    const s = PU.summary(cnt.current); setR({ ...s, correct: Math.max(0, s.correct + manual.current), total: Math.max(0, s.total + manual.current) });
  };
  const finish = async () => {
    stopSensor();
    const rec = { t: Date.now(), ms: Date.now() - t0.current, correct: r.correct, partial: r.partial, fast: r.fast };
    if (r.total > 0) { const n = [rec, ...saved].slice(0, 200); setSaved(n); await DB.savePushups(n); }
    setPhase('done');
  };
  const close = () => { stopSensor(); setPhase('idle'); onClose(); };

  const total = saved.reduce((a, x) => a + x.correct, 0), best = Math.max(0, ...saved.map((x) => x.correct));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={st.h1}>Отжимания</Text>
          <Pressable onPress={close} hitSlop={14} accessibilityLabel="Закрыть"><Icon name="x" size={26} color={C.dim} /></Pressable>
        </View>

        {phase === 'idle' && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Card style={{ gap: 8 }}>
              <Text style={st.label}>КАК ЭТО РАБОТАЕТ</Text>
              <Text style={st.tip}>Закрепите телефон на теле: в нагрудном кармане, в спортивном чехле на руке или на плече. Положение экрана не важно. Нажмите «Старт», у вас будет 5 секунд занять упор лёжа.</Text>
              <Text style={st.tip}>Приложение считает повторение «правильным», если ход полный и темп ровный: не быстрее 0,9 секунды и не медленнее 7 секунд на повторение. Неполные и слишком быстрые считаются отдельно.</Text>
              <Text style={st.sub}>Счёт приблизительный: он зависит от крепления телефона. Если что-то не считается, поправьте кнопками «+1» и «−1».</Text>
            </Card>
            <Button text="СТАРТ" onPress={start} />
            <Card>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}><Text style={st.label}>РЕКОРД ЗА ПОДХОД</Text><Text style={st.val}>{best}</Text></View>
                <View style={{ flex: 1 }}><Text style={st.label}>ВСЕГО ПРАВИЛЬНЫХ</Text><Text style={st.val}>{total}</Text></View>
              </View>
            </Card>
            {saved.slice(0, 8).map((x, i) => (
              <View key={i} style={st.row}>
                <Text style={{ color: C.fg, fontSize: 15, flex: 1 }}>{fmtDate(x.t)}</Text>
                <Text style={{ color: C.accent, fontSize: 18, fontWeight: '800' }}>{x.correct}</Text>
                <Text style={st.sub}>  +{x.partial} неполных, +{x.fast} быстрых</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {phase === 'countdown' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 16, marginBottom: 8 }}>Займите положение</Text>
            <Text style={{ color: C.accent, fontSize: 120, fontWeight: '900' }}>{count}</Text>
          </View>
        )}

        {phase === 'running' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={st.label}>ПРАВИЛЬНЫХ</Text>
              <Text style={{ color: C.fg, fontSize: 140, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{r.correct}</Text>
              <Text style={st.sub}>неполных {r.partial} · слишком быстрых {r.fast}</Text>
              {last && <Text style={{ color: last.type === 'correct' ? C.green : C.warn, fontSize: 16, fontWeight: '700', marginTop: 12 }}>
                {last.type === 'correct' ? 'Засчитано' : last.type === 'partial' ? 'Неполное: опуститесь ниже' : 'Слишком быстро'}
              </Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20 }}>
              <Pressable onPress={() => addManual(-1)} style={st.small}><Text style={st.smallText}>−1</Text></Pressable>
              <Pressable onPress={() => addManual(1)} style={st.small}><Text style={st.smallText}>+1</Text></Pressable>
            </View>
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 20 }}><Button text="Завершить подход" color={C.stop} onPress={finish} /></View>
          </View>
        )}

        {phase === 'done' && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Card style={{ alignItems: 'center', gap: 6 }}>
              <Text style={st.label}>ПОДХОД ЗАВЕРШЁН</Text>
              <Text style={{ color: C.fg, fontSize: 80, fontWeight: '900' }}>{r.correct}</Text>
              <Text style={st.sub}>правильных · неполных {r.partial} · слишком быстрых {r.fast}</Text>
            </Card>
            <Card><Text style={st.tip}>{PU.advice(r)}</Text></Card>
            <Button text="Ещё подход" onPress={() => setPhase('idle')} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  h1: { color: C.fg, fontSize: 30, fontWeight: '800' },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  val: { color: C.fg, fontSize: 32, fontWeight: '800', marginTop: 4 },
  sub: { color: C.dim, fontSize: 13, lineHeight: 18 },
  tip: { color: C.fg, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 14 },
  small: { flex: 1, backgroundColor: C.surface2, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  smallText: { color: C.fg, fontSize: 22, fontWeight: '800' },
});

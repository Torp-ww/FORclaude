import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch, StyleSheet, Alert } from 'react-native';
import { C } from './theme';
import { Card, Button, Icon } from './ui';
import * as P from './pills';
import * as DB from './store';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const idsOf = (p) => p.nids || (p.nid ? [p.nid] : []);
const soundName = (id) => (P.SOUNDS.find((s) => s.id === id) || P.SOUNDS[0]).name;

export default function Reminders() {
  const [list, setList] = useState([]);
  const [kind, setKind] = useState('pill');
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [sound, setSound] = useState('default');
  const [days, setDays] = useState([]);
  useEffect(() => { DB.loadPills().then(setList); }, []);
  const commit = async (n) => { setList(n); await DB.savePills(n); };
  const shown = list.filter((p) => (p.kind || 'pill') === kind);
  const pill = kind === 'pill';

  const pickSound = (id) => { setSound(id); P.askPermission().then((ok) => ok && P.preview(kind, id)).catch(() => {}); };
  const toggleDay = (d) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()));

  const add = async () => {
    const t = P.normalizeTime(time);
    if (pill && !name.trim()) return Alert.alert('Введите название таблетки');
    if (!t) return Alert.alert('Введите время', 'Например 08:30');
    if (!(await P.askPermission())) return Alert.alert('Уведомления выключены', 'Разрешите уведомления в настройках телефона.');
    const r = { kind, name: name.trim(), time: t, sound, days: pill ? [] : days };
    const nids = await P.schedule(r);
    await commit([...list, { id: String(Date.now()), ...r, on: true, nids }].sort((a, b) => a.time.localeCompare(b.time)));
    setName(''); setTime(''); setDays([]);
  };
  const toggle = async (p) => {
    let nids = [];
    if (p.on) await P.cancel(idsOf(p)); else nids = await P.schedule({ ...p, kind: p.kind || 'pill' });
    await commit(list.map((x) => (x.id === p.id ? { ...x, on: !p.on, nids, nid: undefined } : x)));
  };
  const remove = async (p) => { await P.cancel(idsOf(p)); await commit(list.filter((x) => x.id !== p.id)); };
  const changeSound = async (p, id) => {
    await P.cancel(idsOf(p));
    const upd = { ...p, sound: id };
    const nids = p.on ? await P.schedule({ ...upd, kind: p.kind || 'pill' }) : [];
    P.preview(p.kind || 'pill', id).catch(() => {});
    await commit(list.map((x) => (x.id === p.id ? { ...upd, nids, nid: undefined } : x)));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>Напоминания</Text>
      <View style={st.seg}>
        {[['pill', 'Таблетки'], ['workout', 'Тренировки']].map(([k, l]) => (
          <Pressable key={k} onPress={() => { setKind(k); setSound('default'); setDays([]); }} style={[st.segItem, kind === k && st.segOn]}>
            <Text style={[st.segText, kind === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 16 }} />
      {shown.map((p) => (
        <View key={p.id} style={st.item}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[st.time, !p.on && { color: C.dim }]}>{p.time}</Text>
              <Text style={st.sub}>{p.name || (pill ? '' : 'Тренировка')}{!pill && p.days && p.days.length ? ` · ${p.days.map((d) => WD[d - 1]).join(', ')}` : !pill ? ' · каждый день' : ''}</Text>
            </View>
            <Switch value={p.on} onValueChange={() => toggle(p)} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
            <Pressable onPress={() => remove(p)} hitSlop={10} accessibilityLabel="Удалить" style={{ paddingLeft: 16 }}><Icon name="x" size={20} color={C.dim} /></Pressable>
          </View>
          <View style={st.chips}>
            {P.SOUNDS.map((s) => (
              <Pressable key={s.id} onPress={() => changeSound(p, s.id)} style={[st.chip, (p.sound || 'default') === s.id && st.chipOn]}>
                <Text style={[st.chipText, (p.sound || 'default') === s.id && { color: '#fff' }]}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {shown.length === 0 && <Text style={[st.sub, { marginBottom: 16 }]}>{pill ? 'Напоминаний пока нет. Добавьте первое, телефон будет напоминать каждый день.' : 'Напоминаний о тренировках пока нет. Выберите время и дни недели.'}</Text>}
      <Card style={{ gap: 8 }}>
        <Text style={st.label}>{pill ? 'НАЗВАНИЕ' : 'ПОДПИСЬ (НЕОБЯЗАТЕЛЬНО)'}</Text>
        <TextInput style={st.input} value={name} onChangeText={setName} placeholder={pill ? 'Например, Витамин D' : 'Например, Вечерняя прогулка'} placeholderTextColor={C.dim} />
        <Text style={st.label}>ВРЕМЯ</Text>
        <TextInput style={st.input} value={time} onChangeText={setTime} placeholder="08:30" placeholderTextColor={C.dim} keyboardType="numbers-and-punctuation" maxLength={5} />
        {!pill && (
          <>
            <Text style={st.label}>ДНИ НЕДЕЛИ (НИЧЕГО НЕ ВЫБРАНО = КАЖДЫЙ ДЕНЬ)</Text>
            <View style={st.chips}>
              {WD.map((w, i) => (
                <Pressable key={w} onPress={() => toggleDay(i + 1)} style={[st.chip, days.includes(i + 1) && st.chipOn]}>
                  <Text style={[st.chipText, days.includes(i + 1) && { color: '#fff' }]}>{w}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Text style={st.label}>ЗВУК · {soundName(sound).toUpperCase()}</Text>
        <View style={st.chips}>
          {P.SOUNDS.map((s) => (
            <Pressable key={s.id} onPress={() => pickSound(s.id)} style={[st.chip, sound === s.id && st.chipOn]}>
              <Text style={[st.chipText, sound === s.id && { color: '#fff' }]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={st.sub}>При выборе звука он проигрывается для проверки. Звук можно менять и у уже созданных напоминаний.</Text>
        <Button text="Добавить напоминание" onPress={add} style={{ marginTop: 6 }} />
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h1: { color: C.fg, fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.dim, fontWeight: '700', fontSize: 14 },
  item: { backgroundColor: C.surface, borderRadius: 20, padding: 14, marginBottom: 12, gap: 10 },
  time: { color: C.fg, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: C.dim, fontSize: 13 },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  input: { backgroundColor: C.bg, color: C.fg, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: C.surface2 },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.dim, fontWeight: '700', fontSize: 13 },
});

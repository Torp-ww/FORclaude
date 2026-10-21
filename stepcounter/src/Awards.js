import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { C } from './theme';
import { Card, Button } from './ui';
import * as DB from './store';
import { evaluate, shareText, shareSummary } from './achievements.js';

export default function Awards({ history, profile }) {
  const [extra, setExtra] = useState({ pushups: [], moods: {}, sleep: {} });
  useEffect(() => { Promise.all([DB.loadPushups(), DB.loadMoods(), DB.loadSleep()]).then(([pushups, moods, sleep]) => setExtra({ pushups, moods, sleep })); }, []);
  const list = evaluate({ history, ...extra, goals: { goalKm: profile.goalKm, goalMin: profile.goalMin } });
  const done = list.filter((a) => a.done).length;
  const send = (text) => Share.share({ message: text }).catch(() => {});
  const fmt = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 12 }}>
      <Card style={{ gap: 6 }}>
        <Text style={st.label}>ПОЛУЧЕНО</Text>
        <Text style={st.hero}>{done}<Text style={st.unit}> из {list.length}</Text></Text>
        <Button text="Поделиться со всеми достижениями" onPress={() => send(shareSummary(list))} style={{ marginTop: 8 }} />
      </Card>
      {[...list].sort((a, b) => Number(b.done) - Number(a.done) || b.value / b.target - a.value / a.target).map((a) => (
        <View key={a.id} style={[st.item, a.done && { borderColor: C.accent }]}>
          <Text style={{ fontSize: 34, opacity: a.done ? 1 : 0.35, width: 48, textAlign: 'center' }}>{a.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: a.done ? C.fg : C.dim, fontSize: 16, fontWeight: '800' }}>{a.name}</Text>
            <Text style={st.sub}>{a.desc}</Text>
            {!a.done && (
              <View style={{ marginTop: 8 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.line }}><View style={{ width: `${Math.round(Math.min(1, a.value / a.target) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: C.accent }} /></View>
                <Text style={[st.sub, { marginTop: 4 }]}>{fmt(a.value)} из {fmt(a.target)} {a.unit}</Text>
              </View>
            )}
          </View>
          {a.done && <Pressable onPress={() => send(shareText(a))} style={st.share} accessibilityLabel={`Поделиться: ${a.name}`}><Text style={{ color: C.accent, fontWeight: '800', fontSize: 13 }}>Поделиться</Text></Pressable>}
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  label: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  hero: { color: C.fg, fontSize: 48, fontWeight: '900' },
  unit: { color: C.dim, fontSize: 18, fontWeight: '700' },
  sub: { color: C.dim, fontSize: 13, lineHeight: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.surface },
  share: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: C.accentSoft },
});

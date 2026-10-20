import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Polyline, Line } from 'react-native-svg';
import { C } from './theme';

// Столбчатая диаграмма. data: [{ label, value, mark }], goal — линия цели
export function BarChart({ data, height = 140, color = C.accent, goal, fmt = (v) => String(v), showEvery = 1 }) {
  const max = Math.max(...data.map((d) => d.value), goal || 0, 0.0001);
  const dense = data.length > 12;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: dense ? 2 : 8 }}>
        {goal ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: (goal / max) * height, borderTopWidth: 1, borderTopColor: C.green, borderStyle: 'dashed' }} /> : null}
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, height, justifyContent: 'flex-end', alignItems: 'center' }}>
            {!dense && d.value > 0 ? <Text style={{ color: C.dim, fontSize: 10, marginBottom: 3 }} numberOfLines={1}>{fmt(d.value)}</Text> : null}
            <View style={{ width: '100%', height: Math.max(d.value > 0 ? 4 : 2, (d.value / max) * (height - (dense ? 0 : 16))), borderRadius: dense ? 3 : 6, backgroundColor: d.value > 0 ? (d.mark ? C.green : color) : C.line }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: dense ? 2 : 8, marginTop: 6 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.dim, fontSize: dense ? 9 : 11 }} numberOfLines={1}>
            {i % showEvery === 0 ? d.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Кольцо прогресса 0..1
export function Ring({ progress, size = 84, stroke = 9, color = C.accent, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      {children}
    </View>
  );
}

// Кружок дня: заливается снизу вверх по доле выполнения цели
export function DayDot({ label, fill, active, today, size = 38 }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: C.surface2, borderWidth: 2, borderColor: today ? C.fg : active ? C.accent : C.line }}>
        <View style={{ height: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%`, backgroundColor: C.accent }} />
      </View>
      <Text style={{ color: today ? C.fg : C.dim, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// Линия по значениям 0..100 (или по max)
export function LineChart({ values, labels, height = 120, color = C.green, max = 100 }) {
  const [w, setW] = useState(0);
  const n = values.length, pad = 8;
  const pts = values.map((v, i) => [pad + (n > 1 ? (i / (n - 1)) * (w - pad * 2) : (w - pad * 2) / 2), pad + (1 - Math.min(v, max) / max) * (height - pad * 2)]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1="0" x2={w} y1={pad + f * (height - pad * 2)} y2={pad + f * (height - pad * 2)} stroke={C.line} strokeWidth="1" />)}
          <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r={i === n - 1 ? 5 : 3} fill={i === n - 1 ? color : C.surface} stroke={color} strokeWidth="2" />)}
        </Svg>
      )}
      {labels && (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {labels.map((l, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.dim, fontSize: 10 }} numberOfLines={1}>{l}</Text>)}
        </View>
      )}
    </View>
  );
}

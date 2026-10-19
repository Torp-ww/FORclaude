import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Polyline, Polygon } from 'react-native-svg';
import { C } from './theme';

// Иконки в стиле Feather/Lucide
export function Icon({ name, size = 24, color = C.fg, fill = 'none', strokeWidth = 2 }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  let body = null;
  switch (name) {
    case 'record': body = <Path d="M22 12h-4l-3 9L9 3l-3 9H2" {...p} />; break;
    case 'clock': body = (<><Circle cx="12" cy="12" r="10" {...p} /><Polyline points="12 6 12 12 16 14" {...p} /></>); break;
    case 'pill': body = (<><Path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z" {...p} /><Path d="M8.5 8.5l7 7" {...p} /></>); break;
    case 'user': body = (<><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...p} /><Circle cx="12" cy="7" r="4" {...p} /></>); break;
    case 'heart': body = <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" {...p} fill={fill} />; break;
    case 'flame': body = <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" {...p} />; break;
    case 'bluetooth': body = <Path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" {...p} />; break;
    case 'pause': body = (<><Rect x="6" y="4" width="4" height="16" rx="1" fill={color} /><Rect x="14" y="4" width="4" height="16" rx="1" fill={color} /></>); break;
    case 'play': body = <Polygon points="6 3 20 12 6 21 6 3" fill={color} />; break;
    case 'stop': body = <Rect x="5" y="5" width="14" height="14" rx="2.5" fill={color} />; break;
    case 'x': body = <Path d="M18 6L6 18M6 6l12 12" {...p} />; break;
    case 'chevron': body = <Path d="M9 18l6-6-6-6" {...p} />; break;
    default: body = null;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}

export function Card({ children, style }) { return <View style={[ui.card, style]}>{children}</View>; }

export function Metric({ label, value, unit, color, big, style }) {
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      <Text style={ui.metricLabel}>{label}</Text>
      <Text style={[ui.metricValue, big && ui.metricBig, color && { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit ? <Text style={ui.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function Button({ text, onPress, color = C.accent, textColor = '#fff', style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ui.btn, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }, style]}>
      <Text style={[ui.btnText, { color: textColor }]}>{text}</Text>
    </Pressable>
  );
}

export function RoundButton({ icon, label, onPress, color = C.accent, size = 84 }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable onPress={onPress} accessibilityLabel={label}
        style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }]}>
        <Icon name={icon} size={size * 0.36} color="#fff" />
      </Pressable>
      <Text style={{ color: C.dim, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 20, padding: 16 },
  metricLabel: { color: C.dim, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  metricValue: { color: C.fg, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricBig: { fontSize: 30 },
  metricUnit: { color: C.dim, fontSize: 13, fontWeight: '600' },
  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 17, fontWeight: '800' },
});

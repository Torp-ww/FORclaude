import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

// Рисует маршрут без карт и ключей API. Паузы разрывают линию.
export default function RouteMap({ points, height = 220, color = '#5EEAD4' }) {
  const W = 340, H = height, pad = 16;
  if (!points || points.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#8896A0' }}>Маршрут появится, когда вы пойдёте</Text>
      </View>
    );
  }
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx), ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-7);
  const scale = (Math.min(W, H) - pad * 2) / span;
  const ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxY - minY) * scale) / 2;
  const xy = points.map((_, i) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale]);
  const segs = [];
  points.forEach((p, i) => { if (p.brk || i === 0) segs.push([]); segs[segs.length - 1].push(xy[i].join(',')); });
  const a = xy[0], b = xy[xy.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {segs.filter((g) => g.length > 1).map((g, i) => (
        <Polyline key={i} points={g.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <Circle cx={a[0]} cy={a[1]} r="5" fill="#0B1217" stroke="#E6EDF2" strokeWidth="2" />
      <Circle cx={b[0]} cy={b[1]} r="6" fill={color} />
    </Svg>
  );
}

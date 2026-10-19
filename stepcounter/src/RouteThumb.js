import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { C } from './theme';

// Маленький силуэт маршрута для списка тренировок (без карты).
export default function RouteThumb({ points, size = 76 }) {
  const box = { width: size, height: size, borderRadius: 14, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  if (!points || points.length < 2) return <View style={box} />;
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx), ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 10, span = Math.max(maxX - minX, maxY - minY, 1e-7), sc = (size - pad * 2) / span;
  const ox = (size - (maxX - minX) * sc) / 2, oy = (size - (maxY - minY) * sc) / 2;
  const xy = points.map((_, i) => [ox + (xs[i] - minX) * sc, oy + (ys[i] - minY) * sc]);
  const segs = [];
  points.forEach((p, i) => { if (p.brk || i === 0) segs.push([]); segs[segs.length - 1].push(xy[i].join(',')); });
  const e = xy[xy.length - 1];
  return (
    <View style={box}>
      <Svg width={size} height={size}>
        {segs.filter((g) => g.length > 1).map((g, i) => <Polyline key={i} points={g.join(' ')} fill="none" stroke={C.acc} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
        <Circle cx={e[0]} cy={e[1]} r="4" fill="#fff" />
      </Svg>
    </View>
  );
}

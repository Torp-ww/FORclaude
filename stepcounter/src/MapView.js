import React, { useMemo, useState } from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { C } from './theme';

// Карта без ключей API: плитки CARTO (данные OpenStreetMap) + маршрут поверх.
// Если интернета нет, видна тёмная подложка и сам маршрут.
const T = 256;
const lonX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

export default function MapView({ points, height = 260, radius = 20 }) {
  const [w, setW] = useState(0);
  const pad = 36;

  const view = useMemo(() => {
    if (!w || !points || points.length === 0) return null;
    const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    let z = 17;
    for (; z > 3; z--) {
      const sx = (lonX(maxLon, z) - lonX(minLon, z)) * T;
      const sy = (latY(minLat, z) - latY(maxLat, z)) * T;
      if (sx <= w - pad * 2 && sy <= height - pad * 2) break;
    }
    const cx = ((lonX(minLon, z) + lonX(maxLon, z)) / 2) * T;
    const cy = ((latY(minLat, z) + latY(maxLat, z)) / 2) * T;
    const left = cx - w / 2, top = cy - height / 2;
    const n = 2 ** z;
    const tiles = [];
    for (let ty = Math.floor(top / T); ty <= Math.floor((top + height) / T); ty++) {
      for (let tx = Math.floor(left / T); tx <= Math.floor((left + w) / T); tx++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${z}/${tx}/${ty}`, uri: `https://${'abcd'[(wx + ty) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${wx}/${ty}.png`, x: tx * T - left, y: ty * T - top });
      }
    }
    const xy = points.map((p) => [lonX(p.lon, z) * T - left, latY(p.lat, z) * T - top]);
    const segs = [];
    points.forEach((p, i) => { if (i === 0 || p.brk) segs.push([]); segs[segs.length - 1].push(xy[i].join(',')); });
    return { tiles, segs: segs.filter((g) => g.length > 1), a: xy[0], b: xy[xy.length - 1] };
  }, [w, height, points]);

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#12131A' }}>
      {view ? (
        <>
          {view.tiles.map((t) => (
            <Image key={t.key} source={{ uri: t.uri, headers: { 'User-Agent': 'Shagomer/2.0 (personal fitness app)' } }}
              style={{ position: 'absolute', left: t.x, top: t.y, width: T, height: T }} />
          ))}
          <Svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {view.segs.map((g, i) => (
              <React.Fragment key={i}>
                <Polyline points={g.join(' ')} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
                <Polyline points={g.join(' ')} fill="none" stroke={C.accent} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
              </React.Fragment>
            ))}
            <Circle cx={view.a[0]} cy={view.a[1]} r="7" fill="#fff" stroke="#000" strokeOpacity="0.4" strokeWidth="2" />
            <Circle cx={view.b[0]} cy={view.b[1]} r="9" fill={C.accent} stroke="#fff" strokeWidth="3" />
          </Svg>
          <Text style={{ position: 'absolute', right: 8, bottom: 4, color: '#C9CBD3', fontSize: 9 }}>© OpenStreetMap, © CARTO</Text>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: C.dim, textAlign: 'center' }}>Маршрут появится, когда вы пойдёте</Text>
        </View>
      )}
    </View>
  );
}

// Миниатюра маршрута для списка, без сети.
export function RouteThumb({ points, size = 64 }) {
  if (!points || points.length < 2) return <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: C.surface2 }} />;
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx), ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-7), pad = 8;
  const sc = (size - pad * 2) / span;
  const ox = (size - (maxX - minX) * sc) / 2, oy = (size - (maxY - minY) * sc) / 2;
  const segs = [];
  points.forEach((p, i) => { if (i === 0 || p.brk) segs.push([]); segs[segs.length - 1].push(`${ox + (xs[i] - minX) * sc},${oy + (ys[i] - minY) * sc}`); });
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: C.surface2 }}>
      <Svg width={size} height={size}>
        {segs.filter((g) => g.length > 1).map((g, i) => (
          <Polyline key={i} points={g.join(' ')} fill="none" stroke={C.accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </Svg>
    </View>
  );
}

import React, { useState } from 'react';
import { View, Image, Text } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { C } from './theme';

// Карта из плиток OpenStreetMap (тёмный стиль CARTO) и маршрут поверх неё.
// Без ключей API. Без интернета видна только линия маршрута на тёмном фоне.
const TILE = 256;

function worldPx(lat, lon, z) {
  const s = TILE * Math.pow(2, z);
  const x = ((lon + 180) / 360) * s;
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * s;
  return [x, y];
}

function chooseView(points, center, W, H, mode, pad) {
  if (!points.length) {
    const c = center ?? { lat: 56.8389, lon: 60.6057 };
    const [x, y] = worldPx(c.lat, c.lon, 16);
    return { z: 16, cx: x, cy: y };
  }
  if (mode === 'follow') {
    const last = points[points.length - 1];
    const [x, y] = worldPx(last.lat, last.lon, 17);
    return { z: 17, cx: x, cy: y };
  }
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  for (let z = 17; z >= 3; z--) {
    const [x1, y1] = worldPx(maxLat, minLon, z), [x2, y2] = worldPx(minLat, maxLon, z);
    if (Math.abs(x2 - x1) <= W - pad * 2 && Math.abs(y2 - y1) <= H - pad * 2) return { z, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  }
  const [x, y] = worldPx((minLat + maxLat) / 2, (minLon + maxLon) / 2, 3);
  return { z: 3, cx: x, cy: y };
}

export default function TileMap({ points = [], center, mode = 'fit', height = 300, style, showAttribution = true, pad = 40 }) {
  const [size, setSize] = useState(null);
  const W = size?.w ?? 0, H = size?.h ?? 0;
  const body = [];
  if (size) {
    const { z, cx, cy } = chooseView(points, center, W, H, mode, pad);
    const ox = cx - W / 2, oy = cy - H / 2, n = Math.pow(2, z);
    const tx0 = Math.floor(ox / TILE), tx1 = Math.floor((ox + W) / TILE);
    const ty0 = Math.floor(oy / TILE), ty1 = Math.floor((oy + H) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        const url = `https://${'abc'[(wx + ty) % 3]}.basemaps.cartocdn.com/dark_all/${z}/${wx}/${ty}@2x.png`;
        body.push(<Image key={`${z}/${tx}/${ty}`} source={{ uri: url }} fadeDuration={0}
          style={{ position: 'absolute', left: tx * TILE - ox, top: ty * TILE - oy, width: TILE, height: TILE }} />);
      }
    }
    const segs = [];
    points.forEach((p, i) => {
      const [x, y] = worldPx(p.lat, p.lon, z);
      if (p.brk || i === 0) segs.push([]);
      segs[segs.length - 1].push([x - ox, y - oy]);
    });
    const first = segs.length ? segs[0][0] : null;
    const lastSeg = segs.length ? segs[segs.length - 1] : null;
    const end = lastSeg ? lastSeg[lastSeg.length - 1] : null;
    let marker = null;
    if (!end && center) { const [x, y] = worldPx(center.lat, center.lon, z); marker = [x - ox, y - oy]; }
    body.push(
      <Svg key="route" width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        {segs.filter((g) => g.length > 1).map((g, i) => (
          <React.Fragment key={i}>
            <Polyline points={g.map((q) => q.join(',')).join(' ')} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
            <Polyline points={g.map((q) => q.join(',')).join(' ')} fill="none" stroke={C.acc} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          </React.Fragment>
        ))}
        {first && end && points.length > 1 && <Circle cx={first[0]} cy={first[1]} r="6" fill="#fff" stroke="#000" strokeWidth="2" />}
        {end && <><Circle cx={end[0]} cy={end[1]} r="16" fill={C.acc} fillOpacity="0.28" /><Circle cx={end[0]} cy={end[1]} r="8" fill={C.acc} stroke="#000" strokeWidth="2.500" /></>}
        {marker && <><Circle cx={marker[0]} cy={marker[1]} r="16" fill="#0A84FF" fillOpacity="0.28" /><Circle cx={marker[0]} cy={marker[1]} r="8" fill="#0A84FF" stroke="#fff" strokeWidth="2.500" /></>}
      </Svg>
    );
  }
  return (
    <View style={[{ height, backgroundColor: '#0B0C0E', overflow: 'hidden' }, style]}
      onLayout={(e) => { const { width, height: h } = e.nativeEvent.layout; if (width > 0 && h > 0) setSize({ w: width, h }); }}>
      {body}
      {showAttribution && <Text style={{ position: 'absolute', left: 8, bottom: 4, color: '#8E8E93', fontSize: 9 }}>© OpenStreetMap © CARTO</Text>}
    </View>
  );
}

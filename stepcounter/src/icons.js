import React from 'react';
import Svg, { Circle, Path, Rect, Polygon } from 'react-native-svg';

// Простые иконки, нарисованные вручную (без внешних шрифтов).
export default function Icon({ name, size = 24, color = '#fff' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' };
  const st = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'record': return (<Svg {...p}><Circle cx="12" cy="12" r="9" {...st} /><Circle cx="12" cy="12" r="3.5" fill={color} /></Svg>);
    case 'history': return (<Svg {...p}><Circle cx="12" cy="12" r="9" {...st} /><Path d="M12 7v5l3.5 2" {...st} /></Svg>);
    case 'pill': return (<Svg {...p}><Rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" {...st} /><Path d="M9.2 9.2l5.6 5.6" {...st} /></Svg>);
    case 'me': return (<Svg {...p}><Circle cx="12" cy="8" r="4" {...st} /><Path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" {...st} /></Svg>);
    case 'heart': return (<Svg {...p}><Path d="M12 20.5s-7.5-4.6-9.5-9.2C1 7.700 3.200 4.500 6.600 4.500c2 0 3.700 1.100 5.400 3 1.700-1.900 3.400-3 5.400-3 3.400 0 5.600 3.200 4.100 6.800-2 4.600-9.500 9.200-9.500 9.200z" fill={color} /></Svg>);
    case 'pause': return (<Svg {...p}><Rect x="6" y="5" width="4" height="14" rx="1.200" fill={color} /><Rect x="14" y="5" width="4" height="14" rx="1.200" fill={color} /></Svg>);
    case 'play': return (<Svg {...p}><Polygon points="8,5 19,12 8,19" fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" /></Svg>);
    case 'stop': return (<Svg {...p}><Rect x="6" y="6" width="12" height="12" rx="2.500" fill={color} /></Svg>);
    case 'close': return (<Svg {...p}><Path d="M6 6l12 12M18 6L6 18" {...st} /></Svg>);
    case 'bluetooth': return (<Svg {...p}><Path d="M7 7l10 10-5 4V3l5 4L7 17" {...st} /></Svg>);
    default: return null;
  }
}

// Пульс с Bluetooth-датчика (нагрудный ремень, часы или браслет с передачей пульса).
// Стандартный профиль Heart Rate: сервис 0x180D, характеристика 0x2A37.
import { PermissionsAndroid, Platform } from 'react-native';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';

let manager = null;
function mgr() {
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
  }
  return manager;
}

function b64bytes(b64) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out = [];
  let buf = 0, bits = 0;
  for (const ch of String(b64).replace(/=+$/, '')) {
    const v = abc.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return out;
}

export function parseHeartRate(b64) {
  const b = b64bytes(b64);
  if (b.length < 2) return null;
  return (b[0] & 1) ? (b[1] | (b[2] << 8)) : b[1];
}

export async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

// Поиск датчиков рядом. Возвращает функцию остановки.
export async function scan(onDevice, onError, ms = 12000) {
  if (!(await ensurePermissions())) throw new Error('Нет разрешения на Bluetooth');
  const m = mgr();
  const state = await m.state();
  if (state !== 'PoweredOn') throw new Error('Включите Bluetooth на телефоне');
  const seen = new Set();
  let timer = null;
  const stop = () => { clearTimeout(timer); try { m.stopDeviceScan(); } catch {} };
  m.startDeviceScan([HR_SERVICE], null, (err, dev) => {
    if (err) { stop(); onError(err); return; }
    if (dev && !seen.has(dev.id)) { seen.add(dev.id); onDevice({ id: dev.id, name: dev.name || dev.localName || 'Датчик пульса' }); }
  });
  timer = setTimeout(stop, ms);
  return stop;
}

// Подключение и приём пульса. onBpm(число), onLost().
export async function connect(id, onBpm, onLost) {
  if (!(await ensurePermissions())) throw new Error('Нет разрешения на Bluetooth');
  const m = mgr();
  const dev = await m.connectToDevice(id, { timeout: 15000 });
  await dev.discoverAllServicesAndCharacteristics();
  const sub = dev.monitorCharacteristicForService(HR_SERVICE, HR_CHAR, (err, ch) => {
    if (err) { onLost(); return; }
    const bpm = ch?.value ? parseHeartRate(ch.value) : null;
    if (bpm) onBpm(bpm);
  });
  const dsub = dev.onDisconnected(() => onLost());
  return {
    disconnect: async () => { try { sub.remove(); dsub.remove(); await dev.cancelConnection(); } catch {} },
  };
}

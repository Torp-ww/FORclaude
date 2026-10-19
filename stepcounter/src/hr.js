// Пульс с Bluetooth-датчика (нагрудный ремень, часы или браслет с режимом «передача пульса»).
// Стандартный профиль Heart Rate: сервис 0x180D, характеристика 0x2A37.
import { Platform, PermissionsAndroid } from 'react-native';

const SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const CHAR = '00002a37-0000-1000-8000-00805f9b34fb';

let manager = null;
let current = null;
let currentSub = null;

function mgr() {
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx'); // создаётся только когда нужен
    manager = new BleManager();
  }
  return manager;
}

export async function requestPermissions() {
  if (Platform.OS !== 'android') return true;
  const need = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(need);
  return need.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export function parseHeartRate(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  let buf = 0, bits = 0;
  for (const ch of base64.replace(/=+$/, '')) {
    buf = (buf << 6) | chars.indexOf(ch); bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  if (bytes.length < 2) return null;
  return (bytes[0] & 1) ? bytes[1] | (bytes[2] << 8) : bytes[1];
}

export function startScan(onFound, onError) {
  const m = mgr();
  const seen = new Set();
  const sub = m.onStateChange((state) => {
    if (state === 'PoweredOn') {
      m.startDeviceScan([SERVICE], null, (err, dev) => {
        if (err) { onError(err.message || String(err)); return; }
        if (dev && !seen.has(dev.id)) { seen.add(dev.id); onFound({ id: dev.id, name: dev.name || dev.localName || 'Датчик пульса' }); }
      });
    } else if (state === 'PoweredOff') onError('Включите Bluetooth на телефоне.');
  }, true);
  return () => { try { m.stopDeviceScan(); sub.remove(); } catch {} };
}

export async function connect(id, onBpm, onLost) {
  await disconnect();
  const m = mgr();
  const dev = await m.connectToDevice(id, { timeout: 15000 });
  await dev.discoverAllServicesAndCharacteristics();
  current = dev;
  dev.onDisconnected(() => { current = null; currentSub = null; onLost && onLost(); });
  currentSub = dev.monitorCharacteristicForService(SERVICE, CHAR, (err, ch) => {
    if (err || !ch || !ch.value) return;
    const bpm = parseHeartRate(ch.value);
    if (bpm && bpm > 20 && bpm < 250) onBpm(bpm);
  });
  return dev.name || 'Датчик пульса';
}

export async function disconnect() {
  try { currentSub && currentSub.remove(); } catch {}
  try { current && (await current.cancelConnection()); } catch {}
  current = null; currentSub = null;
}

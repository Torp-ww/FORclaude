#!/usr/bin/env bash
# Проверка приложения в эмуляторе: запуск, вкладки, запись прогулки с имитацией GPS, итоги.
set -u
PKG=com.example.stepcounter
mkdir -p shots
adb install -r shagomer.apk
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION POST_NOTIFICATIONS BLUETOOTH_SCAN BLUETOOTH_CONNECT ACTIVITY_RECOGNITION; do
  adb shell pm grant $PKG android.permission.$p >/dev/null 2>&1 || true
done
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 20

shot() { adb exec-out screencap -p > "shots/$1.png"; }

cat > tap.py <<'PY'
import sys, re, subprocess
import xml.etree.ElementTree as ET
t = sys.argv[1]
root = ET.parse('ui.xml').getroot()
for n in root.iter('node'):
    if n.get('text') == t or n.get('content-desc') == t:
        m = re.findall(r'\d+', n.get('bounds'))
        x = (int(m[0]) + int(m[2])) // 2
        y = (int(m[1]) + int(m[3])) // 2
        subprocess.run(['adb', 'shell', 'input', 'tap', str(x), str(y)])
        sys.exit(0)
sys.exit(1)
PY

tap_text() {
  for i in 1 2 3; do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1
    if python3 tap.py "$1"; then sleep 2; return 0; fi
    sleep 2
  done
  echo "NOT FOUND: $1"; return 1
}

SIZE=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1)
W=${SIZE%x*}; H=${SIZE#*x}
scroll() { adb shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*25/100)) 400; sleep 1; }

shot 01-idle
tap_text "Активности"; shot 02-history
tap_text "Таблетки"; shot 03-pills
tap_text "Профиль"; shot 04-profile
tap_text "Запись"
shot 05-idle-again
tap_text "Старт" || tap_text "СТАРТ"
sleep 3
shot 06-started

cat > walk.py <<'PY'
import math, sys, time, subprocess, datetime
lat, lon = 56.8389, 60.6057
def nm(v, isLat):
    a = abs(v); d = int(a); m = (a - d) * 60
    return (f"{d:02d}" if isLat else f"{d:03d}") + f"{m:07.4f}"
def cs(s):
    c = 0
    for ch in s: c ^= ord(ch)
    return f"{c:02X}"
def send(sentence):
    full = f"${sentence}*{cs(sentence)}"
    subprocess.run(['adb', 'emu', 'geo', 'nmea', full], stdout=subprocess.DEVNULL)
heading = 45.0
for i in range(int(sys.argv[1])):
    heading += 1.2
    step = 1.6  # м/с
    lat += step * math.cos(math.radians(heading)) / 111320
    lon += step * math.sin(math.radians(heading)) / (111320 * math.cos(math.radians(lat)))
    now = datetime.datetime.utcnow()
    hh = now.strftime('%H%M%S.00'); dd = now.strftime('%d%m%y')
    la, lo = nm(lat, True), nm(lon, False)
    send(f"GPGGA,{hh},{la},N,{lo},E,1,08,0.9,250.0,M,0.0,M,,")
    send(f"GPRMC,{hh},A,{la},N,{lo},E,3.11,{heading % 360:.1f},{dd},,,A")
    time.sleep(1)
PY
python3 walk.py 20
shot 07-recording-a
python3 walk.py 25
shot 08-recording-b
scroll; shot 09-recording-scrolled
tap_text "Пауза"; sleep 2; shot 10-paused
tap_text "Завершить"; sleep 3; shot 11-summary
scroll; shot 12-summary-2
scroll; shot 13-summary-3
adb logcat -d > logcat-full.txt
grep -E "FATAL|AndroidRuntime: |ReactNativeJS|Cannot find|UnsatisfiedLink|NoClassDef|NoSuchMethod" logcat-full.txt | grep -v -E "START com.android|Calling main entry|VM exiting|Using default boot|Leaving lock" | head -200 > crash.txt || true
adb shell pidof $PKG > pid.txt || echo none > pid.txt

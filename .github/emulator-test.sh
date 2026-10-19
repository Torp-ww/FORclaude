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

# системные окна «не отвечает» эмулятора закрываем нажатием «Wait» (не относится к приложению)
anr() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 && python3 tap.py "Wait" && sleep 2
  return 0
}
SIZE=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1)
W=${SIZE%x*}; H=${SIZE#*x}
scroll() { adb shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*25/100)) 400; sleep 1; }

anr
shot 01-idle
tap_text "Подключить датчик пульса"; sleep 3; shot 01b-hr-modal
adb shell input keyevent 4; sleep 2
tap_text "Активности"; shot 02-history
tap_text "Таблетки"; shot 03-pills
tap_text "Профиль"; shot 04-profile
tap_text "Запись"
shot 05-idle-again
anr
tap_text "Старт" || tap_text "СТАРТ"
sleep 3
shot 06-started

cat > walk.py <<'PY'
import math, sys, time, subprocess, json, os
ST = 'walk.state'
lat, lon, heading = (json.load(open(ST)) if os.path.exists(ST) else [56.8389, 60.6057, 45.0])
for i in range(int(sys.argv[1])):
    heading += 1.2
    step = 1.6  # метров за секунду
    lat += step * math.cos(math.radians(heading)) / 111320
    lon += step * math.sin(math.radians(heading)) / (111320 * math.cos(math.radians(lat)))
    subprocess.run(['adb', 'emu', 'geo', 'fix', f'{lon:.7f}', f'{lat:.7f}', '250'], stdout=subprocess.DEVNULL)
    time.sleep(1)
json.dump([lat, lon, heading], open(ST, 'w'))
PY
python3 walk.py 20
shot 07-recording-a
python3 walk.py 25
shot 08-recording-b
scroll; shot 09-recording-scrolled
# во время записи экран обновляется каждую секунду, uiautomator не успевает, поэтому нажимаем по координатам
tapf() { adb shell input tap $((W*$1/1000)) $((H*$2/1000)); }
tapf 500 765; sleep 3; shot 10-paused
tapf 680 765; sleep 4; shot 11-summary
scroll; shot 12-summary-2
scroll; shot 13-summary-3
scroll; shot 14-summary-4
tap_text "Готово"; tap_text "Активности"; sleep 2; shot 15-history-item
adb logcat -d > logcat-full.txt
grep -E "FATAL|AndroidRuntime: |ReactNativeJS|Cannot find|UnsatisfiedLink|NoClassDef|NoSuchMethod" logcat-full.txt | grep -v -E "START com.android|Calling main entry|VM exiting|Using default boot|Leaving lock" | head -200 > crash.txt || true
adb shell pidof $PKG > pid.txt || echo none > pid.txt

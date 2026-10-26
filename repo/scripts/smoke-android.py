"""Exercise the packaged APK through Android accessibility, without personal data."""
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[2]
report = root / 'dist/reports/android'
report.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', *args])

def snapshot():
    adb('shell', 'uiautomator', 'dump', '/sdcard/wordbook-ui.xml')
    data = adb('exec-out', 'cat', '/sdcard/wordbook-ui.xml')
    (report / 'ui.xml').write_bytes(data)
    return ET.fromstring(data)

def find(label, tap=False):
    deadline = time.monotonic() + 45
    attempt = 0
    while time.monotonic() < deadline:
        try:
            tree = snapshot()
        except (ET.ParseError, subprocess.CalledProcessError):
            time.sleep(1)
            continue  # Accessibility may not have a root while the first WebView frame is loading.
        for node in tree.iter('node'):
            text = node.attrib.get('text', '') + node.attrib.get('content-desc', '')
            if label in text:
                x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.attrib['bounds']))
                if x2 <= x1 or y2 <= y1:
                    continue  # WebView exposes off-screen text with zero bounds; never tap (0, 0).
                if tap:
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                    time.sleep(1)
                return
        bounds = next(tree.iter('node')).attrib['bounds']
        _, _, width, height = map(int, re.findall(r'\d+', bounds))
        start, end = (int(height*.78), int(height*.25)) if attempt % 8 < 4 else (int(height*.25), int(height*.78))
        adb('shell', 'input', 'swipe', str(width//2), str(start), str(width//2), str(end), '300')
        attempt += 1
        time.sleep(1)
    raise AssertionError('Android UI missing: ' + label)

def activity(package):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        state = adb('shell', 'dumpsys', 'activity', 'activities').decode('utf-8', errors='replace')
        if any(package in line for line in state.splitlines() if 'mResumedActivity' in line or 'topResumedActivity' in line):
            return
        time.sleep(1)
    raise AssertionError('Android activity not resumed: ' + package)

checks = []
try:
    adb('install', '-r', str(root / 'dist/android/Wordbook-debug.apk'))
    adb('shell', 'pm', 'clear', 'com.wordbook.app')
    adb('shell', 'am', 'start', '-n', 'com.wordbook.app/.MainActivity')
    find('先用示例体验', True)
    find('开始背诵', True)
    find('bloom')
    checks.append('APK offline assets and Android bridge initialize; demo card renders')
    find('下一个', True)
    find('curiosity')
    adb('shell', 'am', 'force-stop', 'com.wordbook.app')
    adb('shell', 'am', 'start', '-n', 'com.wordbook.app/.MainActivity')
    find('继续背诵', True)
    find('curiosity')
    checks.append('Study position survives force-stop and relaunch')
    find('基础设置', True)
    find('导出全部数据', True)
    activity('documentsui')
    find('wordbook-backup.json')
    adb('shell', 'input', 'keyevent', '4')
    activity('com.wordbook.app')
    find('数据与备份')
    checks.append('Native JSON export opens system save dialog and supports cancellation')
    find('导入单词本', True)
    find('选择文件', True)
    activity('documentsui')
    adb('shell', 'input', 'keyevent', '4')
    activity('com.wordbook.app')
    find('选择文件')
    checks.append('Native document picker opens and cancels back into the app')
    (report / 'screen.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    (report / 'smoke.json').write_text(json.dumps({'passed': True, 'checks': checks}, indent=2), encoding='utf-8')
except Exception as error:
    (report / 'screen.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    (report / 'logcat.txt').write_bytes(adb('logcat', '-d'))
    (report / 'smoke.json').write_text(json.dumps({'passed': False, 'error': str(error), 'checks': checks}), encoding='utf-8')
    raise

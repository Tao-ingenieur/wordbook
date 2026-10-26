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

def find(label, tap=False, exact=False, timeout=45):
    deadline = time.monotonic() + timeout
    attempt = 0
    while time.monotonic() < deadline:
        try:
            tree = snapshot()
        except (ET.ParseError, subprocess.CalledProcessError):
            time.sleep(1)
            continue  # Accessibility may not have a root while the first WebView frame is loading.
        for node in tree.iter('node'):
            if node.attrib.get('resource-id', '').endswith('/preview_icon'):
                continue  # DocumentsUI preview is different from selecting the named file.
            text = node.attrib.get('text', '') + node.attrib.get('content-desc', '')
            matched = text.casefold() == label.casefold() if exact else label in text
            if matched:
                x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.attrib['bounds']))
                if x2 <= x1 or y2 <= y1:
                    continue  # WebView exposes off-screen text with zero bounds; never tap (0, 0).
                if tap:
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                    time.sleep(1)
                return node.attrib
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
package = 'com.wordbook.offline'
component = package + '/com.wordbook.app.MainActivity'
try:
    upgrade = root / 'dist/.cache/android-upgrade/Wordbook-debug.apk'
    if upgrade.exists():
        adb('install', '-r', str(upgrade)); adb('shell', 'pm', 'clear', package)
        adb('shell', 'am', 'start', '-n', component)
        find('先用示例体验', True); find('开始背诵', True); find('下一个', True); find('curiosity')
        adb('shell', 'am', 'force-stop', package)
        adb('install', '-r', str(root / 'dist/android/Wordbook-debug.apk'))
        adb('shell', 'am', 'start', '-n', component); find('继续背诵', True); find('curiosity')
        checks.append('Persistent certificate verified; in-place upgrade retains words and study position')
        adb('shell', 'am', 'force-stop', package); adb('shell', 'pm', 'clear', package)
    baseline = root / 'dist/.cache/android-baseline/Wordbook-debug.apk'
    previous = json.loads((baseline.parent / 'build-info.json').read_text()) if baseline.exists() else {'package': package}
    old_package = previous['package']
    old_component = old_package + '/com.wordbook.app.MainActivity'
    # This second scenario resets a disposable emulator to an older debug fixture.
    # Allow that fixture downgrade; the actual upgrade above/below never uses -d.
    adb('install', '-r', '-d', str(baseline if baseline.exists() else root / 'dist/android/Wordbook-debug.apk'))
    adb('shell', 'pm', 'clear', old_package)
    adb('shell', 'am', 'start', '-n', old_component)
    find('先用示例体验', True)
    find('开始背诵', True)
    find('bloom')
    checks.append('APK offline assets and Android bridge initialize; demo card renders')
    find('下一个', True)
    find('curiosity')
    if old_package != package:
        find('基础设置', True); find('导出全部数据', True); activity('documentsui')
        find('wordbook-backup.json', True)
        adb('shell', 'input', 'keycombination', '113', '29')
        adb('shell', 'input', 'text', 'wordbook-legacy.json')
        adb('shell', 'input', 'keyevent', '4')
        find('Save', True, exact=True); activity(old_package)
    adb('shell', 'am', 'force-stop', old_package)
    if baseline.exists():
        adb('install', '-r', str(root / 'dist/android/Wordbook-debug.apk'))
        if old_package == package: checks.append('In-place upgrade keeps the same signing identity and existing app data')
    adb('shell', 'am', 'start', '-n', component)
    if old_package != package:
        find('导入单词本', True); find('选择文件', True); activity('documentsui'); find('wordbook-legacy.json', True)
        activity(package); find('备份差异与恢复'); find('确认所选恢复方式', True)
        assert adb('shell', 'pm', 'path', old_package).strip()
        checks.append('Legacy app remains installed; manual JSON migration restores its books and progress')
    find('继续背诵', True)
    find('curiosity')
    checks.append('Study position survives force-stop and relaunch')
    card = find('curiosity')
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', card['bounds']))
    y = (y1+y2)//2
    adb('shell', 'input', 'swipe', str(x1 + (x2-x1)*3//4), str(y), str(x1+(x2-x1)//4), str(y), '300')
    find('embrace')
    checks.append('Horizontal touch swipe changes the study card')
    find('搜索与编辑词条', True)
    find('新增词条', True)
    find('单词（必填）', True)
    adb('shell', 'input', 'text', 'zoology')
    adb('shell', 'input', 'keyevent', '4')
    find('保存词条', True)
    find('搜索单词或释义', True)
    adb('shell', 'input', 'text', 'zoology')
    adb('shell', 'input', 'keyevent', '4')
    find('跳转背诵', True)
    find('zoology')
    checks.append('Add and search a word, then jump to its study card')
    find('已记住，隐藏', True)
    find('继续查看', True)
    find('撤销隐藏', True)
    find('zoology')
    find('下一个', True)
    find('本轮已完成')
    find('返回单词本', True)
    checks.append('Undo hiding restores the word; end of round stops instead of wrapping')
    find('基础设置', True)
    find('导出全部数据', True)
    activity('documentsui')
    find('wordbook-backup.json')
    find('Save', True, exact=True)
    activity(package)
    find('数据与备份')
    saved = json.loads(adb('exec-out', 'cat', '/sdcard/Download/wordbook-backup.json'))
    assert any(e['word'] == 'zoology' for book in saved['books'] for e in book['entries'])
    checks.append('Native JSON export writes a complete readable backup to Downloads')
    find('导入单词本', True)
    find('选择文件', True)
    activity('documentsui')
    find('wordbook-backup.json', True)
    activity(package)
    find('备份差异与恢复')
    find('使用备份覆盖', True)
    find('确认所选恢复方式', True)
    find('继续背诵')
    checks.append('Native document selection reads JSON; difference review restores chosen book')
    # A real PDF exercises the local HTTPS origin and embedded module Worker in Android WebView.
    content = b'BT /F1 14 Tf 40 780 Td (androidpdfword  /test/  native-test) Tj ET'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
               b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    pdf = bytearray(b'%PDF-1.4\n'); offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(pdf)); pdf.extend(f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n')
    xref = len(pdf); pdf.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]: pdf.extend(f'{offset:010} 00000 n \n'.encode())
    pdf.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode())
    fixture = report / 'wordbook-native.pdf'; fixture.write_bytes(pdf)
    adb('push', str(fixture), '/sdcard/Download/wordbook-native.pdf')
    find('导入单词本', True); find('选择文件', True); activity('documentsui')
    try: find('wordbook-native.pdf', True, timeout=6)
    except AssertionError:
        find('Show roots', True); find('Downloads', True, exact=True); find('wordbook-native.pdf', True)
    activity(package); find('检查导入内容'); find('androidpdfword')
    find('创建单词本', True)
    checks.append('Android imports an actual text PDF using its embedded local PDF Worker')
    manifest = json.loads((root / 'repo/src/manifest.json').read_text(encoding='utf-8'))
    find('帮助', True, exact=True)
    find('版本 ' + manifest['versionName'])
    find('构建号 ' + manifest['versionCode'])
    installed = adb('shell', 'dumpsys', 'package', package).decode('utf-8', errors='replace')
    assert 'versionName=' + manifest['versionName'] in installed
    assert 'versionCode=' + manifest['versionCode'] + ' ' in installed
    checks.append('Help shows version and build number matching the installed APK')
    find('基础设置', True)
    find('English', True, exact=True)
    find('Interface language')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-n', component)
    find('My wordbooks')
    find('Help', True, exact=True)
    find('Version ' + manifest['versionName'])
    find('Build ' + manifest['versionCode'])
    (report / 'screen-en.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    find('Settings', True)
    find('中文', True, exact=True)
    find('基础设置')
    checks.append('English interface persists after restart; Help and settings switch back to Chinese')
    (report / 'screen.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    (report / 'smoke.json').write_text(json.dumps({'passed': True, 'checks': checks}, indent=2), encoding='utf-8')
except Exception as error:
    (report / 'screen.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    (report / 'logcat.txt').write_bytes(adb('logcat', '-d'))
    (report / 'smoke.json').write_text(json.dumps({'passed': False, 'error': str(error), 'checks': checks}), encoding='utf-8')
    raise

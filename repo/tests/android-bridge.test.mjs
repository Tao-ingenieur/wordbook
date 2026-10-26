import test from 'node:test';
import assert from 'node:assert/strict';
import { saveAndroidBackup } from '../src/platform/android-bridge.js';

test('Android 导出通过系统结果确认成功、取消和错误，忽略其他请求的结果', async () => {
  const previous = globalThis.window;
  const events = new EventTarget();
  const pending = [];
  globalThis.window = events;
  events.WordbookAndroid = { saveFile: (name, text, id) => pending.push({ name, text, id }) };
  const finish = detail => events.dispatchEvent(new CustomEvent('wordbook-native-result', { detail }));
  try {
    const first = saveAndroidBackup('one.json', '{"books":[]}');
    const second = saveAndroidBackup('two.json', '{}');
    assert.equal(pending[0].text, '{"books":[]}');
    assert.notEqual(pending[0].id, pending[1].id);
    finish({ id: pending[1].id, saved: false }); assert.equal(await second, false);
    finish({ id: pending[0].id, saved: true }); assert.equal(await first, true);
    const failure = saveAndroidBackup('three.json', '{}');
    finish({ id: pending[2].id, error: '写入失败' }); await assert.rejects(failure, /写入失败/);
    events.WordbookAndroid.saveFile = () => { throw Error('桥接不可用'); };
    await assert.rejects(saveAndroidBackup('four.json', '{}'), /桥接不可用/);
  } finally { globalThis.window = previous; }
});

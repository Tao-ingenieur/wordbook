import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { en, translate } from '../src/i18n/messages.mjs';

test('界面翻译覆盖页面及组件的静态消息，并保留插值内容', async () => {
  for (const file of ['pages/index/index.vue', 'components/word-manager.vue', 'components/backup-review.vue', 'components/app-file-picker.vue']) {
    const source = (await fs.readFile(new URL('../src/' + file, import.meta.url), 'utf8')).replaceAll('&quot;', '"');
    for (const match of source.matchAll(/\bt\((['"])(.*?)\1/g)) {
      assert.ok(Object.hasOwn(en, match[2]), `${file}: ${match[2]}`);
      assert.ok(en[match[2]].trim());
    }
  }
  const key = '删除「{0}」？修改前会保留本地恢复点。';
  assert.equal(translate(key, 'en', { 0: '我的词汇 {name}' }), 'Delete “我的词汇 {name}”? A local restore point will be saved first.');
  assert.equal(translate('帮助', 'zh'), '帮助');
  assert.equal(translate('unknown message', 'en'), 'unknown message');
});

test('语言独立持久化，重载恢复且不改变单词本或恢复点，写入失败保持原语言', async () => {
  const previous = globalThis.uni;
  const store = new Map([['wordbook.locale', 'en'], ['wordbook.v1', '个人单词本'], ['wordbook.recovery.v1', '恢复点']]);
  globalThis.uni = { getStorageSync: key => store.get(key), setStorageSync: (key, value) => store.set(key, value) };
  try {
    const i18n = await import('../src/i18n/index.js?locale-test');
    assert.equal(i18n.locale.value, 'en');
    assert.equal(i18n.t('帮助'), 'Help');
    assert.equal(i18n.locationText('Sheet · 第 12 行 · 第 3 页'), 'Sheet · Row 12 · Page 3');
    assert.equal(i18n.warningText('缺少释义；重复词条'), 'Missing definition; Duplicate word');
    i18n.setLocale('zh'); assert.equal(store.get('wordbook.locale'), 'zh');
    assert.equal(i18n.t('帮助'), '帮助');
    globalThis.uni.setStorageSync = () => { throw Error('quota'); };
    assert.throws(() => i18n.setLocale('en'), /quota/);
    assert.equal(i18n.locale.value, 'zh');
    assert.throws(() => i18n.setLocale('fr'));
    assert.equal(store.get('wordbook.v1'), '个人单词本');
    assert.equal(store.get('wordbook.recovery.v1'), '恢复点');
  } finally { globalThis.uni = previous; }
});

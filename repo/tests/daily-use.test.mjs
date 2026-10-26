import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, importBook, rememberStudy, studySession, validateBackup } from '../src/core/model.mjs';
import { editEntry, deleteEntry, searchEntries, backupDiff, restoreWithChoices, stepSession } from '../src/core/book-tools.mjs';
import { createPlayer } from '../src/core/player.mjs';
import { saveState, loadState, recoveryPoints, lastExport, recordExport } from '../src/platform/storage.js';
const create = () => importBook(emptyState(), 'book', 'file:one', ['apple', 'bee', 'cat'].map(word => ({ word, meaning: word === 'apple' ? '苹果' : '释义' })));
const clone = value => JSON.parse(JSON.stringify(value));

test('本内搜索支持大小写、全角、中文释义与隐藏词筛选', () => {
  const book = create().books[0]; book.entries[1].status = 'hidden';
  assert.deepEqual(searchEntries(book, 'ＡＰＰ').map(e => e.word), ['apple']);
  assert.equal(searchEntries(book, '苹果').length, 1);
  assert.equal(searchEntries(book, '', 'hidden')[0].word, 'bee');
  assert.equal(searchEntries(book, 'bee', 'new').length, 0);
});
test('编辑原词保留隐藏状态和进度，新增拒绝重复和空词', () => {
  let book = create().books[0]; book = rememberStudy(book, { ...studySession(book, 'random', { random: () => 0 }), cursor: 1 });
  const selected = book.entries.find(e => e.word === studySession(book).queue[1]);
  const original = clone(book);
  book = editEntry(book, selected.id, { ...selected, word: 'new-word', meaning: '新释义' });
  assert.equal(studySession(book).queue[studySession(book).cursor], 'new-word');
  assert.equal(original.entries.find(e => e.id === selected.id).word, selected.word);
  assert.throws(() => editEntry(book, null, { word: 'APPLE' }), /已存在/);
  assert.throws(() => editEntry(book, null, { word: ' ' }), /不能为空/);
  book.entries[0].status = 'hidden';
  assert.equal(editEntry(book, book.entries[0].id, { ...book.entries[0], meaning: '修正' }).entries[0].status, 'hidden');
});
test('删除当前词修复乱序队列，删除全部词仍是有效单词本', () => {
  let book = create().books[0]; book = rememberStudy(book, studySession(book, 'random', { random: () => 0 }));
  const removed = studySession(book).queue[0];
  book = deleteEntry(book, book.entries.find(e => e.word === removed).id);
  assert.equal(studySession(book).queue.includes(removed), false);
  for (const entry of book.entries.slice()) book = deleteEntry(book, entry.id);
  assert.equal(validateBackup({ ...emptyState(), books: [book] }).books[0].entries.length, 0);
});
test('到队尾完成不循环，完成状态可备份，后退/重开/新增可继续', () => {
  let book = create().books[0];
  let session = { ...studySession(book), cursor: 2 };
  session = stepSession(session, 1);
  assert.equal(session.cursor, 2); assert.equal(session.completed, true);
  book = rememberStudy(book, session);
  book = validateBackup({ ...emptyState(), books: [book] }).books[0];
  assert.equal(studySession(book).completed, true);
  assert.equal(stepSession(studySession(book), -1).completed, false);
  assert.equal(studySession(book, 'alpha', { restart: true }).completed, undefined);
  assert.equal(studySession(editEntry(book, null, { word: 'dog' })).completed, undefined);
  assert.equal(stepSession({ ...session, cursor: 0 }, -1).cursor, 0);
});
test('恢复差异比较新增、移除、释义、隐藏与独立进度差异', () => {
  const local = create(), incoming = clone(local);
  incoming.books[0].entries[0].meaning = '新释义'; incoming.books[0].entries[0].status = 'hidden';
  incoming.books[0].entries.splice(1, 1); incoming.books[0].entries.push({ ...incoming.books[0].entries[1], word: 'dog' });
  const row = backupDiff(local, incoming)[0];
  assert.equal(row.added, 1); assert.equal(row.removed, 1); assert.equal(row.changed, 1); assert.equal(row.statusChanged, 1); assert.equal(row.progressChanged, true);
});
test('恢复默认保留本机，合并只补新词，覆盖必须显式选择，其他本保留', () => {
  let local = create(); local.books[0] = rememberStudy(local.books[0], { ...studySession(local.books[0]), cursor: 1 });
  const incoming = clone(local); incoming.books[0].entries[0].meaning = '来自旧设备'; incoming.books[0].entries[1].status = 'hidden';
  incoming.books[0].entries.push({ ...incoming.books[0].entries[0], word: 'dog' });
  const id = incoming.books[0].id;
  assert.equal(restoreWithChoices(local, incoming, {}).books[0].entries.length, 3);
  const merged = restoreWithChoices(local, incoming, { [id]: 'merge' });
  assert.equal(merged.books[0].entries.length, 4); assert.equal(merged.books[0].entries[0].meaning, '苹果');
  assert.equal(merged.books[0].entries[1].status, 'new'); assert.equal(studySession(merged.books[0]).cursor, 1);
  const replaced = restoreWithChoices(local, incoming, { [id]: 'replace' });
  assert.equal(replaced.books[0].entries[0].meaning, '来自旧设备'); assert.equal(replaced.books[0].entries[1].status, 'hidden');
  local = importBook(local, 'other', 'file:other', [{ word: 'other' }]);
  assert.equal(restoreWithChoices(local, incoming, { [id]: 'replace' }).books.length, 2);
  assert.throws(() => restoreWithChoices(local, incoming, { [id]: 'unknown' }));
});
test('播放设置校验和导出时间向后兼容', () => {
  const state = create(); state.exportedAt = '2026-10-26T00:00:00Z'; state.settings = { repeat: 20, rate: -10, interval: 99, autoPronounce: true };
  const restored = validateBackup(state);
  assert.equal(restored.settings.repeat, 3); assert.equal(restored.settings.rate, 0.5); assert.equal(restored.settings.interval, 15);
  assert.equal(restored.settings.autoPronounce, true); assert.equal(restored.exportedAt, state.exportedAt);
  assert.equal(validateBackup({ ...state, settings: undefined }).settings.repeat, 1);
});
test('连播等真实发音完成再重复，暂停会废弃等待中的任务', async () => {
  const calls = [], gates = []; let stops = 0;
  const player = createPlayer({ speak: word => { calls.push(word); return new Promise(resolve => gates.push(resolve)); }, stopSpeech: () => stops++, wait: async () => {} });
  const pending = player.play('apple', { repeat: 2, interval: 1, rate: 0.8 });
  assert.equal(calls.length, 1); gates.shift()();
  await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls.length, 2);
  player.stop(); gates.shift()(); assert.equal(await pending, false); assert.equal(stops, 1);
  const next = player.play('bee', { repeat: 1, interval: 1 }); gates.shift()(); assert.equal(await next, true);
});
test('本地恢复点每日创建并在破坏性修改前保留，限制两个且不混入导出数据', () => {
  const old = globalThis.uni, store = new Map();
  globalThis.uni = { getStorageSync: k => store.get(k), setStorageSync: (k, v) => store.set(k, v) };
  try {
    const state = create(); saveState(state); assert.equal(recoveryPoints().length, 0);
    const next = clone(state); next.books[0].entries[0].status = 'hidden'; saveState(next);
    assert.equal(JSON.parse(recoveryPoints()[0].raw).books[0].entries[0].status, 'new');
    saveState(state, { checkpoint: true }); saveState(next, { checkpoint: true });
    assert.equal(recoveryPoints().length, 2); assert.equal(lastExport(), ''); recordExport(); assert.ok(lastExport());
    const aged = recoveryPoints(); aged[0].at = new Date(Date.now() - 2 * 86400000).toISOString();
    store.set('wordbook.recovery.v1', JSON.stringify(aged)); saveState(state);
    assert.equal(recoveryPoints()[0].reason, '每日');
    saveState(next);
    assert.equal(loadState().books[0].entries[0].status, 'hidden'); assert.equal(JSON.stringify(loadState()).includes('recovery'), false);
  } finally { globalThis.uni = old; }
});
test('恢复点写入失败时不执行破坏性修改；普通保存可提示失败继续', () => {
  const old = globalThis.uni, state = create(), store = new Map([['wordbook.v1', JSON.stringify(state)]]);
  globalThis.uni = { getStorageSync: k => store.get(k), setStorageSync: (k, v) => { if (k.includes('recovery')) throw Error('quota'); store.set(k, v); } };
  try {
    const next = { ...state, books: [] };
    assert.throws(() => saveState(next, { checkpoint: true }), /无法创建/);
    assert.equal(loadState().books.length, 1);
    assert.match(saveState(state), /自动恢复点/);
  } finally { globalThis.uni = old; }
});
test('空间只容纳一个恢复点时可自动淘汰旧点，继续安全编辑', () => {
  const old = globalThis.uni, state = create(), store = new Map([['wordbook.v1', JSON.stringify(state)]]);
  globalThis.uni = { getStorageSync: k => store.get(k), setStorageSync: (k, value) => {
    if (k.includes('recovery') && JSON.parse(value).length > 1) throw Error('quota');
    store.set(k, value);
  } };
  try {
    saveState(state, { checkpoint: true });
    const next = clone(state); next.books[0].name = 'updated'; saveState(next, { checkpoint: true });
    assert.equal(recoveryPoints().length, 1); assert.equal(JSON.parse(recoveryPoints()[0].raw).books[0].name, 'book');
    assert.equal(loadState().books[0].name, 'updated');
  } finally { globalThis.uni = old; }
});

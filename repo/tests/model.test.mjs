import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, importBook, copyBook, makeQueue, mergeBackup, validateBackup } from '../src/core/model.mjs';
import { rowsToEntries, textToEntries, reviewEntries } from '../src/core/parse.mjs';
const entries = [ { word: 'zebra', meaning: '斑马' }, { word: 'apple', meaning: '苹果' } ];
test('同文件覆盖更新，保留重命名、id 和隐藏状态，移除未选词', () => {
  let state = importBook(emptyState(), 'book', 'file:a.xlsx', entries);
  const book = state.books[0]; book.name = '我的书'; book.entries[0].status = 'hidden';
  const oldId = book.entries[0].id;
  state = importBook(state, 'a', 'file:a.xlsx', [{ word: 'Zebra', meaning: '新释义' }, { word: 'bird', meaning: '鸟' }]);
  assert.equal(state.books.length, 1); assert.equal(state.books[0].name, '我的书');
  assert.equal(state.books[0].entries[0].status, 'hidden'); assert.equal(state.books[0].entries[0].id, oldId);
  assert.equal(state.books[0].entries[0].meaning, '新释义'); assert.equal(state.books[0].entries[1].status, 'new');
  assert.equal(state.books[0].entries.some(e => e.word === 'apple'), false);
});
test('复制单词本独立于原本更新与状态', () => {
  let state = importBook(emptyState(), 'book', 'file:a.xlsx', entries);
  state = copyBook(state, state.books[0].id);
  assert.notEqual(state.books[0].entries[0].id, state.books[1].entries[0].id);
  state.books[1].entries[0].status = 'hidden'; assert.equal(state.books[0].entries[0].status, 'new');
  state = importBook(state, 'book', 'file:a.xlsx', [{ word: 'new', meaning: '新' }]);
  assert.equal(state.books[1].entries.length, 2);
});
test('字母排序、乱序均排除隐藏词且不丢词不重复', () => {
  const state = importBook(emptyState(), 'book', 'file:a', [...entries, { word: 'bee', meaning: '蜜蜂' }]);
  const book = state.books[0]; book.entries[0].status = 'hidden';
  assert.deepEqual(makeQueue(book).map(e => e.word), ['apple', 'bee']);
  const random = makeQueue(book, 'random', () => 0);
  assert.deepEqual(random.map(e => e.word), ['bee', 'apple']); assert.equal(book.entries[0].word, 'zebra');
});
test('备份往返保留隐藏状态与设置；合并备份不误删其他书', () => {
  let source = importBook(emptyState(), 'one', 'file:one', entries); source.books[0].entries[0].status = 'hidden'; source.settings.theme = 'dark';
  const restored = validateBackup(JSON.parse(JSON.stringify(source)));
  assert.equal(restored.books[0].entries[0].status, 'hidden'); assert.equal(restored.settings.theme, 'dark');
  const target = importBook(emptyState(), 'two', 'file:two', entries);
  assert.equal(mergeBackup(target, restored).books.length, 2);
  assert.equal(mergeBackup(source, restored).books.length, 1);
});
test('拒绝损坏备份与重复词，而非静默丢数据', () => {
  assert.throws(() => validateBackup({ version: 9, books: [] }));
  const state = importBook(emptyState(), 'book', 'file:a', entries);
  state.books[0].entries.push({ ...state.books[0].entries[0] });
  assert.throws(() => validateBackup(state), /重复/);
});
test('识别中英文乱序表头、无表头四列、多余空行', () => {
  assert.deepEqual(rowsToEntries([['释义', '单词', '例句', '音标'], ['苹果', 'apple', 'An apple.', '/a/'], []], 'Sheet1').map(({ location: _location, ...e }) => e), [{ word: 'apple', phonetic: '/a/', meaning: '苹果', example: 'An apple.' }]);
  assert.equal(rowsToEntries([['bee', '/biː/', '蜜蜂', 'A bee.']])[0].meaning, '蜜蜂');
});
test('PDF 文本行与脏数据检测', () => {
  const parsed = textToEntries('apple /ˈæpl/ 苹果\nbee  /biː/  蜜蜂  A bee.\nPage 1\napple 苹果');
  assert.equal(parsed[0].word, 'apple'); assert.equal(parsed[0].phonetic, '/ˈæpl/');
  assert.equal(parsed[1].example, 'A bee.');
  const reviewed = reviewEntries(parsed);
  assert.equal(reviewed[0].selected, true); assert.match(reviewed[3].warning, /重复/);
});
test('真实来源格式：中文释义和独立词性列；PDF 词组与词根注释', () => {
  assert.equal(rowsToEntries([['单词','音标','词性','中文释义','考试频率'],['abacus','/a/','n.','算盘','1']])[0].meaning, 'n. 算盘');
  const parsed = textToEntries('a range of 一系列\npremium n. 保险金\nabstract (ab-去掉)a.抽象的');
  assert.deepEqual(parsed.map(e => e.word), ['a range of','premium','abstract']);
});
test('导入去除空单词与大小写重复，零有效词条不修改状态', () => {
  const state = emptyState();
  assert.throws(() => importBook(state, 'book', 'file:a', [{ word: '' }])); assert.equal(state.books.length, 0);
  assert.equal(importBook(state, 'book', 'file:a', [{ word: 'Apple' }, { word: ' apple ' }]).books[0].entries.length, 1);
});

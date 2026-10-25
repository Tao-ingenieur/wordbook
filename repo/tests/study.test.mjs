import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, importBook, copyBook, validateBackup, mergeBackup, studySession, rememberStudy, reconcileStudy } from '../src/core/model.mjs';

const words = ['apple', 'bee', 'cat', 'dog'];
const create = () => importBook(emptyState(), 'one', 'file:one', words.map(word => ({ word }))).books[0];
const current = session => session.queue[session.cursor];
function advance(book, mode, cursor) {
  return rememberStudy(book, { ...studySession(book, mode, { random: () => 0 }), cursor });
}
function roundtrip(book) { return validateBackup(JSON.parse(JSON.stringify({ ...emptyState(), books: [book] }))).books[0]; }

test('旧备份默认从字母顺序开始，隐藏词不进入队列', () => {
  const book = create(); delete book.study; book.entries[0].status = 'hidden';
  assert.deepEqual(studySession(roundtrip(book)), { mode: 'alpha', queue: ['bee', 'cat', 'dog'], cursor: 0 });
});

test('字母顺序续背不依赖重新生成的词条 id', () => {
  const book = advance(create(), 'alpha', 2), restored = roundtrip(book);
  assert.notEqual(book.entries[0].id, restored.entries[0].id);
  assert.equal(current(studySession(restored)), 'cat');
});

test('乱序队列和位置跨重启保留，完整队列不重新随机', () => {
  const book = advance(create(), 'random', 2);
  const before = studySession(book);
  assert.deepEqual(studySession(roundtrip(book), 'random', { random: () => { throw Error('不应洗牌'); } }), before);
});

test('每本两套进度互不覆盖，三本共用一个 JSON 往返后仍是三本', () => {
  let state = emptyState();
  for (let i = 0; i < 3; i++) state = importBook(state, `book${i}`, `file:${i}`, words.map(word => ({ word })));
  state.books = state.books.map((book, i) => advance(advance(book, 'alpha', i), 'random', i + 1));
  state.books[0].entries[0].status = 'hidden'; state.books[0] = reconcileStudy(state.books[0]);
  const restored = mergeBackup(emptyState(), JSON.parse(JSON.stringify(state)));
  assert.equal(restored.books.length, 3);
  for (let i = 0; i < 3; i++) {
    for (const mode of ['alpha', 'random']) assert.deepEqual(studySession(restored.books[i], mode), studySession(state.books[i], mode));
    assert.equal(restored.books[i].study.mode, 'random');
  }
  assert.equal(restored.books[0].entries[0].status, 'hidden');
});

test('隐藏当前词转到队列下一词，恢复词追加且不重排已有乱序', () => {
  let book = advance(create(), 'random', 1);
  assert.deepEqual(studySession(book).queue, ['bee', 'cat', 'dog', 'apple']);
  book.entries.find(e => e.word === 'cat').status = 'hidden'; book = reconcileStudy(book);
  assert.equal(current(studySession(book)), 'dog');
  book.entries.find(e => e.word === 'cat').status = 'new'; book = reconcileStudy(book);
  assert.deepEqual(studySession(book).queue, ['bee', 'dog', 'apple', 'cat']);
  assert.equal(current(studySession(book)), 'dog');
});

test('覆盖更新保留进度，移除当前词时选择后继，新词追加到乱序队尾', () => {
  let book = advance(advance(create(), 'alpha', 1), 'random', 1);
  const state = importBook({ ...emptyState(), books: [book] }, 'changed', 'file:one', ['Apple', 'bee', 'dog', 'fox'].map(word => ({ word })));
  book = state.books[0];
  assert.equal(current(studySession(book, 'alpha')), 'bee');
  assert.deepEqual(studySession(book, 'random').queue, ['bee', 'dog', 'apple', 'fox']);
  assert.equal(current(studySession(book, 'random')), 'dog');
});

test('字母顺序移除当前词后选后继，全部隐藏与恢复均可继续', () => {
  let book = advance(create(), 'alpha', 1);
  book.entries[1].status = 'hidden'; book = reconcileStudy(book);
  assert.equal(current(studySession(book)), 'cat');
  book.entries.forEach(e => e.status = 'hidden'); book = reconcileStudy(book);
  assert.deepEqual(studySession(book).queue, []); assert.equal(studySession(book).cursor, 0);
  book.entries[3].status = 'new'; book = reconcileStudy(book);
  assert.equal(current(studySession(book)), 'dog');
});

test('重新开始只重置当前排序，复制本的进度数组独立', () => {
  const book = advance(advance(create(), 'alpha', 2), 'random', 2);
  const reset = rememberStudy(book, studySession(book, 'random', { restart: true, random: () => 0.99 }));
  assert.deepEqual(studySession(reset).queue, words); assert.equal(studySession(reset).cursor, 0);
  assert.equal(current(studySession(reset, 'alpha')), 'cat');
  assert.equal(studySession(book).cursor, 2);
  const copy = copyBook({ ...emptyState(), books: [book] }, book.id).books[1];
  assert.deepEqual(copy.study, book.study); assert.notEqual(copy.study.random.queue, book.study.random.queue);
  copy.study.random.queue.reverse(); assert.notDeepEqual(copy.study.random.queue, book.study.random.queue);
});

test('损坏的可选进度安全修复，删除重复/无效队列项且不修改输入', () => {
  const book = create(); book.study = { mode: 'random', alpha: false, random: { queue: ['BEE', 'bee', null, 'ghost', 'cat'], current: 'ghost' } };
  const before = JSON.stringify(book);
  const repaired = roundtrip(book), session = studySession(repaired);
  assert.equal(new Set(session.queue).size, 4); assert.equal(current(session), 'cat');
  assert.equal(JSON.stringify(book), before);
});

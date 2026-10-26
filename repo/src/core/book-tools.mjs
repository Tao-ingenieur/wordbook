import { keyOf, reconcileStudy, validateBackup, studySession, reopenStudy } from './model.mjs';

export function editEntry(book, id, fields) {
  const old = id ? book.entries.find(e => e.id === id) : null;
  if (id && !old) throw Error('词条已不存在');
  const word = String(fields.word || '').trim();
  if (!word) throw Error('单词不能为空');
  if (book.entries.some(e => e.id !== id && keyOf(e.word) === keyOf(word))) throw Error('此单词已存在，请修改原词条');
  const entry = { id: old?.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, word,
    phonetic: String(fields.phonetic || '').trim(), meaning: String(fields.meaning || '').trim(), example: String(fields.example || '').trim(), status: old?.status || 'new' };
  let study = book.study;
  if (!old && study) {
    study = JSON.parse(JSON.stringify(study));
    for (const mode of ['alpha', 'random']) if (study[mode]) delete study[mode].completed;
  }
  if (old && keyOf(old.word) !== keyOf(word)) {
    study = JSON.parse(JSON.stringify(study || {}));
    for (const mode of ['alpha', 'random']) if (study[mode]) {
      if (study[mode].current === keyOf(old.word)) study[mode].current = keyOf(word);
      if (study[mode].queue) study[mode].queue = study[mode].queue.map(k => k === keyOf(old.word) ? keyOf(word) : k);
    }
  }
  return reconcileStudy({ ...book, study, entries: old ? book.entries.map(e => e.id === id ? entry : e) : [...book.entries, entry], updatedAt: new Date().toISOString() });
}
export function deleteEntry(book, id) {
  if (!book.entries.some(e => e.id === id)) throw Error('词条已不存在');
  return reconcileStudy({ ...book, entries: book.entries.filter(e => e.id !== id), updatedAt: new Date().toISOString() });
}
export function searchEntries(book, query = '', status = 'all') {
  const q = keyOf(query);
  return book.entries.filter(e => (status === 'all' || e.status === status) && (!q || keyOf(e.word).includes(q) || keyOf(e.meaning).includes(q)))
    .slice().sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
}
export function stepSession(session, delta) {
  if (!session.queue.length) return { ...session, cursor: 0, completed: false };
  if (delta > 0 && session.cursor >= session.queue.length - 1) return { ...session, completed: true };
  return { ...session, cursor: Math.max(0, Math.min(session.queue.length - 1, session.cursor + delta)), completed: false };
}

const sameEntry = (a, b) => ['word', 'phonetic', 'meaning', 'example'].every(k => a[k] === b[k]);
export function backupDiff(current, backup) {
  const incoming = validateBackup(backup);
  return incoming.books.map(book => {
    const local = current.books.find(b => b.id === book.id || b.sourceKey === book.sourceKey);
    if (!local) return { book, local: null, added: book.entries.length, removed: 0, changed: 0, statusChanged: 0, progressChanged: false };
    const before = new Map(local.entries.map(e => [keyOf(e.word), e]));
    const after = new Set(book.entries.map(e => keyOf(e.word)));
    return { book, local, added: book.entries.filter(e => !before.has(keyOf(e.word))).length,
      removed: local.entries.filter(e => !after.has(keyOf(e.word))).length,
      changed: book.entries.filter(e => before.has(keyOf(e.word)) && !sameEntry(before.get(keyOf(e.word)), e)).length,
      statusChanged: book.entries.filter(e => before.has(keyOf(e.word)) && before.get(keyOf(e.word)).status !== e.status).length,
      progressChanged: ['alpha', 'random'].some(mode => JSON.stringify(studySession(local, mode, { random: () => 0 })) !== JSON.stringify(studySession(book, mode, { random: () => 0 })))
    };
  });
}
export function restoreWithChoices(current, backup, choices) {
  const books = current.books.slice();
  for (const row of backupDiff(current, backup)) {
    const mode = choices[row.book.id] || (row.local ? 'keep' : 'replace');
    if (mode === 'keep') continue;
    if (!['replace', 'merge'].includes(mode)) throw Error('请选择有效的恢复方式');
    if (!row.local) books.push(row.book);
    else {
      const index = books.findIndex(b => b.id === row.local.id);
      if (mode === 'replace') books[index] = { ...row.book, id: row.local.id, sourceKey: row.local.sourceKey };
      else {
        const keys = new Set(row.local.entries.map(e => keyOf(e.word)));
        const added = row.book.entries.filter(e => !keys.has(keyOf(e.word)));
        books[index] = reconcileStudy({ ...(added.length ? reopenStudy(row.local) : row.local), entries: [...row.local.entries, ...added], updatedAt: new Date().toISOString() });
      }
    }
  }
  return validateBackup({ ...current, books });
}

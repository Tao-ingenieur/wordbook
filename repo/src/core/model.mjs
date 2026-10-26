export const keyOf = word => String(word ?? '').normalize('NFKC').trim().toLocaleLowerCase('en');
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const defaultSettings = () => ({ theme: 'light', fontSize: 18, autoPronounce: false, repeat: 1, interval: 3, rate: 0.85 });
export const emptyState = () => ({ version: 1, books: [], settings: defaultSettings() });
function cleanEntry(raw) {
  const word = String(raw.word ?? '').trim();
  return { id: uid(), word, phonetic: String(raw.phonetic ?? '').trim(), meaning: String(raw.meaning ?? '').trim(), example: String(raw.example ?? '').trim(), status: raw.status === 'hidden' ? 'hidden' : 'new' };
}
export function importBook(state, name, sourceKey, entries) {
  if (!name.trim()) throw Error('请输入单词本名称');
  const old = state.books.find(b => b.sourceKey === sourceKey);
  const previous = new Map((old?.entries || []).map(e => [keyOf(e.word), e]));
  const seen = new Set();
  const clean = entries.map(cleanEntry).filter(e => e.word && !seen.has(keyOf(e.word)) && seen.add(keyOf(e.word)));
  if (!clean.length) throw Error('没有可导入的有效词条');
  for (const entry of clean) {
    const before = previous.get(keyOf(entry.word));
    if (before) { entry.id = before.id; entry.status = before.status; }
  }
  let book = { id: old?.id || uid(), name: old?.name || name.trim(), sourceKey, entries: clean, updatedAt: new Date().toISOString(), study: old?.study };
  if (clean.some(e => !previous.has(keyOf(e.word)))) book = reopenStudy(book);
  book = reconcileStudy(book);
  const books = old ? state.books.map(b => b.id === old.id ? book : b) : [...state.books, book];
  return { ...state, books };
}
export function copyBook(state, id) {
  const source = state.books.find(b => b.id === id);
  if (!source) throw Error('单词本不存在');
  const book = reconcileStudy({ ...source, id: uid(), sourceKey: `copy:${uid()}`, name: `${source.name} · 副本`, updatedAt: new Date().toISOString(), entries: source.entries.map(e => ({ ...e, id: uid() })) });
  return { ...state, books: [...state.books, book] };
}
export function makeQueue(book, mode = 'alpha', random = Math.random) {
  const entries = book.entries.filter(e => e.status !== 'hidden').slice();
  if (mode === 'alpha') return entries.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
  for (let i = entries.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]]; }
  return entries;
}

// Persist word keys: backup validation rebuilds entry ids, and source imports may change spelling case.
function repairSession(book, mode, saved, random = Math.random) {
  const active = book.entries.filter(e => e.status !== 'hidden');
  const available = new Set(active.map(e => keyOf(e.word)));
  const current = typeof saved.current === 'string' ? keyOf(saved.current) : null;
  if (mode === 'alpha') {
    const queue = makeQueue(book).map(e => keyOf(e.word));
    const next = available.has(current) ? current : queue.find(key => current && key.localeCompare(current, 'en', { sensitivity: 'base' }) > 0);
    return { queue, current: next || queue[0] || null };
  }
  const seen = new Set();
  const previous = (Array.isArray(saved.queue) ? saved.queue : []).filter(key => typeof key === 'string').map(keyOf).filter(key => key && !seen.has(key) && seen.add(key));
  const queue = previous.filter(key => available.has(key));
  // Append restored/new words without reshuffling the saved part of the round.
  const missing = active.filter(entry => !seen.has(keyOf(entry.word)));
  queue.push(...makeQueue({ entries: missing }, 'random', random).map(e => keyOf(e.word)));
  let next = available.has(current) ? current : null;
  const position = previous.indexOf(current);
  if (!next && position >= 0) {
    for (let offset = 1; offset <= previous.length; offset++) {
      const candidate = previous[(position + offset) % previous.length];
      if (available.has(candidate)) { next = candidate; break; }
    }
  }
  return { queue, current: next || queue[0] || null };
}

export function reconcileStudy(book) {
  const raw = book.study && typeof book.study === 'object' ? book.study : {};
  const study = { mode: raw.mode === 'random' ? 'random' : 'alpha' };
  for (const mode of ['alpha', 'random']) {
    if (!raw[mode] || typeof raw[mode] !== 'object' || Array.isArray(raw[mode])) continue;
    const session = repairSession(book, mode, raw[mode]);
    study[mode] = { ...(mode === 'alpha' ? { current: session.current } : session), ...(raw[mode].completed === true ? { completed: true } : {}) };
  }
  return { ...book, study };
}
export function reopenStudy(book) {
  const study = { ...book.study };
  for (const mode of ['alpha', 'random']) if (study[mode]) { study[mode] = { ...study[mode] }; delete study[mode].completed; }
  return { ...book, study };
}

export function studySession(book, mode = book.study?.mode, { restart = false, random = Math.random } = {}) {
  mode = mode === 'random' ? 'random' : 'alpha';
  const saved = !restart && book.study?.[mode];
  const session = saved && typeof saved === 'object' && !Array.isArray(saved)
    ? repairSession(book, mode, saved, random)
    : { queue: makeQueue(book, mode, random).map(e => keyOf(e.word)) };
  const cursor = Math.max(0, session.queue.indexOf(session.current));
  return { mode, queue: session.queue, cursor, ...(!restart && saved?.completed === true ? { completed: true } : {}) };
}

export function rememberStudy(book, session) {
  const mode = session.mode === 'random' ? 'random' : 'alpha';
  const repaired = repairSession(book, mode, { queue: session.queue, current: session.queue[session.cursor] || null });
  const study = { ...reconcileStudy(book).study, mode };
  study[mode] = { ...(mode === 'alpha' ? { current: repaired.current } : repaired), ...(session.completed === true ? { completed: true } : {}) };
  return { ...book, study, updatedAt: new Date().toISOString() };
}
export function validateBackup(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.books)) throw Error('不是支持的 v1 单词本文件');
  const ids = new Set(), sources = new Set();
  const books = value.books.map(b => {
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id) || typeof b.name !== 'string' || !b.name.trim() || typeof b.sourceKey !== 'string' || !b.sourceKey || sources.has(b.sourceKey) || !Array.isArray(b.entries)) throw Error('单词本结构无效或标识重复');
    ids.add(b.id); sources.add(b.sourceKey);
    const words = new Set();
    const entries = b.entries.map(e => {
      if (!e || typeof e.word !== 'string' || !e.word.trim() || words.has(keyOf(e.word)) || !['new', 'hidden'].includes(e.status) || ['phonetic', 'meaning', 'example'].some(k => typeof e[k] !== 'string')) throw Error('词条结构、状态无效或单词重复');
      words.add(keyOf(e.word));
      return cleanEntry(e);
    });
    return reconcileStudy({ id: b.id, name: b.name.trim(), sourceKey: b.sourceKey, entries, updatedAt: typeof b.updatedAt === 'string' ? b.updatedAt : new Date().toISOString(), study: b.study });
  });
  const s = value.settings || {};
  return { version: 1, books, ...(typeof value.exportedAt === 'string' ? { exportedAt: value.exportedAt } : {}), settings: {
    theme: s.theme === 'dark' ? 'dark' : 'light', fontSize: Math.max(14, Math.min(28, Number(s.fontSize) || 18)),
    autoPronounce: s.autoPronounce === true, repeat: Math.max(1, Math.min(3, Math.round(Number(s.repeat) || 1))),
    interval: Math.max(1, Math.min(15, Number(s.interval) || 3)), rate: Math.max(0.5, Math.min(1.5, Number(s.rate) || 0.85))
  } };
}
export function mergeBackup(current, backup) {
  const incoming = validateBackup(backup);
  const books = current.books.slice();
  for (const book of incoming.books) {
    const index = books.findIndex(b => b.id === book.id || b.sourceKey === book.sourceKey);
    if (index < 0) books.push(book); else books[index] = { ...book, id: books[index].id };
  }
  return validateBackup({ ...current, books });
}

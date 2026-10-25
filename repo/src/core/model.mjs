export const keyOf = word => String(word ?? '').normalize('NFKC').trim().toLocaleLowerCase('en');
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const emptyState = () => ({ version: 1, books: [], settings: { theme: 'light', fontSize: 18 } });
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
  const book = { id: old?.id || uid(), name: old?.name || name.trim(), sourceKey, entries: clean, updatedAt: new Date().toISOString() };
  const books = old ? state.books.map(b => b.id === old.id ? book : b) : [...state.books, book];
  return { ...state, books };
}
export function copyBook(state, id) {
  const source = state.books.find(b => b.id === id);
  if (!source) throw Error('单词本不存在');
  const book = { ...source, id: uid(), sourceKey: `copy:${uid()}`, name: `${source.name} · 副本`, updatedAt: new Date().toISOString(), entries: source.entries.map(e => ({ ...e, id: uid() })) };
  return { ...state, books: [...state.books, book] };
}
export function makeQueue(book, mode = 'alpha', random = Math.random) {
  const entries = book.entries.filter(e => e.status !== 'hidden').slice();
  if (mode === 'alpha') return entries.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
  for (let i = entries.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]]; }
  return entries;
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
    return { id: b.id, name: b.name.trim(), sourceKey: b.sourceKey, entries, updatedAt: typeof b.updatedAt === 'string' ? b.updatedAt : new Date().toISOString() };
  });
  return { version: 1, books, settings: { theme: value.settings?.theme === 'dark' ? 'dark' : 'light', fontSize: Math.max(14, Math.min(28, Number(value.settings?.fontSize) || 18)) } };
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

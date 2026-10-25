import { keyOf } from './model.mjs';
const aliases = {
  word: ['word', '单词', '词汇', '词条', '英文', 'vocabulary', 'term'],
  phonetic: ['phonetic', '音标', '发音', 'ipa', 'pronunciation'],
  meaning: ['meaning', '释义', '中文释义', '中文解释', '中文', '解释', 'translation', 'definition', '含义'],
  example: ['example', '例句', '例句翻译', 'sentence', 'examples']
};
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[\s_：:]/g, '');
export function rowsToEntries(rows, sheet = '') {
  const headerIndex = rows.findIndex(row => row.some(v => aliases.word.includes(normalize(v))));
  let columns = { word: 0, phonetic: 1, meaning: 2, example: 3 };
  let pos = -1;
  if (headerIndex >= 0) {
    columns = Object.fromEntries(Object.entries(aliases).map(([k, names]) => [k, rows[headerIndex].findIndex(v => names.includes(normalize(v)))]));
    pos = rows[headerIndex].findIndex(v => ['词性', 'pos', 'partofspeech'].includes(normalize(v)));
  }
  return rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0).filter(row => row.some(v => String(v ?? '').trim())).map((row, i) => ({
    word: String(row[columns.word] ?? '').trim(), phonetic: String(row[columns.phonetic] ?? '').trim(),
    meaning: [pos >= 0 ? row[pos] : '', row[columns.meaning]].filter(v => String(v ?? '').trim()).join(' ').trim(), example: String(row[columns.example] ?? '').trim(),
    location: `${sheet ? sheet + ' · ' : ''}第 ${i + (headerIndex >= 0 ? headerIndex + 2 : 1)} 行`
  }));
}
export function textToEntries(text) {
  return text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    const columns = line.trim().split(/\t+|\s{2,}|\s*[|｜]\s*/);
    const location = `第 ${i + 1} 行`;
    if (columns.length >= 3 && /^(\/.*\/|\[.*\])$/.test(columns[1])) return { ...rowsToEntries([columns])[0], location };
    const value = line.trim().replace(/\s+/g, ' ');
    const ipa = value.match(/^([a-zA-Z][a-zA-Z\s'’.-]*?)\s+(\/[^/]+\/|\[[^\]]+\])\s*(.*)$/);
    if (ipa) return { word: ipa[1].trim(), phonetic: ipa[2], meaning: ipa[3], example: '', location };
    let boundary = value.search(/\s+(?:n|v|adj|adv|a|vt|vi|prep|pron|conj|interj|num)\./i);
    const chinese = value.search(/[\u3400-\u9fff]/);
    const paren = value.search(/[（(]/);
    for (const index of [chinese, paren]) if (index > 0 && (boundary < 0 || index < boundary)) boundary = index;
    if (boundary > 0) return { word: value.slice(0, boundary).trim(), phonetic: '', meaning: value.slice(boundary).trim(), example: '', location };
    const match = value.match(/^([a-zA-Z][a-zA-Z'’.-]*)\s+(.+)$/);
    return { word: match?.[1] || value, phonetic: '', meaning: match?.[2] || '', example: '', location };
  });
}
export function reviewEntries(entries) {
  const seen = new Set();
  return entries.map((entry, i) => {
    const reasons = [];
    if (!/^[a-zA-Z][a-zA-Z\s'’().-]*$/.test(entry.word) || entry.word.length > 100) reasons.push('请检查单词');
    if (!entry.meaning) reasons.push('缺少释义');
    if (/^(?:page|页码)\s*\d*$/i.test(entry.word) || /^\d+$/.test(entry.meaning || '')) reasons.push('疑似页码或页眉');
    if (seen.has(keyOf(entry.word))) reasons.push('重复词条');
    seen.add(keyOf(entry.word));
    return { ...entry, reviewId: i, selected: reasons.length === 0, warning: reasons.join('；') };
  });
}

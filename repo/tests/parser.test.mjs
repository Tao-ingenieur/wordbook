import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseFile } from '../src/core/node-parser.mjs';
import { pdfLines } from '../src/core/pdf-lines.mjs';

test('真实 Excel 多工作表解析，保持一个文件一个单词本', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wordbook-test-'));
  try {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['单词', '音标', '释义', '例句'], ['apple', '/a/', '苹果', 'An apple.']]), '水果');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['meaning', 'word'], ['蜜蜂', 'bee']]), '动物');
    const file = path.join(dir, 'My Book.xlsx');
    await fs.writeFile(file, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
    const result = await parseFile(file);
    assert.equal(result.name, 'My Book'); assert.equal(result.sourceKey, 'file:my book.xlsx');
    assert.deepEqual(result.entries.map(e => e.word), ['apple', 'bee']); assert.equal(result.entries[1].meaning, '蜜蜂');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

function pdfDocument(text) {
  const stream = `BT /F1 14 Tf 60 760 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let body = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return body;
}

test('真实文本 PDF 读取文本层，空白 PDF 明确报错', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wordbook-pdf-'));
  try {
    const file = path.join(dir, 'words.pdf');
    await fs.writeFile(file, pdfDocument('apple /a/ fruit'));
    const result = await parseFile(file);
    assert.equal(result.entries[0].word, 'apple'); assert.equal(result.entries[0].meaning, 'fruit');
    await fs.writeFile(file, pdfDocument(''));
    await assert.rejects(() => parseFile(file), /没有文本层/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('PDF 行按坐标顺序还原，明显列间隙保留为分隔符', () => {
  const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width });
  assert.deepEqual(pdfLines([item('fruit', 100, 700, 20), item('apple', 10, 700, 30), item('bee', 10, 680, 20)]), ['apple  fruit', 'bee']);
});
test('双栏讲义先左栏后右栏，避免同一高度的两词被合并', () => {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({ str: 'apple n.', transform: [1,0,0,1,18,700-i*15], width: 40 }, { str: '苹果', transform: [1,0,0,1,65,700-i*15], width: 20 });
    items.push({ str: 'bee n.', transform: [1,0,0,1,298,700-i*15], width: 40 }, { str: '蜜蜂', transform: [1,0,0,1,530,700-i*15], width: 20 });
  }
  const lines = pdfLines(items); assert.equal(lines.length, 24);
  assert.match(lines[0], /^apple/); assert.match(lines[12], /^bee/); assert.doesNotMatch(lines[0], /bee/);
});

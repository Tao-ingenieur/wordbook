import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { rowsToEntries, textToEntries } from './parse.mjs';
import { pdfLines } from './pdf-lines.mjs';
export { pdfLines } from './pdf-lines.mjs';
export async function parseFile(file) {
  const bytes = new Uint8Array(await fs.readFile(file));
  const ext = path.extname(file).toLowerCase();
  let entries;
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    const workbook = XLSX.read(bytes, { type: 'array' });
    entries = workbook.SheetNames.flatMap(name => rowsToEntries(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false }), name));
  } else if (ext === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
    try {
      const lines = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const content = await (await pdf.getPage(n)).getTextContent();
        lines.push(...pdfLines(content.items));
      }
      if (!lines.join('').trim()) throw Error('PDF 没有文本层，请先 OCR 后重新导入');
      entries = textToEntries(lines.join('\n'));
    } finally { await pdf.destroy(); }
  } else throw Error('仅支持 Excel、CSV、PDF');
  return { name: path.basename(file, ext), sourceKey: `file:${path.basename(file).toLowerCase()}`, entries };
}

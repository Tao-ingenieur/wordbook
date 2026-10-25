import fs from 'node:fs/promises';
import path from 'node:path';
import { excelToEntries } from './excel.mjs';
import { pdfToEntries } from './pdf-lines.mjs';
export async function parseFile(file) {
  const bytes = new Uint8Array(await fs.readFile(file));
  const ext = path.extname(file).toLowerCase();
  let entries;
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    entries = excelToEntries(bytes);
  } else if (ext === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
    entries = await pdfToEntries(pdf);
  } else throw Error('仅支持 Excel、CSV、PDF');
  return { name: path.basename(file, ext), sourceKey: `file:${path.basename(file).toLowerCase()}`, entries };
}

import * as XLSX from 'xlsx';
import { rowsToEntries } from './parse.mjs';

export function excelToEntries(bytes) {
  const workbook = XLSX.read(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { type: 'array' });
  return workbook.SheetNames.flatMap(name => rowsToEntries(
    XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false }), name
  ));
}

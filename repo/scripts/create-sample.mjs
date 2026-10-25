import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/input/导入示例.xlsx');
try { await fs.access(target); console.log('示例已存在，不覆盖'); }
catch {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['单词', '音标', '释义', '例句'],
    ['apple', '/ˈæpl/', 'n. 苹果', 'An apple a day.'],
    ['bloom', '/bluːm/', 'v. 开花；蓬勃发展', 'Flowers bloom in spring.'],
    ['curiosity', '/ˌkjʊriˈɑːsəti/', 'n. 好奇心', 'Curiosity leads to discovery.'],
    ['apple', '', '重复示例，预览默认排除', ''],
    ['page 12', '', '', '疑似脏数据'],
  ]), '词汇');
  await fs.writeFile(target, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  console.log(target);
}

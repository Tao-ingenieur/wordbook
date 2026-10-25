import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile } from '../src/core/node-parser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
await fs.mkdir(path.join(root, 'input'), { recursive: true });
await fs.mkdir(path.join(root, 'previews'), { recursive: true });
let failed = false;
for (const name of await fs.readdir(path.join(root, 'input'))) {
  if (!/\.(xlsx?|csv|pdf)$/i.test(name)) continue;
  try {
    const result = await parseFile(path.join(root, 'input', name));
    await fs.writeFile(path.join(root, 'previews', `${name}.preview.json`), JSON.stringify({ format: 'wordbook-preview', version: 1, ...result }, null, 2));
    console.log(`${name}: ${result.entries.length} 条，预览文件已生成`);
  } catch (error) { failed = true; console.error(`${name}: ${error.message}`); }
}
if (failed) process.exitCode = 1;

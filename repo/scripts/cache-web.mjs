import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/web');
async function list(dir, prefix = '.') {
  const files = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.name === 'sw.js') continue;
    if (item.isDirectory()) files.push(...await list(path.join(dir, item.name), `${prefix}/${item.name}`));
    else files.push(`${prefix}/${item.name}`);
  }
  return files;
}
const files = (await list(root)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await fs.readFile(path.resolve(root, file)));
const cache = hash.digest('hex').slice(0, 16);
await fs.writeFile(path.join(root, 'sw.js'), `const PREFIX='wordbook:'+self.registration.scope+':';const CACHE=PREFIX+${JSON.stringify(cache)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
   const cached=await cache.match(event.request); if(cached)return cached;
   try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
 }));
});\n`);
console.log('Web 离线缓存已生成：' + cache);

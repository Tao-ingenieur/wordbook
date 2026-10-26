import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(repo, '../dist');
async function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  if (status !== 0) throw Error(`${command} failed (${status})`);
}
await run(process.execPath, ['scripts/uni.mjs', 'h5'], repo);
const assets = path.join(dist, '.cache/android-assets');
if (path.dirname(assets) !== path.join(dist, '.cache')) throw Error('Unexpected assets path');
await fs.rm(assets, { recursive: true, force: true });
await fs.cp(path.join(dist, 'web'), path.join(assets, 'www'), { recursive: true, filter: source => path.basename(source) !== 'sw.js' });
const project = path.join(repo, 'platforms/android');
if (process.platform === 'win32') await run('cmd.exe', ['/d', '/c', 'gradlew.bat', '--no-daemon', 'assembleDebug'], project);
else await run('sh', ['gradlew', '--no-daemon', 'assembleDebug'], project);
const output = path.join(dist, 'android');
await fs.mkdir(output, { recursive: true });
const apk = path.join(output, 'Wordbook-debug.apk');
await fs.copyFile(path.join(dist, '.cache/android/app/outputs/apk/debug/app-debug.apk'), apk);
const hash = createHash('sha256').update(await fs.readFile(apk)).digest('hex');
await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), `${hash}  Wordbook-debug.apk\n`);
await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify({
  sourceCommit: process.env.GITHUB_SHA || null, buildRun: process.env.GITHUB_RUN_ID || null,
  package: 'com.wordbook.app', version: '0.1.0', signing: 'debug', sha256: hash,
  builtAt: new Date().toISOString()
}, null, 2));
console.log(`Android debug APK: ${apk}\nSHA256: ${hash}`);

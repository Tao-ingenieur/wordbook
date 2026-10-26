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
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw Error('Set ANDROID_HOME or ANDROID_SDK_ROOT to verify the APK signature');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
async function certificate(file) {
  const child = spawn(java, ['-jar', path.join(sdk, 'build-tools/35.0.0/lib/apksigner.jar'), 'verify', '--print-certs', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = ''; child.stdout.on('data', data => { out += data; }); child.stderr.on('data', data => { err += data; });
  const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  const digest = out.match(/Signer #1 certificate SHA-256 digest: ([0-9a-f]+)/i)?.[1];
  if (status !== 0 || !digest) throw Error('APK signature verification failed: ' + err);
  return digest.toLowerCase();
}
const signer = await certificate(apk);
const baseline = path.join(dist, '.cache/android-baseline/Wordbook-debug.apk');
try {
  await fs.access(baseline);
  const previous = JSON.parse(await fs.readFile(path.join(path.dirname(baseline), 'build-info.json'), 'utf8'));
  if (previous.package === 'com.wordbook.offline' && signer !== await certificate(baseline)) throw Error('Signing identity differs from the installed APK. Restore the existing signing key; do not uninstall or silently rotate the key.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const upgrade = path.join(dist, '.cache/android-upgrade/Wordbook-debug.apk');
try { await fs.access(upgrade); if (signer !== await certificate(upgrade)) throw Error('Persistent signing key differs from the previous same-package APK'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const hash = createHash('sha256').update(await fs.readFile(apk)).digest('hex');
await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), `${hash}  Wordbook-debug.apk\n`);
await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify({
  sourceCommit: process.env.GITHUB_SHA || null, buildRun: process.env.GITHUB_RUN_ID || null,
  package: 'com.wordbook.offline', version: '0.2.0', signing: 'persistent-debug', signingCertificateSha256: signer, sha256: hash,
  builtAt: new Date().toISOString()
}, null, 2));
console.log(`Android debug APK: ${apk}\nSHA256: ${hash}`);

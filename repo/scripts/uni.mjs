import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2] || 'h5';
if (!['h5', 'mp-weixin', 'app'].includes(platform)) throw Error('无效的构建目标');
const dev = process.argv.includes('--dev');
const folder = { h5: dev ? 'dev-web' : 'web', 'mp-weixin': 'weixin', app: 'app' }[platform];
const dist = path.resolve(repo, '../dist');
const finalOutput = path.join(dist, folder);
// uni-app 会在输出目录旁生成 .nvue；App 先在缓存目录编译再发布资源。
const output = platform === 'app' ? path.join(dist, '.cache/app-build/app') : finalOutput;
if (platform !== 'mp-weixin') {
  const staticDir = path.join(repo, 'src/static');
  await fs.mkdir(staticDir, { recursive: true });
  await fs.copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), path.join(staticDir, 'pdf.worker.min.mjs'));
}
const cli = path.join(path.dirname(require.resolve('@dcloudio/vite-plugin-uni/package.json')), 'bin/uni.js');
const args = dev ? ['-p', platform, '--host', '127.0.0.1'] : ['build', '-p', platform];
const child = spawn(process.execPath, [cli, ...args], { cwd: repo, env: { ...process.env, UNI_OUTPUT_DIR: output }, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
const status = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
if (status !== 0) process.exitCode = status;
else if (platform === 'h5' && !dev) await import('./cache-web.mjs');
else if (platform === 'app') {
  await fs.copyFile(path.join(repo, 'src/Info.plist'), path.join(output, 'Info.plist'));
  if (path.dirname(finalOutput) !== dist || path.basename(finalOutput) !== 'app') throw Error('App 发布路径异常');
  await fs.rm(finalOutput, { recursive: true, force: true });
  await fs.rename(output, finalOutput);
  console.log('App 资源已发布到：' + finalOutput);
}
else if (platform === 'mp-weixin') await fs.rm(path.join(output, 'static/pdf.worker.min.mjs'), { force: true });

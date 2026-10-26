import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(repo, '../dist/.cache/android-baseline');
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw Error('Missing GitHub repository');
const headers = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' };
async function get(url) { const response = await fetch(url, { headers }); if (!response.ok) throw Error(`Baseline download failed: ${response.status}`); return response; }
const base = `https://api.github.com/repos/${repository}`;
const data = await (await get(`${base}/actions/workflows/android.yml/runs?status=success&per_page=10`)).json();
for (const run of data.workflow_runs) {
  const { artifacts } = await (await get(`${base}/actions/runs/${run.id}/artifacts`)).json();
  const artifact = artifacts.find(a => a.name === 'wordbook-android' && !a.expired);
  if (!artifact) continue;
  await fs.mkdir(output, { recursive: true });
  const zip = path.join(output, 'baseline.zip');
  await fs.writeFile(zip, Buffer.from(await (await get(artifact.archive_download_url)).arrayBuffer()));
  execFileSync('unzip', ['-jo', zip, 'Wordbook-debug.apk', 'build-info.json', '-d', output]);
  console.log(`Upgrade baseline downloaded from successful run ${run.id}`);
  process.exit(0);
}
throw Error('No retained successful APK baseline. Restore the previous APK manually before changing signing identity.');

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resolveDesktopPaths } = require('../electron/paths.cjs');
const dist = path.resolve('example workspace/dist');
const sourceDir = path.resolve('example workspace/repo/electron');

test('开发与发布版共享原有 input/data，发布资源位于 desktop 内', () => {
  const dev = resolveDesktopPaths({ packaged: false, sourceDir });
  const packaged = resolveDesktopPaths({ packaged: true, sourceDir, exePath: path.join(dist, 'desktop/Wordbook.exe'), resourcesPath: path.join(dist, 'desktop/resources') });
  assert.equal(dev.dist, dist); assert.equal(dev.desktop, path.join(dist, 'desktop'));
  assert.equal(dev.input, packaged.input); assert.equal(dev.userData, packaged.userData);
  assert.equal(packaged.userData, path.join(dist, 'data'));
  assert.equal(dev.web, path.join(dist, 'web/index.html'));
  assert.equal(packaged.web, path.join(dist, 'desktop/resources/web/index.html'));
  assert.equal(packaged.backups, path.join(dist, 'backups'));
});
test('测试数据与用户资料隔离，移动整套目录后仍按相对路径定位', () => {
  const moved = path.resolve('moved workspace/wordbook');
  const result = resolveDesktopPaths({ packaged: true, exePath: path.join(moved, 'desktop/Wordbook.exe'), resourcesPath: path.join(moved, 'desktop/resources'), smoke: true });
  assert.equal(result.input, path.join(moved, 'input'));
  assert.equal(result.userData, path.join(moved, '.cache/desktop-smoke-data'));
  assert.notEqual(result.userData, path.join(moved, 'data'));
  assert.equal(result.reports, path.join(moved, 'reports/desktop'));
});

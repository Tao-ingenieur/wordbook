process.env.WORDBOOK_SMOKE_TEST = '1';
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { ready, getWindow, paths } = require('../electron/main.cjs');
const output = paths.reports;
const wait = () => new Promise(resolve => setTimeout(resolve, 150));
const checks = [];
async function run() {
  await ready;
  const win = getWindow(), web = win.webContents;
  assert.equal(paths.userData, path.resolve(__dirname, '../../dist/.cache/desktop-smoke-data'));
  const logs = [];
  web.on('console-message', (_event, _level, message) => logs.push(message));
  const text = () => web.executeJavaScript('document.body.innerText');
  async function click(label) {
    for (let i = 0; i < 30; i++) { if ((await text()).includes(label)) break; await wait(); }
    const found = await web.executeJavaScript(`(() => { const button=[...document.querySelectorAll('uni-button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)}));if(!button)return false;button.click();return true;})()`);
    assert.ok(found, '没有找到按钮 ' + label); await wait();
  }
  const files = await web.executeJavaScript('window.wordbookDesktop.listInput()');
  assert.ok(files.includes('导入示例.xlsx')); checks.push('Electron preload 与 dist/input 扫描可用');
  await web.executeJavaScript(`localStorage.clear()`); await web.reload();
  await new Promise(resolve => web.once('did-finish-load', resolve));
  await click('先用示例体验'); await click('开始背诵 →');
  assert.match(await text(), /bloom/);
  await web.executeJavaScript('document.querySelector(".flashcard").click()'); await wait();
  assert.match(await text(), /The cherry trees bloom in spring/); checks.push('卡片翻转显示词义、音标、例句');
  await click('✓ 已记住，隐藏'); assert.match(await text(), /1 \/ 5/); checks.push('隐藏当前单词后轮询减为 5 词');
  await click('隐藏词 1'); await click('恢复为生词'); assert.match(await text(), /还没有隐藏的单词/); checks.push('隐藏词恢复生词');
  await click('＋　导入单词本');
  async function importFixture(name) {
    const bytes = Array.from(await fs.readFile(path.resolve(__dirname, '../../dist/input', name)));
    // 开发测试注入本地 File 对象，避免自动化弹出操作系统选择器。
    await web.executeJavaScript(`(() => { document.querySelector('.import-panel uni-button').click(); const input=document.querySelector('input[type=file]');const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${JSON.stringify(bytes)})],${JSON.stringify(name)}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
    for (let i = 0; i < 100; i++) { await wait(); if ((await text()).includes('检查导入内容')) return; }
    throw Error('文件预览未出现：' + name + '\n' + (await text()).slice(-500));
  }
  await importFixture('导入示例.xlsx');
  assert.match(await text(), /选中 3 条/); checks.push('本地 Excel 文件解析与脏数据默认剔除');
  await click('创建单词本');
  await click('＋　导入单词本');
  await importFixture('俞敏洪托福单词串讲.pdf');
  assert.ok(await web.executeJavaScript(`[...document.querySelectorAll('.preview-fields input')].some(input=>input.value==='a range of')`)); checks.push('file 协议下 PDF Worker 正常解析双栏源文件');
  await web.executeJavaScript('document.querySelector(".modal-heading .icon-btn").click()'); await wait();
  await click('▤　我的单词本');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'desktop-preview.png'), (await web.capturePage()).toPNG());
  await fs.writeFile(path.join(output, 'desktop-smoke.json'), JSON.stringify({ passed: true, checks, logs }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
  app.quit();
}
run().catch(async error => { console.error(error); await fs.mkdir(output, { recursive: true }); const html = await getWindow()?.webContents.executeJavaScript('document.body.innerHTML'); await fs.writeFile(path.join(output, 'desktop-smoke.json'), JSON.stringify({ passed: false, error: error.stack, html }, null, 2)); app.exit(1); });

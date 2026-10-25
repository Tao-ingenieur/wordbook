const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { resolveDesktopPaths } = require('./paths.cjs');
const smoke = process.env.WORDBOOK_SMOKE_TEST === '1';
const paths = resolveDesktopPaths({ packaged: app.isPackaged, exePath: app.getPath('exe'), resourcesPath: process.resourcesPath, sourceDir: __dirname, portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR, smoke });
fsSync.mkdirSync(paths.userData, { recursive: true });
app.setPath('userData', paths.userData);
const input = paths.input;
let win;
const ready = app.whenReady().then(async () => {
  await fs.mkdir(input, { recursive: true });
  win = new BrowserWindow({ width: 1280, height: 860, minWidth: 380, minHeight: 600, show: !smoke, title: '拾词 · Wordbook', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: smoke, backgroundThrottling: !smoke } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  ipcMain.handle('input:list', async () => (await fs.readdir(input, { withFileTypes: true })).filter(e => e.isFile() && /\.(xlsx?|csv|pdf)$/i.test(e.name)).map(e => e.name));
  ipcMain.handle('input:read', async (_event, name) => {
    if (typeof name !== 'string' || path.basename(name) !== name || !/\.(xlsx?|csv|pdf)$/i.test(name)) throw Error('无效的输入文件');
    const file = path.join(input, name);
    if ((await fs.stat(file)).size > 30 * 1024 * 1024) throw Error('文件超过 30 MB，请拆分后导入');
    return Array.from(await fs.readFile(file));
  });
  ipcMain.handle('backup:save', async (_event, name, text) => {
    if (typeof text !== 'string' || text.length > 100 * 1024 * 1024) throw Error('导出数据过大');
    await fs.mkdir(paths.backups, { recursive: true });
    const result = await dialog.showSaveDialog(win, { defaultPath: path.join(paths.backups, path.basename(name)), filters: [{ name: '单词本备份', extensions: ['json'] }] });
    if (!result.canceled) await fs.writeFile(result.filePath, text, 'utf8');
    return !result.canceled;
  });
  await win.loadFile(paths.web);
});
app.on('window-all-closed', () => app.quit());
module.exports = { ready, getWindow: () => win, paths };

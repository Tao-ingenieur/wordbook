import { excelToEntries } from '../core/excel.mjs';
// #ifdef H5
import { parseBrowserPdf } from './browser-pdf.js';
import { saveAndroidBackup } from './android-bridge.js';
// #endif
// #ifdef APP-PLUS
import { saveAndroidDocument } from './android-save.js';
// #endif

export async function readDocument(name, bytes) {
  if (bytes.byteLength > 30 * 1024 * 1024) throw Error('文件超过 30 MB，请拆分后导入');
  if (/\.json$/i.test(name)) return JSON.parse(new TextDecoder().decode(bytes));
  let entries;
  if (/\.(xlsx?|csv)$/i.test(name)) {
    entries = excelToEntries(bytes);
  } else if (/\.pdf$/i.test(name)) {
    // #ifdef H5
    entries = await parseBrowserPdf(bytes);
    // #endif
    // #ifndef H5
    throw Error('此端暂不直接解析 PDF。请在电脑端扫描 dist/input，导出预览 JSON 后在此导入。');
    // #endif
  } else throw Error('请选择 Excel、CSV、PDF 或单词本 JSON 文件');
  return { name: name.replace(/\.[^.]+$/, ''), sourceKey: `file:${name.toLowerCase()}`, entries };
}
// #ifndef APP-PLUS
export function pickFile() {
  // #ifdef H5
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv,.pdf,.json';
    input.style.display = 'none'; document.body.appendChild(input);
    const cleanup = () => { input.remove(); window.removeEventListener('focus', checkCancel); };
    const checkCancel = () => setTimeout(() => { if (!input.files?.length) { cleanup(); resolve(null); } }, 500);
    window.addEventListener('focus', checkCancel, { once: true });
    input.oncancel = () => { cleanup(); resolve(null); };
    input.onchange = async () => { try { const f = input.files?.[0]; resolve(f ? await readDocument(f.name, await f.arrayBuffer()) : null); } catch (e) { reject(e); } finally { cleanup(); } };
    input.click();
  });
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['xlsx', 'xls', 'csv', 'json'], success: async result => {
      try {
        const file = result.tempFiles[0];
        if (/\.json$/i.test(file.name)) resolve(JSON.parse(wx.getFileSystemManager().readFileSync(file.path, 'utf8')));
        else resolve(await readDocument(file.name, wx.getFileSystemManager().readFileSync(file.path)));
      } catch (error) { reject(error); }
    }, fail: error => error.errMsg?.includes('cancel') ? resolve(null) : reject(Error(error.errMsg)) });
  });
  // #endif
}
// #endif
export async function exportFile(name, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  // #ifdef H5
  if (window.wordbookDesktop) return window.wordbookDesktop.saveFile(name, text);
  if (window.WordbookAndroid) return saveAndroidBackup(name, text);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return;
  // #endif
  // #ifdef MP-WEIXIN
  const filePath = `${wx.env.USER_DATA_PATH}/${name}`;
  wx.getFileSystemManager().writeFileSync(filePath, text, 'utf8');
  return new Promise((resolve, reject) => wx.shareFileMessage({ filePath, fileName: name, success: resolve, fail: error => reject(Error(error.errMsg)) }));
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    return saveAndroidDocument(name, text);
  }
  return new Promise((resolve, reject) => plus.io.requestFileSystem(plus.io.PRIVATE_DOC, fs => fs.root.getFile(name, { create: true }, entry => entry.createWriter(writer => {
    writer.onerror = () => reject(Error('导出写入失败'));
    let truncated = false;
    writer.onwrite = () => {
      if (!truncated) { truncated = true; writer.seek(0); writer.write(text); return; }
      uni.showModal({ title: '备份已导出', content: '请到“文件”App → 我的 iPhone → 拾词中查找 ' + name, showCancel: false }); resolve(true);
    };
    writer.truncate(0);
  }, reject), reject), reject));
  // #endif
}
export function desktop() {
  // #ifdef H5
  return window.wordbookDesktop;
  // #endif
  return null;
}

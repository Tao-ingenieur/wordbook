import { pdfToEntries } from '../core/pdf-lines.mjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
export async function parseBrowserPdf(bytes) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./static/pdf.worker.min.mjs', document.baseURI).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false });
  let timer;
  try {
    return await Promise.race([
      task.promise.then(pdfToEntries),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('PDF 解析超时，请拆分文件或更新系统 WebView 后重试')), 120000); })
    ]);
  } catch (error) { task.destroy().catch(() => {}); throw error; }
  finally { clearTimeout(timer); }
}

import { textToEntries } from '../core/parse.mjs';
import { pdfLines } from '../core/pdf-lines.mjs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
export async function parseBrowserPdf(bytes) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./static/pdf.worker.min.mjs', document.baseURI).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false }).promise;
  try {
    const lines = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      lines.push(...pdfLines(content.items));
    }
    if (!lines.join('').trim()) throw Error('PDF 没有文本层，请先 OCR 后重新导入');
    return textToEntries(lines.join('\n'));
  } finally { await pdf.destroy(); }
}

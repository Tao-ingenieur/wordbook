import { pdfToEntries } from '../core/pdf-lines.mjs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
export async function parseBrowserPdf(bytes) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./static/pdf.worker.min.mjs', document.baseURI).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false }).promise;
  return pdfToEntries(pdf);
}

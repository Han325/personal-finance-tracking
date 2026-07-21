import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// `import.meta.env` only exists under Vite's transform (browser build/dev
// server) — in the plain-Node test runner there's no bundler and no worker
// file to serve, so getDocument() below is called with disableWorker there.
const IN_BROWSER = typeof window !== 'undefined';

if (IN_BROWSER) {
  // public/ assets are served relative to Vite's configured base, whatever it
  // is (root '/', a relative './', or a GitHub-Pages-style '/repo-name/' subpath).
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;
}

/**
 * @typedef {{text: string, x0: number, top: number, x1: number, bottom: number}} Word
 */

/**
 * Loads a PDF File/ArrayBuffer and returns its pages, each exposing
 * `.words()` — the pdf.js equivalent of pdfplumber's `page.extract_words()`.
 *
 * Coordinate mapping: pdf.js text item transforms are in PDF space (y
 * increases upward from the bottom-left); pdfplumber's `top` is distance
 * down from the page's top-left. `top = pageHeight - (transform[5] + height)`
 * converts between the two so existing x0/top column-range constants port
 * unchanged.
 *
 * Verified against RHB's statement PDF: bank-statement PDFs emit one text
 * item per table cell (not per glyph-run), so items already correspond to
 * whole fields (dates, amounts, card headers) rather than word fragments —
 * no proportional word-splitting fallback is needed here. Items are sorted
 * by (top, x0) to restore reading order, since pdf.js's raw item order
 * follows content-stream emission order, which is not guaranteed to match
 * visual layout order.
 *
 * @param {File|ArrayBuffer|Uint8Array} input
 * @returns {Promise<{numPages: number, pageHeight(pageNum: number): Promise<number>, words(pageNum: number): Promise<Word[]>}>}
 */
export async function loadPdf(input) {
  const data = input instanceof Uint8Array
    ? input
    : new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer());

  const doc = await pdfjsLib.getDocument(
    IN_BROWSER ? { data } : { data, disableWorker: true, useWorkerFetch: false, isEvalSupported: false }
  ).promise;

  async function pageHeight(pageNum) {
    const page = await doc.getPage(pageNum);
    return page.getViewport({ scale: 1 }).height;
  }

  async function words(pageNum) {
    const page = await doc.getPage(pageNum);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent({ disableCombineTextItems: true });

    const out = [];
    for (const item of content.items) {
      if (!item.str || item.str.trim() === '') continue;
      const x0 = item.transform[4];
      const top = height - (item.transform[5] + item.height);
      out.push({ text: item.str, x0, top, x1: x0 + item.width, bottom: top + item.height });
    }
    out.sort((a, b) => a.top - b.top || a.x0 - b.x0);
    return out;
  }

  return { numPages: doc.numPages, pageHeight, words };
}

import { loadPdf } from '../pdf/pdfWords.js';
import { makeTransaction } from '../categorize.js';

// Column x-coordinate ranges derived from the HLB Pay & Save PDF format
const DATE_X = [25, 82];
const DESC_X = [82, 295];
const DEP_X = [350, 430];
const WD_X = [430, 520];

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const AMOUNT_RE = /^\d[\d,]*\.\d{2}$/;

// Words that begin the statement summary section on the last page — stop
// collecting description text when any line starts with one of these.
const DESC_STOP = new Set(['Balance', 'Pengeluaran', 'Simpanan', 'Notis', 'Penting']);

// pdf.js keeps real space characters inside a single text item (pdfplumber's
// word-merging drops them) — stripping whitespace before classification keeps
// these regexes identical to the pdfplumber-based Python parser's. See
// src/parsers/rhbPdf.js for the empirical basis (no sample HLB PDF exists to
// verify against directly — this parser is ported defensively on the same
// assumption pending a real test file).
function norm(text) {
  return text.replace(/\s+/g, '');
}

function inRange(x, [lo, hi]) {
  return x >= lo && x < hi;
}

function parseAmount(text) {
  return parseFloat(text.replace(/,/g, ''));
}

/**
 * @param {File} file
 * @returns {Promise<import('../categorize.js').Transaction[]>}
 */
export async function parse(file) {
  const pdf = await loadPdf(file);
  const raw = []; // accumulated across all pages

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const words = await pdf.words(pageNum);
    const pageHeight = await pdf.pageHeight(pageNum);

    // pageTxs holds only this page's transactions so header words at the top
    // of the page don't leak into the last transaction from the previous page
    const pageTxs = [];

    for (const w of words) {
      const { x0, top, text } = w;

      // Skip footer content (bottom 8% of page contains HLB's registration text)
      if (top > pageHeight * 0.92) continue;

      const n = norm(text);
      if (inRange(x0, DATE_X) && DATE_RE.test(n)) {
        pageTxs.push({ dateStr: n, desc: [], withdrawal: null, deposit: null });
        continue;
      }

      if (!pageTxs.length) continue;
      const tx = pageTxs[pageTxs.length - 1];

      if (inRange(x0, DESC_X)) {
        tx.desc.push({ top, x0, text });
      } else if (inRange(x0, WD_X) && AMOUNT_RE.test(n) && tx.withdrawal === null) {
        tx.withdrawal = parseAmount(n);
      } else if (inRange(x0, DEP_X) && AMOUNT_RE.test(n) && tx.deposit === null) {
        tx.deposit = parseAmount(n);
      }
    }

    raw.push(...pageTxs);
  }

  const transactions = [];
  for (const tx of raw) {
    if (tx.withdrawal === null) continue; // income / deposit row, skip

    // Build description: group words by line (same top), join lines with " / ".
    // A gap > 20px between lines means we've left the transaction area (e.g. the
    // statement summary section on the last page falls in the same x-range).
    const parts = [...tx.desc].sort((a, b) => a.top - b.top || a.x0 - b.x0);
    const lines = [];
    let curTop = null;
    let curLine = [];
    // Mirrors parsers/hlb.py's loop exactly, including its final flush running
    // unconditionally after the loop (break or not) — ported for parity, not
    // independently re-verified against a real HLB PDF (none is available here).
    for (const { top, text: word } of parts) {
      if (curTop === null || Math.abs(top - curTop) > 3) {
        if (curLine.length) lines.push(curLine.join(' '));
        if (curTop !== null && top - curTop > 20) break;
        if (DESC_STOP.has(word)) break;
        curLine = [word];
        curTop = top;
      } else {
        curLine.push(word);
      }
    }
    if (curLine.length) lines.push(curLine.join(' '));

    const description = lines.join(' / ');

    const [d, m, y] = tx.dateStr.split('/');
    const date = `${y}-${m}-${d}`;

    transactions.push(makeTransaction({
      date,
      description,
      amount: tx.withdrawal,
      currency: 'MYR',
      payment_type: 'DuitNow QR / POS / Bank transfer',
      source_account: 'HLB Pay & Save',
    }));
  }

  return transactions;
}

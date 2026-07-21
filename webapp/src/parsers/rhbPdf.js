import { loadPdf } from '../pdf/pdfWords.js';
import { makeTransaction } from '../categorize.js';

// RHB combined statements list every linked card's transactions one after another,
// each new card's block starting with a header line "<card-number> <HOLDER NAME>"
// (pdf.js keeps the real space between the two; pdfplumber's word-merging drops it —
// see _norm() below, which strips whitespace before classification so both forms
// match the same patterns). We only want the block matching one specific card.
const CARD_HEADER_RE = /^(\d{4}-\d{4}-\d{4}-\d{4})([A-Z].*)$/;
const STATEMENT_DATE_RE = /StatementDate\/TarikhPenyata:(\d{1,2})([A-Za-z]{3})(\d{4})/i;
const ROW_DATE_RE = /^(\d{2})([A-Za-z]{3})$/;
const AMOUNT_RE = /^([\d,]+\.\d{2})(CR)?$/i;

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Column x-coordinate ranges derived from the RHB credit card statement layout
const POSTING_X = [45, 105];
const TXNDATE_X = [130, 200];
const DESC_X = [205, 480];
const AMOUNT_X = [480, 560];

const ROW_TOP_TOLERANCE = 1.0;

// pdf.js emits each statement "cell" as one item, but (unlike pdfplumber, which
// merges adjacent glyphs into words) it keeps real space characters within an
// item's text — e.g. "30 May" instead of "30May", "4258-6083-0721-2184 EUYUHAN"
// instead of "...2184EUYUHAN". Stripping whitespace before classification lets
// every regex below stay identical to the pdfplumber-based Python parser's.
function norm(text) {
  return text.replace(/\s+/g, '');
}

function inRange(x, [lo, hi]) {
  return x >= lo && x < hi;
}

function detectCardNumber(filename) {
  const stem = filename.replace(/\.[^.]+$/, '');
  const m = stem.match(/\d{16}/);
  if (!m) {
    throw new Error(
      `Can't auto-detect the RHB card number from filename ${JSON.stringify(filename)} ` +
      '(expected a 16-digit card number somewhere in the name). Pass a card number explicitly.'
    );
  }
  const d = m[0];
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}`;
}

/**
 * @param {File} file
 * @param {string|null} cardNumber
 * @returns {Promise<import('../categorize.js').Transaction[]>}
 */
export async function parse(file, cardNumber = null) {
  const targetCard = cardNumber || detectCardNumber(file.name);

  const pdf = await loadPdf(file);
  const transactions = [];
  let statementYear = null;
  let statementMonth = null;
  let currentCard = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const words = await pdf.words(pageNum);

    if (statementYear === null) {
      const joined = words.map((w) => norm(w.text)).join('');
      const m = STATEMENT_DATE_RE.exec(joined);
      if (m) {
        statementMonth = MONTHS[m[2].toLowerCase()];
        statementYear = parseInt(m[3], 10);
      }
    }

    // group words into rows by clustering on `top`
    const rows = [];
    for (const w of words) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(w.top - last[0].top) <= ROW_TOP_TOLERANCE) {
        last.push(w);
      } else {
        rows.push([w]);
      }
    }

    for (const row of rows) {
      if (row.length === 1) {
        const header = CARD_HEADER_RE.exec(norm(row[0].text));
        if (header) {
          currentCard = header[1];
          continue;
        }
      }

      if (currentCard !== targetCard) continue;

      let posting = null;
      let txnDate = null;
      let amountWord = null;
      const descWords = [];

      for (const w of row) {
        const n = norm(w.text);
        if (inRange(w.x0, POSTING_X) && ROW_DATE_RE.test(n)) {
          posting = n;
        } else if (inRange(w.x0, TXNDATE_X) && ROW_DATE_RE.test(n)) {
          txnDate = n;
        } else if (inRange(w.x0, AMOUNT_X) && AMOUNT_RE.test(n)) {
          amountWord = n;
        } else if (inRange(w.x0, DESC_X)) {
          descWords.push(w);
        }
      }

      if (posting === null || txnDate === null || amountWord === null) {
        continue; // not a transaction row (opening/closing balance, interest rate, etc.)
      }

      const amtMatch = AMOUNT_RE.exec(amountWord);
      if (amtMatch[2] && amtMatch[2].toUpperCase() === 'CR') {
        continue; // credit: bill payment, refund, or cashback — not spend
      }

      if (statementMonth === null) {
        throw new Error(`${file.name}: couldn't find the statement date on page 1`);
      }

      const dateMatch = ROW_DATE_RE.exec(txnDate);
      const month = MONTHS[dateMatch[2].toLowerCase()];
      const year = month <= statementMonth ? statementYear : statementYear - 1;
      const day = dateMatch[1];
      const date = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;

      const description = descWords
        .sort((a, b) => a.x0 - b.x0)
        .map((w) => w.text)
        .join(' ');
      const amount = parseFloat(amtMatch[1].replace(/,/g, ''));

      transactions.push(makeTransaction({
        date,
        description,
        amount,
        currency: 'MYR',
        payment_type: 'Credit card',
        source_account: 'RHB Credit Card',
      }));
    }
  }

  return transactions;
}

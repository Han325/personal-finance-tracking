import Papa from 'papaparse';
import { makeTransaction } from '../categorize.js';

const REQUIRED_FIELDS = ['date', 'description', 'amount', 'direction', 'currency'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {File} file
 * @returns {Promise<import('../categorize.js').Transaction[]>}
 */
export async function parse(file) {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error(`RHB expects the VLM CSV output, but got a PDF: ${file.name}`);
  }

  const text = await file.text();
  const { data, meta } = Papa.parse(text, { header: true, skipEmptyLines: true });

  const fields = new Set(meta.fields || []);
  const missing = REQUIRED_FIELDS.filter((f) => !fields.has(f));
  if (missing.length) {
    throw new Error(
      `RHB input is missing required fields: ${JSON.stringify(missing)}\n` +
      `Expected columns: ${JSON.stringify([...REQUIRED_FIELDS].sort())}`
    );
  }

  const transactions = [];
  data.forEach((row, i) => {
    const rowNum = i + 2;
    const direction = (row.direction || '').trim().toLowerCase();
    if (direction === 'payment') return;
    if (direction !== 'expense' && direction !== 'unclear') {
      throw new Error(`Row ${rowNum}: unknown direction ${JSON.stringify(row.direction)} (expected 'expense' or 'payment')`);
    }

    const dateStr = (row.date || '').trim();
    if (!DATE_RE.test(dateStr)) {
      throw new Error(`Row ${rowNum}: date must be YYYY-MM-DD, got ${JSON.stringify(dateStr)}`);
    }

    const amount = parseFloat((row.amount || '').trim());
    if (!(amount > 0)) {
      throw new Error(`Row ${rowNum}: amount must be positive, got ${amount}`);
    }

    transactions.push(makeTransaction({
      date: dateStr,
      description: (row.description || '').trim(),
      amount,
      currency: (row.currency || '').trim() || 'MYR',
      payment_type: 'Credit card',
      source_account: 'RHB Credit Card',
    }));
  });

  return transactions;
}

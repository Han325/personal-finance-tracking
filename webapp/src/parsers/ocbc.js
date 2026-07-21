import Papa from 'papaparse';
import { makeTransaction } from '../categorize.js';

/**
 * @param {File} file
 * @returns {Promise<import('../categorize.js').Transaction[]>}
 */
export async function parse(file) {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error(
      `OCBC expects a CSV export, but got a PDF: ${file.name}\n` +
      'Download the CSV from OCBC internet banking (Accounts > Transaction History > Export).'
    );
  }

  const raw = await file.text();

  const start = raw.indexOf('Transaction date');
  if (start === -1) {
    throw new Error(
      `Could not find 'Transaction date' header in ${file.name}. ` +
      'Make sure this is an OCBC CSV export, not a PDF or other format.'
    );
  }

  const { data } = Papa.parse(raw.slice(start), { header: true, skipEmptyLines: true });

  const transactions = [];
  for (const row of data) {
    const withdrawalRaw = (row['Withdrawals(MYR )'] || '').trim().replace(/^"|"$/g, '');
    if (!withdrawalRaw) continue;

    const amount = parseFloat(withdrawalRaw.replace(/,/g, ''));
    if (amount <= 0) continue;

    const dateStr = (row['Transaction date'] || '').trim();
    if (!dateStr) continue;
    const [d, m, y] = dateStr.split('/');
    const date = `${y}-${m}-${d}`;

    const description = (row['Description'] || '').trim().replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');

    transactions.push(makeTransaction({
      date,
      description,
      amount,
      currency: 'MYR',
      payment_type: 'Bank transfer',
      source_account: 'OCBC 360',
    }));
  }

  return transactions;
}

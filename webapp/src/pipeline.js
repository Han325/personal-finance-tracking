import * as hlb from './parsers/hlb.js';
import * as hlbCsv from './parsers/hlbCsv.js';
import * as ocbc from './parsers/ocbc.js';
import * as rhb from './parsers/rhb.js';
import * as rhbPdf from './parsers/rhbPdf.js';

export const WALLET_COLUMNS = [
  'account', 'category', 'currency', 'amount', 'ref_currency_amount',
  'type', 'payment_type', 'note', 'payment_type_local', 'date',
  'gps_latitude', 'gps_longitude', 'gps_accuracy_in_meters',
  'warranty_in_month', 'transfer', 'payee', 'labels', 'envelope_id',
  'custom_category',
];

/** @param {import('./categorize.js').Transaction} tx */
export function toWalletRow(tx) {
  const isIncome = tx.type === 'income';
  const signedAmount = isIncome ? tx.amount.toFixed(2) : `-${tx.amount.toFixed(2)}`;
  return {
    account: '',
    category: '',
    currency: tx.currency,
    amount: signedAmount,
    ref_currency_amount: signedAmount,
    type: isIncome ? 'Income' : 'Expenses',
    payment_type: 'CASH',
    note: tx.description,
    payment_type_local: '',
    date: `${tx.date} 12:00:00.000`,
    gps_latitude: '',
    gps_longitude: '',
    gps_accuracy_in_meters: '',
    warranty_in_month: '',
    transfer: '',
    payee: tx.source_account,
    labels: '',
    envelope_id: '',
    custom_category: '',
  };
}

/** @param {import('./categorize.js').Transaction[]} transactions */
export function transactionsToCsv(transactions) {
  const lines = [WALLET_COLUMNS.join(';')];
  for (const tx of transactions) {
    const row = toWalletRow(tx);
    lines.push(WALLET_COLUMNS.map((col) => row[col] ?? '').join(';'));
  }
  return lines.join('\n');
}

function extOf(filename) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? '' : filename.slice(i + 1).toLowerCase();
}

/**
 * @param {{hlbFile?: File, ocbcFile?: File, rhbFile?: File, rhbCardOverride?: string}} args
 * @returns {Promise<{transactions: import('./categorize.js').Transaction[], log: string[]}>}
 */
export async function runPipeline({ hlbFile, ocbcFile, rhbFile, rhbCardOverride } = {}) {
  const log = [];
  const all = [];

  function summarize(txs) {
    const income = txs.filter((t) => t.type === 'income').length;
    return income ? `${txs.length} rows (${txs.length - income} withdrawals, ${income} deposits)` : `${txs.length} withdrawals`;
  }

  if (ocbcFile) {
    log.push(`Parsing OCBC:  ${ocbcFile.name}`);
    const txs = await ocbc.parse(ocbcFile);
    log.push(`  ${summarize(txs)}`);
    all.push(...txs);
  }

  if (hlbFile) {
    log.push(`Parsing HLB:   ${hlbFile.name}`);
    const txs = extOf(hlbFile.name) === 'csv' ? await hlbCsv.parse(hlbFile) : await hlb.parse(hlbFile);
    log.push(`  ${summarize(txs)}`);
    all.push(...txs);
  }

  if (rhbFile) {
    log.push(`Parsing RHB:   ${rhbFile.name}`);
    const txs = extOf(rhbFile.name) === 'pdf'
      ? await rhbPdf.parse(rhbFile, rhbCardOverride || null)
      : await rhb.parse(rhbFile);
    log.push(`  ${txs.length} expenses`);
    all.push(...txs);
  }

  if (!all.length) {
    throw new Error('No transactions loaded — provide at least one of HLB, OCBC, RHB.');
  }

  const incomeCount = all.filter((t) => t.type === 'income').length;
  log.push('');
  log.push(`Total: ${all.length} transactions${incomeCount ? ` (${incomeCount} income)` : ''}`);

  return { transactions: all, log };
}

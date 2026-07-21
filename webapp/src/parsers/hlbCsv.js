import Papa from 'papaparse';
import { makeTransaction } from '../categorize.js';

const REF_ID_RE = /\d{8}HLBBMYKL\w+$/;
const SPACES_RE = /\s{2,}/g;

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function cleanRef(descType, reference) {
  const t = descType.toUpperCase();
  let r = reference.trim();

  if (t.includes('POS PURCHASE') || t.includes('MYDEBIT')) {
    // "DEBITCARD 7-ELEVEN MALAYSIA SDN BH ISKANDAR PUTEMY5499"
    // strip "DEBITCARD " prefix; MyDebit refs have no prefix at all
    r = r.replace(/^DEBITCARD\s+/i, '');
  } else if (t.includes('DUITNOW QR')) {
    // "QR PaymentGMO(TAMANEKOBOTANI)20260712HLBBMYKL030OQR39684924"
    // strip "QR Payment" prefix then trailing ref ID
    r = r.replace(/^QR Payment/i, '');
    r = r.replace(REF_ID_RE, '');
  } else if (t.includes('HL CONNECT') || t.includes('INSTANT TRANSFER') || t.includes('DUITNOW')) {
    // "Fund transferEU YU HAN20260710HLBBMYKL010ORM38764234"
    // strip "Fund transfer" prefix then trailing ref ID
    r = r.replace(/^Fund transfer/i, '');
    r = r.replace(REF_ID_RE, '');
  }

  return r.replace(SPACES_RE, ' ').trim();
}

function parseDdMonYyyy(dateStr) {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(dateStr);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1]}`;
}

/**
 * @param {File} file
 * @returns {Promise<import('../categorize.js').Transaction[]>}
 */
export async function parse(file) {
  const rawText = await file.text();
  const text = rawText.replace(/^﻿/, ''); // utf-8-sig BOM
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });

  const transactions = [];
  data.forEach((row, i) => {
    const wdRaw = (row['Withdrawal (MYR)'] || '').trim().replace(/,/g, '');
    if (!wdRaw) return; // deposit / credit row

    const amount = parseFloat(wdRaw);
    if (amount <= 0) return;

    const dateStr = (row['Date'] || '').trim();
    const date = parseDdMonYyyy(dateStr);
    if (!date) {
      throw new Error(`Row ${i + 2}: expected DD-Mon-YYYY date, got ${JSON.stringify(dateStr)}`);
    }

    const descType = (row['Description'] || '').trim();
    const reference = (row['Reference'] || '').trim();
    const cleaned = cleanRef(descType, reference);
    const description = cleaned ? `${descType} / ${cleaned}` : descType;

    transactions.push(makeTransaction({
      date,
      description,
      amount,
      currency: 'MYR',
      payment_type: 'DuitNow QR / POS / Bank transfer',
      source_account: 'HLB Pay & Save',
    }));
  });

  return transactions;
}

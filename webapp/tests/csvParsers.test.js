import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse as parseHlbCsv } from '../src/parsers/hlbCsv.js';
import { parse as parseOcbc } from '../src/parsers/ocbc.js';
import { parse as parseRhb } from '../src/parsers/rhb.js';

function textFile(name, text) {
  return new File([text], name, { type: 'text/csv' });
}

test('hlbCsv.parse: skips deposits, cleans DuitNow QR reference, parses DD-Mon-YYYY', async () => {
  const csv = [
    'Date,Description,Reference,Withdrawal (MYR),Deposit (MYR)',
    '20-Jul-2026,DUITNOW QR,QR PaymentGMO(TAMANEKOBOTANI)20260712HLBBMYKL030OQR39684924,15.50,',
    '21-Jul-2026,SALARY,,,"5,000.00"',
  ].join('\n');
  const txs = await parseHlbCsv(textFile('CASATran.csv', csv));
  assert.equal(txs.length, 1);
  assert.equal(txs[0].date, '2026-07-20');
  assert.equal(txs[0].amount, 15.5);
  assert.equal(txs[0].description, 'DUITNOW QR / GMO(TAMANEKOBOTANI)');
});

test('ocbc.parse: skips metadata lines, handles quoted comma amounts and embedded newlines', async () => {
  const csv = [
    'Account details for: 123456789',
    'Available Balance,1000.00',
    'Ledger Balance,1000.00',
    '',
    'Transaction History',
    'Transaction date,Value date,Description,Withdrawals(MYR ),Deposits(MYR )',
    '15/07/2026,15/07/2026,"SHOPEE\nPAYMENT","1,234.56",',
    '16/07/2026,16/07/2026,SALARY,,"3,000.00"',
  ].join('\n');
  const txs = await parseOcbc(textFile('TransactionHistory.csv', csv));
  assert.equal(txs.length, 1);
  assert.equal(txs[0].date, '2026-07-15');
  assert.equal(txs[0].amount, 1234.56);
  assert.equal(txs[0].description, 'SHOPEE PAYMENT');
});

test('rhb.parse: skips payment rows, validates required fields', async () => {
  const csv = [
    'date,description,amount,direction,currency',
    '2026-07-01,SHOPEE,50.00,expense,MYR',
    '2026-07-02,PYMT VIA SA/CA ACCOUNT,200.00,payment,MYR',
  ].join('\n');
  const txs = await parseRhb(textFile('rhb_vlm.csv', csv));
  assert.equal(txs.length, 1);
  assert.equal(txs[0].description, 'SHOPEE');
  assert.equal(txs[0].payment_type, 'Credit card');
});

test('rhb.parse: throws on missing required fields', async () => {
  const csv = ['date,description,amount', '2026-07-01,SHOPEE,50.00'].join('\n');
  await assert.rejects(() => parseRhb(textFile('bad.csv', csv)), /missing required fields/);
});

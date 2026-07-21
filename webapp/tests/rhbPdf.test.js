import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../src/parsers/rhbPdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(__dirname, '..', '..', 'RHB_4258608307212184_20260601.pdf');

// Oracle: parsers/rhb_pdf.py (the validated Python parser) extracts exactly
// these 12 non-credit transactions for card 4258-6083-0721-2184 from this
// sample statement. Gitignored real bank data — this test is local-only.
const EXPECTED = [
  { date: '2026-06-01', amount: 168.00 },
  { date: '2026-06-01', amount: 494.71 },
  { date: '2026-06-03', amount: 55.82 },
  { date: '2026-06-08', amount: 150.98 },
  { date: '2026-06-08', amount: 27.54 },
  { date: '2026-06-08', amount: 59.44 },
  { date: '2026-06-09', amount: 11.90 },
  { date: '2026-06-10', amount: 94.92 },
  { date: '2026-06-14', amount: 108.37 },
  { date: '2026-06-18', amount: 380.59 },
  { date: '2026-06-20', amount: 1342.05 },
  { date: '2026-06-21', amount: 65.79 },
];

test('rhbPdf.parse extracts exactly the 12 expected transactions', { skip: !existsSync(SAMPLE) && 'sample PDF not present' }, async () => {
  const buf = readFileSync(SAMPLE);
  const file = new File([buf], 'RHB_4258608307212184_20260601.pdf');

  const txs = await parse(file);

  assert.equal(txs.length, EXPECTED.length, `expected ${EXPECTED.length} transactions, got ${txs.length}: ${JSON.stringify(txs, null, 2)}`);

  for (let i = 0; i < EXPECTED.length; i++) {
    assert.equal(txs[i].date, EXPECTED[i].date, `row ${i} date`);
    assert.equal(txs[i].amount, EXPECTED[i].amount, `row ${i} amount`);
    assert.equal(txs[i].currency, 'MYR');
    assert.equal(txs[i].source_account, 'RHB Credit Card');
    assert.ok(txs[i].description.length > 0, `row ${i} description should not be empty`);
  }
});

test('rhbPdf.parse skips other cards and CR rows (sanity floor check)', { skip: !existsSync(SAMPLE) && 'sample PDF not present' }, async () => {
  const buf = readFileSync(SAMPLE);
  // Pass an explicit non-existent card number — should yield zero transactions,
  // proving the card filter is actually filtering (not accidentally matching everything).
  const file = new File([buf], 'RHB_4258608307212184_20260601.pdf');
  const txs = await parse(file, '0000-0000-0000-0000');
  assert.equal(txs.length, 0);
});

from __future__ import annotations

import csv
import re
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from categorize import Transaction


_REF_ID = re.compile(r'\d{8}HLBBMYKL\w+$')   # trailing reference ID in DuitNow / transfer refs
_SPACES = re.compile(r'\s{2,}')               # multiple spaces → single space


def _clean_ref(desc_type: str, reference: str) -> str:
    t = desc_type.upper()
    r = reference.strip()

    if 'POS PURCHASE' in t or 'MYDEBIT' in t:
        # "DEBITCARD 7-ELEVEN MALAYSIA SDN BH ISKANDAR PUTEMY5499"
        # strip "DEBITCARD " prefix; MyDebit refs have no prefix at all
        r = re.sub(r'^DEBITCARD\s+', '', r, flags=re.IGNORECASE)

    elif 'DUITNOW QR' in t:
        # "QR PaymentGMO(TAMANEKOBOTANI)20260712HLBBMYKL030OQR39684924"
        # strip "QR Payment" prefix then trailing ref ID
        r = re.sub(r'^QR Payment', '', r, flags=re.IGNORECASE)
        r = _REF_ID.sub('', r)

    elif 'HL CONNECT' in t or 'INSTANT TRANSFER' in t or 'DUITNOW' in t:
        # "Fund transferEU YU HAN20260710HLBBMYKL010ORM38764234"
        # strip "Fund transfer" prefix then trailing ref ID
        r = re.sub(r'^Fund transfer', '', r, flags=re.IGNORECASE)
        r = _REF_ID.sub('', r)

    return _SPACES.sub(' ', r).strip()


def parse(filepath: str) -> list[Transaction]:
    transactions: list[Transaction] = []

    with open(filepath, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            wd_raw = (row.get('Withdrawal (MYR)') or '').strip().replace(',', '')
            if not wd_raw:
                continue  # deposit / credit row

            amount = float(wd_raw)
            if amount <= 0:
                continue

            date_str = (row.get('Date') or '').strip()
            try:
                date = datetime.strptime(date_str, '%d-%b-%Y').strftime('%Y-%m-%d')
            except ValueError:
                raise ValueError(f"Row {i}: expected DD-Mon-YYYY date, got {date_str!r}")

            desc_type = (row.get('Description') or '').strip()
            reference = (row.get('Reference') or '').strip()
            cleaned   = _clean_ref(desc_type, reference)
            description = f"{desc_type} / {cleaned}" if cleaned else desc_type

            transactions.append(Transaction(
                date=date,
                description=description,
                amount=amount,
                currency='MYR',
                payment_type='DuitNow QR / POS / Bank transfer',
                source_account='HLB Pay & Save',
            ))

    return transactions

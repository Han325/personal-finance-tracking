from __future__ import annotations

import re
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from categorize import Transaction

try:
    import pdfplumber
except ImportError:
    raise ImportError("pdfplumber is required: pip install pdfplumber")

# Column x-coordinate ranges derived from HLB Pay&Save PDF format
_DATE_X    = (25,  82)
_DESC_X    = (82,  295)
_DEP_X     = (350, 430)
_WD_X      = (430, 520)

_DATE_RE   = re.compile(r'^\d{2}/\d{2}/\d{4}$')
_AMOUNT_RE = re.compile(r'^\d[\d,]*\.\d{2}$')

# Words that begin the statement summary section on the last page — stop collecting
# description text when any line starts with one of these.
_DESC_STOP = {"Balance", "Pengeluaran", "Simpanan", "Notis", "Penting"}


def _in(x: float, col: tuple) -> bool:
    return col[0] <= x < col[1]


def _parse_amount(text: str) -> float:
    return float(text.replace(',', ''))


def parse(filepath: str, statement_year: int, statement_month: int) -> list[Transaction]:
    raw: list[dict] = []   # accumulated across all pages

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            words = sorted(page.extract_words(), key=lambda w: (w['top'], w['x0']))

            # page_txs holds only this page's transactions so header words at the top
            # of the page don't leak into the last transaction from the previous page
            page_txs: list[dict] = []

            page_height = page.height
            for w in words:
                x0, top, text = w['x0'], w['top'], w['text']

                # Skip footer content (bottom 8% of page contains HLB's registration text)
                if top > page_height * 0.92:
                    continue

                if _in(x0, _DATE_X) and _DATE_RE.match(text):
                    page_txs.append({
                        'date_str':   text,
                        'date_top':   top,
                        'desc':       [],
                        'withdrawal': None,
                        'deposit':    None,
                    })

                elif page_txs:
                    tx = page_txs[-1]
                    if _in(x0, _DESC_X):
                        tx['desc'].append((top, x0, text))
                    elif _in(x0, _WD_X) and _AMOUNT_RE.match(text) and tx['withdrawal'] is None:
                        tx['withdrawal'] = _parse_amount(text)
                    elif _in(x0, _DEP_X) and _AMOUNT_RE.match(text) and tx['deposit'] is None:
                        tx['deposit'] = _parse_amount(text)

            raw.extend(page_txs)

    transactions: list[Transaction] = []
    for tx in raw:
        if tx['withdrawal'] is None:
            continue  # income / deposit row, skip

        # Build description: group words by line (same top), join lines with " / "
        # A gap > 20px between lines means we've left the transaction area (e.g. the
        # statement summary section on the last page falls in the same x-range).
        parts = sorted(tx['desc'], key=lambda p: (p[0], p[1]))
        lines: list[str] = []
        cur_top: float | None = None
        cur_line: list[str] = []
        for top, _, word in parts:
            if cur_top is None or abs(top - cur_top) > 3:
                if cur_line:
                    lines.append(' '.join(cur_line))
                if cur_top is not None and (top - cur_top) > 20:
                    break  # section gap — stop here
                if word in _DESC_STOP:
                    break  # statement summary keyword — stop here
                cur_line = [word]
                cur_top = top
            else:
                cur_line.append(word)
        if cur_line:
            lines.append(' '.join(cur_line))

        description = ' / '.join(lines)

        date = datetime.strptime(tx['date_str'], '%d/%m/%Y').strftime('%Y-%m-%d')

        transactions.append(Transaction(
            date=date,
            description=description,
            amount=tx['withdrawal'],
            currency='MYR',
            payment_type='DuitNow QR / POS / Bank transfer',
            source_account='HLB Pay & Save',
        ))

    return transactions

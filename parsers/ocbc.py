from __future__ import annotations

import csv
import io
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from categorize import Transaction


def parse(filepath: str) -> list[Transaction]:
    if filepath.lower().endswith(".pdf"):
        raise ValueError(
            f"OCBC expects a CSV export, but got a PDF: {filepath}\n"
            "Download the CSV from OCBC internet banking (Accounts > Transaction History > Export)."
        )

    with open(filepath, encoding="utf-8", errors="replace") as f:
        raw = f.read()

    try:
        start = raw.index("Transaction date")
    except ValueError:
        raise ValueError(
            f"Could not find 'Transaction date' header in {filepath}. "
            "Make sure this is an OCBC CSV export, not a PDF or other format."
        )

    reader = csv.DictReader(io.StringIO(raw[start:]))

    transactions: list[Transaction] = []
    for row in reader:
        withdrawal_raw = (row.get("Withdrawals(MYR )") or "").strip().strip('"')
        if not withdrawal_raw:
            continue

        amount = float(withdrawal_raw.replace(",", ""))
        if amount <= 0:
            continue

        date_str = (row.get("Transaction date") or "").strip()
        if not date_str:
            continue
        date = datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")

        description = (row.get("Description") or "").strip().replace("\\n", " ").replace("\n", " ").replace("\r", "")

        transactions.append(Transaction(
            date=date,
            description=description,
            amount=amount,
            currency="MYR",
            payment_type="Bank transfer",
            source_account="OCBC 360",
        ))

    return transactions

from __future__ import annotations

import csv
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from categorize import Transaction


_REQUIRED_FIELDS = {"date", "description", "amount", "direction", "currency"}


def parse(filepath: str) -> list[Transaction]:
    if filepath.lower().endswith(".pdf"):
        raise ValueError(
            f"RHB expects the VLM CSV output, but got a PDF: {filepath}"
        )
    with open(filepath, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fields = set(reader.fieldnames or [])
        missing = _REQUIRED_FIELDS - fields
        if missing:
            raise ValueError(
                f"RHB input is missing required fields: {missing}\n"
                f"Expected columns: {sorted(_REQUIRED_FIELDS)}"
            )

        transactions: list[Transaction] = []
        for i, row in enumerate(reader, start=2):
            direction = row["direction"].strip().lower()
            if direction == "payment":
                continue
            if direction not in ("expense", "unclear"):
                raise ValueError(f"Row {i}: unknown direction {row['direction']!r} (expected 'expense' or 'payment')")

            date_str = row["date"].strip()
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"Row {i}: date must be YYYY-MM-DD, got {date_str!r}")

            amount = float(row["amount"].strip())
            if amount <= 0:
                raise ValueError(f"Row {i}: amount must be positive, got {amount}")

            transactions.append(Transaction(
                date=date_str,
                description=row["description"].strip(),
                amount=amount,
                currency=row["currency"].strip() or "MYR",
                payment_type="Credit card",
                source_account="RHB Credit Card",
            ))

    return transactions

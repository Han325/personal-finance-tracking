from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Transaction:
    date: str           # YYYY-MM-DD
    description: str
    amount: float       # positive
    currency: str
    payment_type: str
    source_account: str

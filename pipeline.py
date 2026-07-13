from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from categorize import Transaction
from parsers import ocbc, hlb, hlb_csv, rhb


WALLET_COLUMNS = [
    "account", "category", "currency", "amount", "ref_currency_amount",
    "type", "payment_type", "note", "payment_type_local", "date",
    "gps_latitude", "gps_longitude", "gps_accuracy_in_meters",
    "warranty_in_month", "transfer", "payee", "labels", "envelope_id",
    "custom_category",
]


def _to_wallet_row(tx: Transaction) -> dict:
    neg_amount = f"-{tx.amount:.2f}"
    return {
        "account":               "",
        "category":              "",
        "currency":              tx.currency,
        "amount":                neg_amount,
        "ref_currency_amount":   neg_amount,
        "type":                  "Expenses",
        "payment_type":          "CASH",
        "note":                  tx.description,
        "payment_type_local":    "",
        "date":                  f"{tx.date} 12:00:00.000",
        "gps_latitude":          "",
        "gps_longitude":         "",
        "gps_accuracy_in_meters": "",
        "warranty_in_month":     "",
        "transfer":              "",
        "payee":                 tx.source_account,
        "labels":                "",
        "envelope_id":           "",
        "custom_category":       "",
    }


def _write_csv(path: Path, transactions: list[Transaction]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=WALLET_COLUMNS, delimiter=";")
        writer.writeheader()
        for tx in transactions:
            writer.writerow(_to_wallet_row(tx))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Personal finance pipeline — outputs a Wallet-importable CSV."
    )
    parser.add_argument("--month",      required=True, help="Statement month, e.g. 2026-07")
    parser.add_argument("--ocbc",       metavar="FILE", help="OCBC 360 CSV export")
    parser.add_argument("--hlb",        metavar="FILE", help="HLB Pay & Save — CSV export or PDF statement")
    parser.add_argument("--rhb",        metavar="FILE", help="RHB credit card VLM output CSV")
    parser.add_argument("--output-dir", default="output", metavar="DIR")
    args = parser.parse_args()

    try:
        year, month = map(int, args.month.split("-"))
    except ValueError:
        print("--month must be in YYYY-MM format, e.g. 2026-07", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(exist_ok=True)

    all_transactions: list[Transaction] = []

    if args.ocbc:
        print(f"Parsing OCBC:  {args.ocbc}")
        txs = ocbc.parse(args.ocbc)
        print(f"  {len(txs)} withdrawals")
        all_transactions.extend(txs)

    if args.hlb:
        print(f"Parsing HLB:   {args.hlb}")
        if Path(args.hlb).suffix.lower() == ".csv":
            txs = hlb_csv.parse(args.hlb)
        else:
            txs = hlb.parse(args.hlb, year, month)
        print(f"  {len(txs)} withdrawals")
        all_transactions.extend(txs)

    if args.rhb:
        print(f"Parsing RHB:   {args.rhb}")
        txs = rhb.parse(args.rhb)
        print(f"  {len(txs)} expenses")
        all_transactions.extend(txs)

    if not all_transactions:
        print("No transactions loaded — provide at least one of --ocbc, --hlb, --rhb.", file=sys.stderr)
        sys.exit(1)

    print(f"\nTotal: {len(all_transactions)} transactions")

    out_path = out_dir / f"{args.month}.csv"
    _write_csv(out_path, all_transactions)
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()

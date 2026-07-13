# Personal Finance Pipeline

A local Flask web app that parses bank statements from HLB, OCBC, and RHB, cleans the transaction descriptions, and exports a [Wallet by BudgetBakers](https://budgetbakers.com/) importable CSV — all from the browser.

## What it does

1. Upload your bank statement exports (tagged by bank)
2. Run the pipeline — transactions are parsed and cleaned
3. Review the list, discard anything you don't want
4. Download a ready-to-import CSV for Wallet

## Supported banks

| Bank | Format |
|------|--------|
| HLB Pay & Save | CSV export (`CASATran...csv`) or PDF statement |
| OCBC 360 | CSV export (Transaction History) |
| RHB Credit Card | VLM CSV output |

## Setup

```bash
pip install -r requirements.txt
python review_app/app.py
```

The app opens at `http://localhost:5000`.

## Usage

1. **Upload** — drag and drop your statement files, tag each one with the correct bank
2. **Month** — set the statement month (e.g. `2026-07`)
3. **Run pipeline** — parses all uploaded files and loads the transaction list
4. **Review** — optionally discard rows you don't want in the export
5. **Download CSV** — generates the Wallet-importable CSV client-side

## Project structure

```
pipeline.py              # CLI entry point, orchestrates parsers → CSV output
categorize.py            # Transaction dataclass
parsers/
  hlb.py                 # HLB PDF parser (pdfplumber, column-position based)
  hlb_csv.py             # HLB CSV export parser
  ocbc.py                # OCBC 360 CSV parser
  rhb.py                 # RHB VLM CSV parser
review_app/
  app.py                 # Flask app
  templates/index.html   # Single-page UI (Tailwind)
```

## Output format

Semicolon-delimited CSV matching the Wallet import schema. The `note` field carries the cleaned transaction description; `payee` carries the source bank. Category is intentionally left blank — Wallet handles its own categorisation on import.

## Notes

- No data leaves your machine — everything runs locally
- Bank statement files and pipeline output are gitignored; never committed
- The pipeline can also be run directly from the CLI: `python pipeline.py --month 2026-07 --hlb file.csv --rhb file.csv`

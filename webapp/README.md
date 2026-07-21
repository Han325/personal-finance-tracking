# Finance Pipeline — static web app

Parses bank statements from HLB, OCBC, and RHB, cleans up transaction
descriptions, and exports a [Wallet by BudgetBakers](https://budgetbakers.com/)
importable CSV — **100% client-side, static JS app**. No backend, no server,
no serverless functions — every PDF/CSV parse happens in your browser via
`pdfjs-dist` and `papaparse`. Nothing is ever uploaded anywhere, which means
it deploys for free to any static host (Vercel, Netlify, Cloudflare Pages,
GitHub Pages, ShipStatic).

This started as a rewrite of an earlier Python/Flask version of the same
pipeline; that version has since been removed in favor of this one.

## Setup

```bash
npm install
npm run dev       # dev server
npm run build     # → dist/, deployable as-is to any static host
npm test          # unit tests for the parsers (needs Node 18+)
```

## Usage

1. **Upload** — drag and drop your statement files, tag each one with the correct bank
2. **Month** — set the statement month (e.g. `2026-07`)
3. **Run pipeline** — parses all uploaded files and loads the transaction list
4. **Review** — optionally discard rows you don't want in the export
5. **Download CSV** — generates the Wallet-importable CSV

Nothing persists across a page refresh by design — transactions live in memory
for the current session only (see below), so there's no lingering copy of
your bank data sitting in the browser.

## Supported banks

| Bank | Format |
|------|--------|
| HLB Pay & Save | CSV export (`CASATran...csv`) or PDF statement |
| OCBC 360 | CSV export (Transaction History) |
| RHB Credit Card | PDF statement, or VLM CSV output |

RHB's PDF is a combined statement covering every card linked to the account
(main + supplementary cards). The parser extracts only one card's
transactions, auto-detected from the 16-digit card number in the PDF's
filename — pass a card number explicitly to `rhbPdf.parse(file, cardNumber)`
if that heuristic ever doesn't apply.

## Status

| Parser | Risk | Status |
|---|---|---|
| `src/parsers/rhbPdf.js` | high — coordinate-based PDF parsing | Verified end-to-end (upload → table → CSV download) against a real RHB statement |
| `src/parsers/hlb.js` | high — coordinate-based PDF parsing | Ported carefully, **not empirically verified** — no sample HLB PDF was available during the port. Test against a real statement before trusting it |
| `src/parsers/hlbCsv.js` | low | Unit-tested against a synthetic fixture |
| `src/parsers/ocbc.js` | low-medium | Unit-tested against a synthetic fixture (embedded-newline CSV handling) |
| `src/parsers/rhb.js` | low | Unit-tested against a synthetic fixture |

## Key implementation notes

- **`src/pdf/pdfWords.js`** is the pdfplumber-equivalent adapter: it maps
  `pdfjs-dist`'s `getTextContent()` items to `{text, x0, top, x1, bottom}`
  word boxes, converting pdf.js's bottom-up PDF-space y-coordinate to
  pdfplumber's top-down `top`. Verified empirically against the RHB sample:
  bank-statement PDFs emit one text item per table cell (not per glyph run),
  and those items keep real space characters (`"30 May"` rather than a
  pdfplumber-style merged `"30May"`) — parsers normalize whitespace before
  regex classification but keep it for the final description text, which
  ends up more faithful to the source than the word-merged version.
- Items are always sorted by `(top, x0)` before use — pdf.js's raw item order
  follows PDF content-stream order, not visual reading order.
- No server round-trip anywhere: `runPipeline()` in `src/pipeline.js` takes
  `File` objects directly and returns transactions in memory.
- **`src/ui/runsStore.js` is in-memory only, on purpose** — parsed
  transactions are real bank data, so they're not persisted to `localStorage`
  or disk. A page refresh clears everything; switching between months within
  the same session (without re-uploading) still works.
- The Wallet CSV writer (`toWalletRow`/`transactionsToCsv` in `src/pipeline.js`)
  is the single source of truth for the export format.

## Output format

Semicolon-delimited CSV matching the Wallet import schema. The `note` field
carries the cleaned transaction description; `payee` carries the source
bank. Category is intentionally left blank — Wallet handles its own
categorisation on import.

## Deploying

Any of Vercel/Netlify/Cloudflare Pages/ShipStatic: point the project at this
repo with **root/base directory set to `webapp`**, build command
`npm run build`, output directory `dist`. GitHub Pages needs
`base: '/<repo-name>/'` in `vite.config.js` if not deployed at a domain root,
plus a small Actions workflow to build and publish `dist`.

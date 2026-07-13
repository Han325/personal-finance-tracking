# Spend tracking automation, Phase 1 build spec

## 1. Goal

Replace manual transaction entry into the Wallet app (by BudgetBakers) with a
script-driven pipeline: pull transactions from bank sources, auto-categorize
what's unambiguous, flag what isn't, output a Wallet-importable CSV plus a
small review queue.

**Explicitly not in scope for this phase:**
- Dashboards or charts (revisit once the pipeline's proven over a real month)
- Tier 2 ML/SLM categorization (only add if the manual review pile turns out
  too large after Tier 1 rules alone)
- Any scheduling/automation trigger (cron, n8n). Run manually for now.
- Scripted bank logins or scraping of any kind. Ruled out entirely.
- Rent tracking. Handled as a native Wallet planned payment, not by this
  pipeline.

## 2. Data sources

| Account | Method | Notes |
|---|---|---|
| Hong Leong Pay & Save | PDF statement parsing | HLB's CSV export is paginated only (7-day window per export, confirmed), not usable for a full month. PDF is the clean path: full month, one file, real text layer (not scanned). |
| RHB credit card | VLM extraction from a manual screenshot | No export exists for this supplementary card. Screenshot taken from the transactions page, fed to a vision model, output must conform exactly to the schema in section 3. |
| OCBC 360 | CSV export | Confirmed working: full calendar month in one export, no pagination issue. See section 4 for the file's specific quirks. |

Accounts NOT in scope: HSBC Amanah, UOB ONE, RHB Smart Account, RHB FD, HLB
FD, Moomoo. None of these carry regular day-to-day spend worth tracking
transaction-by-transaction.

## 3. RHB card screenshot extraction contract

Whatever pulls data from the screenshot (VLM prompt, manual read, whatever)
must output exactly these 5 fields per row:

| Field | Format | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | Use the transaction date, not the separate posting date (posts land 1-2 days later and create false gaps if used) |
| `description` | raw merchant string, unedited | Rules match on raw text, don't clean or summarize it |
| `amount` | positive number, no currency symbol | e.g. `168.00` not `-MYR 168.00` |
| `direction` | `expense` or `payment` | Rows like "PYMT VIA SA/CA ACCOUNT" are the card bill being paid off, not a purchase. Must be tagged `payment` and excluded from spend totals or they double-count |
| `currency` | `MYR` unless stated otherwise | |

## 4. OCBC 360 CSV, known format quirks

Confirmed from a real export (`TransactionHistory_*.csv`):

- Encoding: plain ASCII, no BOM issue
- The file has 4 lines of account metadata before the real header
  (`Account details for:`, `Available Balance`, `Ledger Balance`, blank
  line, `Transaction History`). Parser must skip to the line starting
  `Transaction date,Value date,Description,...`
- Date format: `DD/MM/YYYY`
- Separate `Withdrawals(MYR )` / `Deposits(MYR )` columns, values are quoted
  strings with comma thousand-separators (e.g. `"30,435.75"`), strip both
  before converting to float
- **Description field contains real embedded newlines inside the quotes.**
  Must parse with an actual CSV reader (Python `csv` module or pandas), not
  a naive line-splitter, or single transactions will fracture into
  multiple rows

## 5. HLB Pay & Save PDF, known format

- Columns: Date, Transaction Details (often multi-line: type / payee /
  reference code), Deposit, Withdrawal, Balance
- Statement covers the full monthly cycle, one PDF per month
- Text layer is native (not scanned), extract via a PDF table-parsing
  library, no OCR/vision model needed for this source

## 6. Unified intermediate schema

Every source parser outputs this shape before anything touches
categorization:

```
date            YYYY-MM-DD
description     raw string, unmodified
amount          positive float
currency        default MYR
payment_type    e.g. "Debit card", "DuitNow QR", "Bank transfer"
source_account  which bank account, needed for the Wallet "account" field
```

## 7. Categorization rules (Tier 1, rule-based only)

Applied in order, first match wins. Matches on the `description` field,
case-insensitive substring.

| Category | Matches on |
|---|---|
| Fuel | `CALTEX`, `SHELL-` |
| Vehicle maintenance | `BRS AUTO`, `LIAN HENG TYRE` |
| Food & Drinks | `MCDONALD`, `KFC`, `DOMINOS`, `FAMILYMART`, `7-ELEVEN`, `NINSO`, `RESTORAN`, `RESTAURANT` |
| Bar, cafe | `ZUS COFFEE`, `ORIENTAL KOPI`, `CAFE`, `TEA ROOM` |
| Active sport, fitness | `MEDINI24 FITNESS` (one-off charges only, see exclusion list for the recurring membership) |
| Holiday, trips, hotels | `AGODA`, `AIRASIA` |
| Energy, utilities | `TENAGA NASIONAL`, `RANHILL SAJ`, `TT DOTCOM` (from OCBC JOMPAY lines, each posted as its own row, not consolidated) |
| Parking | any match containing `CAR PARK` |
| Wellness | `GUARDIAN-`, `WATSON'S` (resolved, both chains sit under one Wellness category, no split needed) |

**Always route to review, never auto-categorize:**
- `SHOPEE`, `TAOBAO`, any Grab merchant (`GRAB-`) — merchant identity is
  certain but the actual category varies per order, bank data alone can't
  disambiguate this, not a rule-tuning problem

**Special case, pre-labeled but not auto-filed:**
- Any HLB self-transfer whose reference contains `TNGD` (TNG Digital
  routing code) → review, pre-labeled "Food & Drinks (probable)". These are
  wallet reloads, not the actual purchase, so they're flagged as a probable
  category rather than filed as fact.

## 8. Exclusion list, drop these entirely (not categorize, not review)

Netflix, Spotify, ChatGPT/OpenAI, Google One, and the gym recurring
membership (Ezypay*Anytime Fitness) are already tracked as planned payments
inside the Wallet app itself. If the pipeline also outputs these, they'll
double-count against the planned-payment entries already there. These
merchants should be detected and silently dropped from all pipeline output.

iCloud was a one-time test charge, not recurring, no rule needed.

## 9. Output format

Corrected against Wallet's own official import documentation and example
file (`Example.xlsx`), not just Han's own export format, the two aren't
identical.

**Full column set Wallet's import accepts:**

```
account, category, currency, amount, ref_currency_amount, type,
payment_type, note, payment_type_local, date, gps_latitude, gps_longitude,
gps_accuracy_in_meters, warranty_in_month, transfer, payee, labels,
envelope_id, custom_category
```

**Only Amount and Date are documented as strictly required.** Everything
else, including category, is optional as far as Wallet's importer is
concerned, but category is obviously the point of this whole pipeline, so
it's populated regardless.

**Confirmed decisions (tested/verified by Han):**
- The `account` column in the file is ignored, the target account is set
  by manually selecting it in the import UI before upload, so this column
  can be left blank or omitted
- The "General account" requirement is already met on Han's Wallet setup
- All other optional columns (`payment_type_local`, `gps_latitude`,
  `gps_longitude`, `gps_accuracy_in_meters`, `warranty_in_month`,
  `envelope_id`, `custom_category`) are left blank/zero, no need to
  populate them

**Hard formatting rules (from Wallet's docs, non-negotiable):**
- No thousands separators in `amount`, ever (`1000.000` is invalid). OCBC
  and HLB source amounts both come quoted with commas
  (`"30,435.75"`), the writer must strip these before output or risk a
  rejected/misread row
- Amount sign must read left-to-right (`-100.00`, never `100.00-`)
- `type` values are exactly `Expenses` / `Income`, capitalized, plural, not
  `Expense`. Since this pipeline only imports spend, every row is
  `Expenses` with a negative `amount`, the two must always agree
- `ref_currency_amount` mirrors `amount` exactly, single currency (MYR)
  throughout, no conversion math needed
- `date` needs a full timestamp, not date-only, `YYYY-MM-DD HH:MM:SS.mmm`.
  Wallet's own example uses `12:00:00.000` as the placeholder time for
  transactions with no real time-of-day (which is every bank transaction
  here), so every row defaults to that same placeholder
- Accepted delimiters: caret `^`, comma `,`, hash `#`, semicolon `;`,
  vertical bar `|`. Semicolon is fine, no change needed
- File type: CSV, XLS/XLSX, or OFX all accepted
- Soft row cap: ~1,000 rows recommended per file. Not a concern for a
  normal monthly run, only relevant if ever doing a multi-month bulk
  historical backfill in one go

**Resolved:** `payment_type` is hardcoded to `CASH` for every row, regardless
of source. Confirmed this doesn't need to reflect the real payment method,
so no per-source logic needed here.

**Two files per run:**
1. `{month}_categorized.csv` — only transactions the rule engine was
   confident about, ready to import as-is
2. `{month}_review_needed.csv` — everything ambiguous, pre-labeled where a
   reasonable guess exists (TNG), blank category where it doesn't (Shopee,
   Grab, anything unmatched)

## 10. Review interface

Since there's no spreadsheet tool available locally, and typo-prone manual
CSV editing was ruled out as too fragile (a misspelled category silently
breaks the Wallet import), this needs to be a small web app, not a
spreadsheet workflow:

- Table view of `review_needed.csv`
- One dropdown per row, values locked to the actual existing Wallet
  category list (prevents typos entirely, need the real category list
  pulled from Han's Wallet export to populate this)
- A "always categorize like this" checkbox per correction, which appends a
  new rule to the Tier 1 rule table, so the review pile should shrink on
  its own over subsequent months without needing a Tier 2 model
- Save writes the corrected rows back out, merged with the already-
  confident output, ready for Wallet import

**Build/deploy note:** developing locally via Claude Code, with deployment
to be decided separately if a hosted version turns out useful. Since it's
local-first, the app can read/write the CSVs directly from disk rather than
needing a browser download/upload round-trip.

## 11. Build order

1. **Rule engine.** Existing `categorize.py` gets updated with: the
   exclusion list (section 8), the TNG pre-label logic (section 7), and
   whatever resolution comes out of the Guardian/Watsons conflict.
2. **OCBC CSV parser.** Fastest to build and test, a real clean sample file
   already exists.
3. **HLB PDF parser.** Table extraction from a native PDF text layer, same
   overall difficulty as the CSV parser, just a different extraction
   method.
4. **RHB ingestion.** Simplest of the three, just validates the VLM output
   matches the 5-field contract in section 3, no parsing logic of its own.
5. **Writer + orchestration.** Merges all three sources, runs them through
   the rule engine, outputs the two final CSVs.
6. **Review web app.** Built once the pipeline is producing real review
   piles to test against, not before.

## 12. Open items, need Han's input before finalizing

- Actual full list of existing Wallet categories, to populate the review
  UI's dropdown accurately
- Whether the review web app should also expose "past corrections" so
  patterns are visible, or just the current month's queue

# Personal Finance Pipeline

Parses bank statements from HLB, OCBC, and RHB, cleans the transaction
descriptions, and exports a [Wallet by BudgetBakers](https://budgetbakers.com/)
importable CSV — entirely client-side, in the browser.

The app lives in [`webapp/`](webapp/README.md) — see there for setup, usage,
and deployment instructions. It's a static site with no backend: nothing is
ever uploaded anywhere, and it deploys for free to Vercel, Netlify,
Cloudflare Pages, or similar.

## Notes

- No data leaves your machine — everything runs locally in the browser, and
  nothing persists across a page refresh (see `webapp/README.md`)
- Real bank statement files are gitignored; never committed
- `spend_pipeline_spec.md` is the original design spec this project grew from

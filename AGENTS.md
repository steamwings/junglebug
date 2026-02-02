# Agent Context

Browser console script for scraping Amazon transaction history.

## Project Structure

- `src/parser.ts` - Core parsing functions (tested)
- `src/scraper.ts` - Browser entry point, imports parser
- `tests/parser.test.ts` - Tests with fake data fixtures
- `dist/scrape-transactions.js` - Built browser script (committed)
- `samples/` - Sample HTML files for developing selectors (gitignored)

## Commands

```bash
bun test        # Run tests
bun run build   # Build browser script to dist/
```

## Key Selectors

**Transactions page (`/cpe/yourpayments/transactions`):**
- Order links: `a.a-link-normal[href*="orderID"]`
- Transaction amount: `.apx-transactions-line-item-component-container .a-size-base-plus.a-text-bold`
- Transaction date: `.apx-transaction-date-container span`

**Order details page:**
- Item container: `[data-component="purchasedItems"]`
- Item title: `[data-component="itemTitle"] a.a-link-normal`
- Item price: `.a-price .a-offscreen`
- ASIN: extracted from item URL `/dp/{ASIN}`

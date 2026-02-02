# Agent Context

Browser console script for scraping Amazon transaction history.

## Project Structure

- `src/parser.ts` - Core parsing functions (tested)
- `src/scraper.ts` - Browser entry point, imports parser
- `src/transaction-types.ts` - Merchant type configuration and handling rules
- `tests/parser.test.ts` - Tests with fake data fixtures
- `dist/scrape-transactions.js` - Built browser script (committed)
- `samples/` - Sample HTML files for developing selectors (gitignored)

## Commands

```bash
bun test        # Run tests
bun run build   # Build browser script to dist/
```

## Transaction Type Handling

Different merchant types require different scraping strategies.
Unknown types default to `order-details` with a console warning.

| Merchant Type | Item Source | Notes |
|--------------|-------------|-------|
| `AMZN Mktp US` | order-details | Marketplace orders |
| `Amazon.com` | order-details | Direct retail |
| `Prime Video Channels` | order-details | Video subscriptions |
| `Audible` | order-details | Audiobooks |
| `Amazon Grocery` | items-page | Need to click "View all items" |
| `Amazon Tips` | skip | Tips duplicate the main order transaction |
| (empty - ExternallyManagedPayment) | order-details | External payment, no merchant type shown |

See `src/transaction-types.ts` to add new merchant types.

## Key Selectors

**Transactions page (`/cpe/yourpayments/transactions`):**
- Order links: `a.a-link-normal[href*="orderID"]`
- Transaction amount: `.apx-transactions-line-item-component-container .a-size-base-plus.a-text-bold`
- Transaction date: `.apx-transaction-date-container span`
- Merchant type: `.a-column.a-span12 .a-size-base` (after order link)
- Payment method: `.a-column.a-span9 .a-size-base.a-text-bold`

**Order details page:**
- Item container: `[data-component="purchasedItems"]`
- Item title: `[data-component="itemTitle"] a.a-link-normal`
- Item price: `.a-price .a-offscreen`
- ASIN: extracted from item URL `/dp/{ASIN}`
- View all items link: `a.a-link-normal` containing "view all items"

**Items page (for grocery orders):**
- Product links: `a[href*="/dp/"]`
- Item name: link text or `img[alt]`

# Agent Context

Browser console script for scraping Amazon transaction history.

## Files

- `scrape-transactions.js` - Main script to run in browser console
- `samples/` - Sample HTML files for testing selectors

## Key Selectors

**Transactions page (`/cpe/yourpayments/transactions`):**
- Order links: `a.a-link-normal[href*="orderID"]`
- Transaction amount: `.apx-transactions-line-item-component-container .a-size-base-plus.a-text-bold`
- Transaction date: `.apx-transaction-date-container span`

**Order details page:**
- Item title: `[data-component="itemTitle"] a.a-link-normal`
- Item price: `.a-price .a-offscreen`
- Order ID: `[data-component="orderId"] span`

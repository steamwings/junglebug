# Junglebug 🪲

A browser console script for customers that scrapes your Amazon transaction history and fetches item details from each order.

## Usage

1. Navigate to https://www.amazon.com/cpe/yourpayments/transactions
2. Open browser DevTools (F12 or Cmd+Option+I on Mac)
3. Paste the contents of `scrape-transactions.js` into the Console tab
4. Press Enter and wait for processing to complete
5. Hit "Next Page" and run the script again if needed.

## Output

Results are:
- Logged to the console as a formatted summary
- Copied to your clipboard as JSON
- Available as `window.amazonTransactionResults` for further processing

### Data Structure

```javascript
{
  orderId: "123-4567890-1234567",
  orderUrl: "https://www.amazon.com/gp/css/summary/edit.html?orderID=...",
  transactionDate: "January 30, 2026",
  transactionAmount: "-$9.74",
  paymentMethod: "Visa ****5555",
  items: [
    {
      itemName: "Product Name Here",
      itemPrice: "$9.99",
      itemUrl: "https://www.amazon.com/dp/R2D2C3P0R4",
      asin: "R2D2C3POR4"
    }
  ]
}
```

## Notes

- The script adds a 1-second delay between requests to avoid rate limiting
- You must be logged into Amazon for the script to work
- Handles orders with multiple items and multiple shipping dates

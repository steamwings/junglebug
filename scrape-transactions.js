// Amazon Transaction Scraper - see README.md for usage instructions

(async function scrapeAmazonTransactions() {
  const DELAY_BETWEEN_REQUESTS = 1000; // ms delay to avoid rate limiting

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractOrderLinksFromTransactionsPage() {
    const orderLinks = [];
    const linkElements = document.querySelectorAll('a.a-link-normal[href*="orderID"]');

    linkElements.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();

      // Extract order ID from href
      const orderIdMatch = href.match(/orderID=([A-Z0-9-]+)/i);
      if (orderIdMatch) {
        const orderId = orderIdMatch[1];

        // Find the transaction container for this order
        const container = link.closest('.apx-transactions-line-item-component-container');

        let transactionDate = '';
        let transactionAmount = '';
        let paymentMethod = '';

        if (container) {
          // Get amount from this transaction
          const amountEl = container.querySelector('.a-size-base-plus.a-text-bold');
          if (amountEl) {
            transactionAmount = amountEl.textContent.trim();
          }

          // Get payment method
          const paymentEl = container.querySelector('.a-column.a-span9 .a-size-base.a-text-bold');
          if (paymentEl) {
            paymentMethod = paymentEl.textContent.trim();
          }

          // Find the date by looking backwards through siblings
          let prevElement = container.parentElement;
          while (prevElement) {
            const dateContainer = prevElement.querySelector('.apx-transaction-date-container span');
            if (dateContainer) {
              transactionDate = dateContainer.textContent.trim();
              break;
            }
            prevElement = prevElement.previousElementSibling;
          }
        }

        orderLinks.push({
          orderId,
          orderUrl: href,
          orderText: text,
          transactionDate,
          transactionAmount,
          paymentMethod
        });
      }
    });

    return orderLinks;
  }

  async function fetchOrderDetails(orderUrl) {
    try {
      const response = await fetch(orderUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return html;
    } catch (error) {
      console.error(`Failed to fetch ${orderUrl}:`, error);
      return null;
    }
  }

  function parseOrderDetailsPage(html, orderId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const items = [];

    // Find all purchasedItems sections (each represents an item in the order)
    const itemContainers = doc.querySelectorAll('[data-component="purchasedItems"]');

    itemContainers.forEach(container => {
      // Get item title
      const titleEl = container.querySelector('[data-component="itemTitle"] a.a-link-normal');
      const itemName = titleEl ? titleEl.textContent.trim() : '';

      // Get item price - look for the price element near this item
      const priceEl = container.querySelector('.a-price .a-offscreen');
      const itemPrice = priceEl ? priceEl.textContent.trim() : '';

      // Get item URL
      const itemUrl = titleEl ? titleEl.href : '';

      // Extract ASIN from URL if available
      const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
      const asin = asinMatch ? asinMatch[1] : '';

      if (itemName) {
        items.push({
          itemName,
          itemPrice,
          itemUrl,
          asin
        });
      }
    });

    // If no items found with the component approach, try alternative selectors
    if (items.length === 0) {
      // Try finding items by looking for itemTitle components directly
      const titleElements = doc.querySelectorAll('[data-component="itemTitle"] a.a-link-normal');

      titleElements.forEach((titleEl, index) => {
        const itemName = titleEl.textContent.trim();
        const itemUrl = titleEl.href || '';

        // Try to find the corresponding price
        const priceElements = doc.querySelectorAll('.a-price .a-offscreen');
        const itemPrice = priceElements[index] ? priceElements[index].textContent.trim() : '';

        const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
        const asin = asinMatch ? asinMatch[1] : '';

        if (itemName) {
          items.push({
            itemName,
            itemPrice,
            itemUrl,
            asin
          });
        }
      });
    }

    // Get order date from the page
    const orderDateEl = doc.querySelector('[data-component="orderPlacedLabel"] + [data-component="orderPlacedDate"] span, .order-date-invoice-item span');
    const orderPlacedDate = orderDateEl ? orderDateEl.textContent.trim() : '';

    // Get order total
    const orderTotalEl = doc.querySelector('.a-text-bold .a-color-base');
    const orderTotal = orderTotalEl ? orderTotalEl.textContent.trim() : '';

    return {
      orderId,
      orderPlacedDate,
      orderTotal,
      items
    };
  }

  // Main execution
  console.log('Starting Amazon Transaction Scraper...');
  console.log('Finding order links on the transactions page...');

  const orderLinks = extractOrderLinksFromTransactionsPage();
  console.log(`Found ${orderLinks.length} transactions`);

  const results = [];

  for (let i = 0; i < orderLinks.length; i++) {
    const order = orderLinks[i];
    console.log(`Processing ${i + 1}/${orderLinks.length}: Order ${order.orderId}`);

    const html = await fetchOrderDetails(order.orderUrl);

    if (html) {
      const orderDetails = parseOrderDetailsPage(html, order.orderId);

      results.push({
        ...order,
        ...orderDetails
      });

      console.log(`  Found ${orderDetails.items.length} item(s)`);
      orderDetails.items.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.itemName.substring(0, 50)}... - ${item.itemPrice}`);
      });
    } else {
      results.push({
        ...order,
        items: [],
        error: 'Failed to fetch order details'
      });
    }

    // Delay between requests to be nice to Amazon's servers
    if (i < orderLinks.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Output results
  console.log('\n=== SCRAPING COMPLETE ===\n');
  console.log('Results:', results);

  // Create a formatted summary
  console.log('\n=== TRANSACTION SUMMARY ===\n');
  results.forEach(r => {
    console.log(`Order: ${r.orderId}`);
    console.log(`  Date: ${r.transactionDate}`);
    console.log(`  Amount: ${r.transactionAmount}`);
    console.log(`  Payment: ${r.paymentMethod}`);
    console.log(`  Items:`);
    (r.items || []).forEach(item => {
      console.log(`    - ${item.itemName}`);
      console.log(`      Price: ${item.itemPrice}`);
    });
    console.log('');
  });

  // Copy to clipboard as JSON
  const jsonOutput = JSON.stringify(results, null, 2);
  try {
    await navigator.clipboard.writeText(jsonOutput);
    console.log('Results copied to clipboard as JSON!');
  } catch (e) {
    console.log('Could not copy to clipboard. Results available in the "results" variable above.');
  }

  // Also make results available globally for further processing
  window.amazonTransactionResults = results;
  console.log('\nResults also available as: window.amazonTransactionResults');

  return results;
})();

/**
 * Amazon Transaction Scraper
 * Run this in the browser console on an Amazon transactions page.
 * See README.md for usage instructions.
 */

import {
  extractOrderLinksFromTransactionsPage,
  parseOrderDetailsPage,
  parseHtml,
  ScrapedOrder,
  OrderLink
} from './parser';

const DELAY_BETWEEN_REQUESTS = 1000; // ms delay to avoid rate limiting

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOrderDetails(orderUrl: string): Promise<string | null> {
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

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${orderUrl}:`, error);
    return null;
  }
}

async function scrapeAmazonTransactions(): Promise<ScrapedOrder[]> {
  console.log('Starting Amazon Transaction Scraper...');
  console.log('Finding order links on the transactions page...');

  const orderLinks = extractOrderLinksFromTransactionsPage(document);
  console.log(`Found ${orderLinks.length} transactions`);

  const results: ScrapedOrder[] = [];

  for (let i = 0; i < orderLinks.length; i++) {
    const order = orderLinks[i];
    console.log(`Processing ${i + 1}/${orderLinks.length}: Order ${order.orderId}`);

    const html = await fetchOrderDetails(order.orderUrl);

    if (html) {
      const doc = parseHtml(html);
      const orderDetails = parseOrderDetailsPage(doc, order.orderId);

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
        orderId: order.orderId,
        orderPlacedDate: '',
        orderTotal: '',
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
  (window as any).amazonTransactionResults = results;
  console.log('\nResults also available as: window.amazonTransactionResults');

  return results;
}

// Execute immediately when loaded in browser
scrapeAmazonTransactions();

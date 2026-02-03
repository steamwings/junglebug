/**
 * Amazon Transaction Scraper
 * Run this in the browser console on an Amazon transactions page.
 * See README.md for usage instructions.
 *
 * Optional: Set window.end_date to a date string like "January 25, 2024"
 * to paginate backwards until reaching that date.
 */

import {
  extractOrderLinksFromTransactionsPage,
  parseOrderDetailsPage,
  parseItemsPage,
  extractItemsPageUrl,
  parseHtml,
  ScrapedOrder,
  OrderLink,
} from './parser';

import {
  getTransactionTypeConfig,
  shouldSkipOrderDetails,
  needsItemsPage,
} from './transaction-types';

import {
  validateEndDate,
  parseDate,
  isBeforeDate,
} from './date-utils';

const DELAY_BETWEEN_REQUESTS = 1000; // ms delay to avoid rate limiting

declare global {
  interface Window {
    end_date?: string;
    amazonTransactionResults?: ScrapedOrder[];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
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
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Get the oldest transaction date from a list of order links.
 * @returns The oldest date, or null if no valid dates found
 */
function getOldestTransactionDate(orderLinks: OrderLink[]): Date | null {
  let oldest: Date | null = null;

  for (const order of orderLinks) {
    if (!order.transactionDate) continue;

    const date = parseDate(order.transactionDate);
    if (!date) continue;

    if (!oldest || date < oldest) {
      oldest = date;
    }
  }

  return oldest;
}

/**
 * Check if the page has a "Next Page" button and click it.
 * @param doc - The document to search in
 * @returns true if Next Page was clicked, false if not available
 */
function clickNextPage(doc: Document): boolean {
  // Find the Next Page button input
  const nextPageInput = doc.querySelector(
    'input[name^="ppw-widgetEvent:DefaultNextPageNavigationEvent"]'
  ) as HTMLInputElement | null;

  if (!nextPageInput) {
    console.log('No Next Page button found');
    return false;
  }

  // Check if the button is disabled
  const buttonSpan = nextPageInput.closest('.a-button');
  if (buttonSpan?.classList.contains('a-button-disabled')) {
    console.log('Next Page button is disabled');
    return false;
  }

  // Click the button
  console.log('Clicking Next Page...');
  nextPageInput.click();
  return true;
}

/**
 * Process a single order and fetch its details.
 */
async function processOrder(order: OrderLink): Promise<ScrapedOrder> {
  const config = getTransactionTypeConfig(order.merchantType);

  // Handle based on transaction type
  if (shouldSkipOrderDetails(order.merchantType)) {
    console.log(`  Skipping: ${config.description}`);
    return {
      ...order,
      orderId: order.orderId,
      orderPlacedDate: '',
      orderTotal: '',
      items: [],
    };
  }

  if (needsItemsPage(order.merchantType)) {
    console.log(`  Fetching items page: ${config.description}`);

    const detailsHtml = await fetchPage(order.orderUrl);
    if (detailsHtml) {
      const detailsDoc = parseHtml(detailsHtml);
      const itemsPageUrl = extractItemsPageUrl(detailsDoc);

      if (itemsPageUrl) {
        await sleep(DELAY_BETWEEN_REQUESTS);
        const itemsHtml = await fetchPage(itemsPageUrl);

        if (itemsHtml) {
          const itemsDoc = parseHtml(itemsHtml);
          const orderDetails = parseItemsPage(itemsDoc, order.orderId);

          console.log(`  Found ${orderDetails.items.length} item(s) from items page`);
          return { ...order, ...orderDetails };
        }
      }

      // Fallback: try parsing details page directly
      const orderDetails = parseOrderDetailsPage(detailsDoc, order.orderId);
      console.log(`  Found ${orderDetails.items.length} item(s) from details page`);
      return { ...order, ...orderDetails };
    }

    return {
      ...order,
      orderId: order.orderId,
      orderPlacedDate: '',
      orderTotal: '',
      items: [],
      error: 'Failed to fetch order details',
    };
  }

  // Standard order - fetch order details page
  const html = await fetchPage(order.orderUrl);

  if (html) {
    const doc = parseHtml(html);
    const orderDetails = parseOrderDetailsPage(doc, order.orderId);

    console.log(`  Found ${orderDetails.items.length} item(s)`);
    orderDetails.items.forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.itemName.substring(0, 50)}... - ${item.itemPrice}`);
    });

    return { ...order, ...orderDetails };
  }

  return {
    ...order,
    orderId: order.orderId,
    orderPlacedDate: '',
    orderTotal: '',
    items: [],
    error: 'Failed to fetch order details',
  };
}

/**
 * Process orders on the current page until we hit end_date.
 * Stops immediately when a transaction is older than end_date.
 */
async function processCurrentPage(
  orderLinks: OrderLink[],
  endDate: Date | null
): Promise<{ results: ScrapedOrder[]; shouldContinue: boolean }> {
  const results: ScrapedOrder[] = [];

  for (let i = 0; i < orderLinks.length; i++) {
    const order = orderLinks[i];

    // Check if this transaction is older than end_date BEFORE processing
    if (endDate && order.transactionDate) {
      const txDate = parseDate(order.transactionDate);
      if (txDate && isBeforeDate(txDate, endDate)) {
        console.log(
          `Transaction ${order.orderId} (${order.transactionDate}) is before end_date, stopping`
        );
        return { results, shouldContinue: false };
      }
    }

    console.log(
      `Processing ${i + 1}/${orderLinks.length}: Order ${order.orderId} (${order.merchantType || 'unknown'})`
    );

    const result = await processOrder(order);
    results.push(result);

    // Delay between requests
    if (i < orderLinks.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Processed all orders on this page - continue to next page if end_date is set
  return { results, shouldContinue: endDate !== null };
}

/**
 * Output results summary and copy to clipboard.
 */
async function outputResults(results: ScrapedOrder[]): Promise<void> {
  console.log('\n=== SCRAPING COMPLETE ===\n');
  console.log('Results:', results);

  console.log('\n=== TRANSACTION SUMMARY ===\n');
  results.forEach(r => {
    console.log(`Order: ${r.orderId}`);
    console.log(`  Date: ${r.transactionDate}`);
    console.log(`  Amount: ${r.transactionAmount}`);
    console.log(`  Merchant: ${r.merchantType}`);
    console.log(`  Payment: ${r.paymentMethod}`);
    if (r.items && r.items.length > 0) {
      console.log(`  Items:`);
      r.items.forEach(item => {
        console.log(`    - ${item.itemName}`);
        if (item.itemPrice) {
          console.log(`      Price: ${item.itemPrice}`);
        }
      });
    }
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

  // Also make results available globally
  window.amazonTransactionResults = results;
  console.log('\nResults also available as: window.amazonTransactionResults');
}

async function scrapeAmazonTransactions(): Promise<ScrapedOrder[]> {
  console.log('Starting Amazon Transaction Scraper...');

  // Validate end_date if provided
  const { date: endDate, error: dateError } = validateEndDate(window.end_date);

  if (dateError) {
    console.error(`Error: ${dateError}`);
    return [];
  }

  if (endDate) {
    console.log(`Pagination enabled: will scrape until reaching ${endDate.toDateString()}`);
  } else {
    console.log('No end_date set: will scrape current page only');
  }

  const allResults: ScrapedOrder[] = [];
  let pageNum = 1;

  while (true) {
    console.log(`\n=== Page ${pageNum} ===`);
    console.log('Finding order links on the transactions page...');

    const orderLinks = extractOrderLinksFromTransactionsPage(document);
    console.log(`Found ${orderLinks.length} transactions`);

    if (orderLinks.length === 0) {
      console.log('No transactions found on this page');
      break;
    }

    // Get oldest date on this page for logging
    const oldestDate = getOldestTransactionDate(orderLinks);
    if (oldestDate) {
      console.log(`Oldest transaction on this page: ${oldestDate.toDateString()}`);
    }

    // Process all orders on this page
    const { results, shouldContinue } = await processCurrentPage(orderLinks, endDate);
    allResults.push(...results);

    if (!shouldContinue) {
      console.log('Reached end_date or no more pages needed');
      break;
    }

    // Try to go to next page
    console.log('\nNeed to fetch more transactions...');

    if (!clickNextPage(document)) {
      console.log('Cannot navigate to next page');
      break;
    }

    // Wait for page to load
    console.log('Waiting for next page to load...');
    await sleep(3000); // Give the page time to reload

    pageNum++;

    // Safety limit
    if (pageNum > 50) {
      console.warn('Reached maximum page limit (50), stopping');
      break;
    }
  }

  await outputResults(allResults);
  return allResults;
}

// Execute immediately when loaded in browser
scrapeAmazonTransactions();

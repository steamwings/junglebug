/**
 * Amazon Transaction Parser
 * Extracts order and transaction data from Amazon HTML pages.
 */

export interface OrderLink {
  orderId: string;
  orderUrl: string;
  orderText: string;
  transactionDate: string;
  transactionAmount: string;
  paymentMethod: string;
  merchantType: string;
}

export interface OrderItem {
  itemName: string;
  itemPrice: string;
  itemUrl: string;
  asin: string;
}

export interface OrderDetails {
  orderId: string;
  orderPlacedDate: string;
  orderTotal: string;
  items: OrderItem[];
}

export interface ScrapedOrder extends OrderLink, OrderDetails {
  error?: string;
}

/**
 * Extract order links from an Amazon transactions page.
 * @param doc - The Document object of the transactions page
 * @returns Array of order link information
 */
export function extractOrderLinksFromTransactionsPage(doc: Document): OrderLink[] {
  const orderLinks: OrderLink[] = [];
  const linkElements = doc.querySelectorAll('a.a-link-normal[href*="orderID"]');

  linkElements.forEach(link => {
    const anchor = link as HTMLAnchorElement;
    const href = anchor.href;
    const text = anchor.textContent?.trim() || '';

    // Extract order ID from href
    const orderIdMatch = href.match(/orderID=([A-Z0-9-]+)/i);
    if (orderIdMatch) {
      const orderId = orderIdMatch[1];

      // Find the transaction container for this order
      const container = link.closest('.apx-transactions-line-item-component-container');

      let transactionDate = '';
      let transactionAmount = '';
      let paymentMethod = '';
      let merchantType = '';

      if (container) {
        // Get amount from this transaction
        const amountEl = container.querySelector('.a-size-base-plus.a-text-bold');
        if (amountEl) {
          transactionAmount = amountEl.textContent?.trim() || '';
        }

        // Get payment method
        const paymentEl = container.querySelector('.a-column.a-span9 .a-size-base.a-text-bold');
        if (paymentEl) {
          paymentMethod = paymentEl.textContent?.trim() || '';
        }

        // Get merchant type (appears after the order link in a span)
        // Structure: <div class="a-column a-span12"><span class="a-size-base">MERCHANT TYPE</span></div>
        const merchantSpans = container.querySelectorAll('.a-column.a-span12 .a-size-base');
        merchantSpans.forEach(span => {
          const spanText = span.textContent?.trim() || '';
          // Skip if it looks like an order link text
          if (spanText && !spanText.startsWith('Order #') && !spanText.startsWith('Refund:')) {
            merchantType = spanText;
          }
        });

        // Find the date by looking backwards through siblings
        let prevElement = container.parentElement;
        while (prevElement) {
          const dateContainer = prevElement.querySelector('.apx-transaction-date-container span');
          if (dateContainer) {
            transactionDate = dateContainer.textContent?.trim() || '';
            break;
          }
          prevElement = prevElement.previousElementSibling as HTMLElement | null;
        }
      }

      orderLinks.push({
        orderId,
        orderUrl: href,
        orderText: text,
        transactionDate,
        transactionAmount,
        paymentMethod,
        merchantType
      });
    }
  });

  return orderLinks;
}

/**
 * Parse an Amazon order details page to extract item information.
 * @param doc - The Document object of the order details page
 * @param orderId - The order ID being parsed
 * @returns Order details including items
 */
export function parseOrderDetailsPage(doc: Document, orderId: string): OrderDetails {
  const items: OrderItem[] = [];

  // Find all purchasedItems sections (each represents an item in the order)
  const itemContainers = doc.querySelectorAll('[data-component="purchasedItems"]');

  itemContainers.forEach(container => {
    // Find ALL item titles within this container (some orders have multiple items per container)
    const titleElements = container.querySelectorAll('[data-component="itemTitle"] a.a-link-normal');
    const priceElements = container.querySelectorAll('.a-price .a-offscreen');

    titleElements.forEach((titleEl, index) => {
      const itemName = titleEl.textContent?.trim() || '';
      const itemPrice = priceElements[index]?.textContent?.trim() || '';
      const itemUrl = (titleEl as HTMLAnchorElement).href || '';

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
  });

  // If no items found with the component approach, try alternative selectors
  if (items.length === 0) {
    // Try finding items by looking for itemTitle components directly
    const titleElements = doc.querySelectorAll('[data-component="itemTitle"] a.a-link-normal');
    const priceElements = doc.querySelectorAll('.a-price .a-offscreen');

    titleElements.forEach((titleEl, index) => {
      const itemName = titleEl.textContent?.trim() || '';
      const itemUrl = (titleEl as HTMLAnchorElement)?.href || '';
      const itemPrice = priceElements[index]?.textContent?.trim() || '';

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
  const orderPlacedDate = orderDateEl?.textContent?.trim() || '';

  // Get order total
  const orderTotalEl = doc.querySelector('.a-text-bold .a-color-base');
  const orderTotal = orderTotalEl?.textContent?.trim() || '';

  return {
    orderId,
    orderPlacedDate,
    orderTotal,
    items
  };
}

/**
 * Parse HTML string into a Document using DOMParser.
 * @param html - Raw HTML string
 * @returns Parsed Document
 */
export function parseHtml(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Extract the "View all items" link from an order details page.
 * Used for grocery orders where items aren't shown on the main details page.
 * @param doc - The Document object of the order details page
 * @returns The URL to the items page, or null if not found
 */
export function extractItemsPageUrl(doc: Document): string | null {
  // Look for "View all items" or similar links
  const links = doc.querySelectorAll('a.a-link-normal');
  for (const link of links) {
    const text = link.textContent?.trim().toLowerCase() || '';
    if (text.includes('view all items') || text.includes('view items')) {
      return (link as HTMLAnchorElement).href || null;
    }
  }
  return null;
}

/**
 * Parse an Amazon items page (used for grocery orders).
 * @param doc - The Document object of the items page
 * @param orderId - The order ID being parsed
 * @returns Order details including items
 */
export function parseItemsPage(doc: Document, orderId: string): OrderDetails {
  const items: OrderItem[] = [];

  // Items page has product links with /dp/ in the URL
  const productLinks = doc.querySelectorAll('a[href*="/dp/"]');

  productLinks.forEach(link => {
    const anchor = link as HTMLAnchorElement;
    const itemUrl = anchor.href || '';

    // Extract ASIN from URL
    const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
    const asin = asinMatch ? asinMatch[1] : '';

    // Get item name from link text or nearby alt text
    let itemName = anchor.textContent?.trim() || '';

    // If link text is empty, try to find an image with alt text
    if (!itemName) {
      const img = anchor.querySelector('img[alt]');
      if (img) {
        itemName = img.getAttribute('alt') || '';
      }
    }

    // Skip if no name or ASIN (likely navigation links)
    if (!itemName || !asin) {
      return;
    }

    // Avoid duplicates (same ASIN)
    if (items.some(item => item.asin === asin)) {
      return;
    }

    // Try to find price near this item (grocery items may not have individual prices)
    const itemPrice = '';

    items.push({
      itemName,
      itemPrice,
      itemUrl,
      asin
    });
  });

  return {
    orderId,
    orderPlacedDate: '',
    orderTotal: '',
    items
  };
}

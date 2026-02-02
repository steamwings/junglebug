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
        paymentMethod
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
    // Get item title
    const titleEl = container.querySelector('[data-component="itemTitle"] a.a-link-normal');
    const itemName = titleEl?.textContent?.trim() || '';

    // Get item price - look for the price element near this item
    const priceEl = container.querySelector('.a-price .a-offscreen');
    const itemPrice = priceEl?.textContent?.trim() || '';

    // Get item URL
    const itemUrl = (titleEl as HTMLAnchorElement | null)?.href || '';

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

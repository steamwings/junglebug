import { describe, it, expect } from 'bun:test';
import { parseHTML } from 'linkedom';
import {
  extractOrderLinksFromTransactionsPage,
  parseOrderDetailsPage,
} from '../src/parser';

// Helper to create a DOM document from HTML string
function createDocument(html: string): Document {
  const { document } = parseHTML(html);
  return document;
}

// ============================================================================
// Test Fixtures - All data is fake/generated, not from real samples
// ============================================================================

/**
 * Generates fake HTML for an order details page with a single item.
 */
function createSingleItemOrderDetailsHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Order Details</title></head>
    <body>
      <div data-component="orderPlacedLabel">Order placed</div>
      <div data-component="orderPlacedDate"><span>March 15, 2025</span></div>

      <div data-component="purchasedItems">
        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B09FAKE123?ref=test">
            Acme Wireless Bluetooth Headphones with Noise Cancellation
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$79.99</span>
        </div>
      </div>

      <div class="a-text-bold">
        <span class="a-color-base">$84.57</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates fake HTML for an order details page with multiple items.
 */
function createMultiItemOrderDetailsHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Order Details</title></head>
    <body>
      <div data-component="orderPlacedLabel">Order placed</div>
      <div data-component="orderPlacedDate"><span>February 28, 2025</span></div>

      <div data-component="purchasedItems">
        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B07TEST001?ref=test">
            Premium Stainless Steel Water Bottle 32oz - Insulated
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$24.99</span>
        </div>
      </div>

      <div data-component="purchasedItems">
        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B08SAMPLE2?ref=test">
            Organic Green Tea Variety Pack - 100 Count
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$18.50</span>
        </div>
      </div>

      <div data-component="purchasedItems">
        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B09MOCK003?ref=test">
            Bamboo Desk Organizer with Drawer - Natural Finish
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$32.00</span>
        </div>
      </div>

      <div class="a-text-bold">
        <span class="a-color-base">$82.31</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates fake HTML for an order details page with no items (edge case).
 */
function createEmptyOrderDetailsHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Order Details</title></head>
    <body>
      <div data-component="orderPlacedLabel">Order placed</div>
      <div data-component="orderPlacedDate"><span>January 1, 2025</span></div>
      <div class="a-text-bold">
        <span class="a-color-base">$0.00</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates fake HTML for a transactions page with multiple orders.
 */
function createTransactionsPageHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Your Transactions</title></head>
    <body>
      <div class="transactions-container">
        <!-- Date group 1 -->
        <div>
          <div class="apx-transaction-date-container">
            <span>March 20, 2025</span>
          </div>
        </div>
        <div>
          <div class="apx-transactions-line-item-component-container">
            <div class="a-column a-span9">
              <span class="a-size-base a-text-bold">Mastercard ****5678</span>
            </div>
            <div class="a-column a-span3">
              <span class="a-size-base-plus a-text-bold">-$156.99</span>
            </div>
            <div class="a-column a-span12">
              <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=111-2223334-4445556">
                Order #111-2223334-4445556
              </a>
            </div>
            <div class="a-column a-span12">
              <span class="a-size-base">AMZN Mktp US</span>
            </div>
          </div>
        </div>

        <!-- Date group 2 -->
        <div>
          <div class="apx-transaction-date-container">
            <span>March 18, 2025</span>
          </div>
        </div>
        <div>
          <div class="apx-transactions-line-item-component-container">
            <div class="a-column a-span9">
              <span class="a-size-base a-text-bold">Visa ****1234</span>
            </div>
            <div class="a-column a-span3">
              <span class="a-size-base-plus a-text-bold">-$42.50</span>
            </div>
            <div class="a-column a-span12">
              <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=222-3334445-5556667">
                Order #222-3334445-5556667
              </a>
            </div>
            <div class="a-column a-span12">
              <span class="a-size-base">Amazon.com</span>
            </div>
          </div>
        </div>

        <div>
          <div class="apx-transactions-line-item-component-container">
            <div class="a-column a-span9">
              <span class="a-size-base a-text-bold">Visa ****1234</span>
            </div>
            <div class="a-column a-span3">
              <span class="a-size-base-plus a-text-bold">-$19.99</span>
            </div>
            <div class="a-column a-span12">
              <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=333-4445556-6667778">
                Order #333-4445556-6667778
              </a>
            </div>
            <div class="a-column a-span12">
              <span class="a-size-base">Amazon Fresh</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates fake HTML for an order details page using the fallback selector path.
 * This simulates pages where purchasedItems containers don't directly contain the items.
 */
function createFallbackSelectorOrderDetailsHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Order Details</title></head>
    <body>
      <div data-component="orderPlacedLabel">Order placed</div>
      <div data-component="orderPlacedDate"><span>April 10, 2025</span></div>

      <!-- Items not inside purchasedItems containers -->
      <div class="item-list">
        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B01FALLBK1?ref=test">
            Ergonomic Office Chair with Lumbar Support
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$199.99</span>
        </div>

        <div data-component="itemTitle">
          <a class="a-link-normal" href="https://www.amazon.com/dp/B02FALLBK2?ref=test">
            USB-C Hub Adapter 7-in-1 for Laptop
          </a>
        </div>
        <div class="a-price">
          <span class="a-offscreen">$35.99</span>
        </div>
      </div>

      <div class="a-text-bold">
        <span class="a-color-base">$249.42</span>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// Tests
// ============================================================================

describe('parseOrderDetailsPage', () => {
  describe('single item orders', () => {
    it('should parse an order with a single item', () => {
      const doc = createDocument(createSingleItemOrderDetailsHtml());
      const result = parseOrderDetailsPage(doc, 'TEST-ORDER-001');

      expect(result.orderId).toBe('TEST-ORDER-001');
      expect(result.orderPlacedDate).toBe('March 15, 2025');
      expect(result.orderTotal).toBe('$84.57');
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.itemName).toBe('Acme Wireless Bluetooth Headphones with Noise Cancellation');
      expect(item.itemPrice).toBe('$79.99');
      expect(item.asin).toBe('B09FAKE123');
      expect(item.itemUrl).toContain('/dp/B09FAKE123');
    });
  });

  describe('multiple item orders', () => {
    it('should parse an order with multiple items', () => {
      const doc = createDocument(createMultiItemOrderDetailsHtml());
      const result = parseOrderDetailsPage(doc, 'TEST-ORDER-002');

      expect(result.orderId).toBe('TEST-ORDER-002');
      expect(result.orderPlacedDate).toBe('February 28, 2025');
      expect(result.orderTotal).toBe('$82.31');
      expect(result.items).toHaveLength(3);

      // First item
      expect(result.items[0].itemName).toBe('Premium Stainless Steel Water Bottle 32oz - Insulated');
      expect(result.items[0].itemPrice).toBe('$24.99');
      expect(result.items[0].asin).toBe('B07TEST001');

      // Second item
      expect(result.items[1].itemName).toBe('Organic Green Tea Variety Pack - 100 Count');
      expect(result.items[1].itemPrice).toBe('$18.50');
      expect(result.items[1].asin).toBe('B08SAMPLE2');

      // Third item
      expect(result.items[2].itemName).toBe('Bamboo Desk Organizer with Drawer - Natural Finish');
      expect(result.items[2].itemPrice).toBe('$32.00');
      expect(result.items[2].asin).toBe('B09MOCK003');
    });

    it('should correctly extract all ASINs from multiple items', () => {
      const doc = createDocument(createMultiItemOrderDetailsHtml());
      const result = parseOrderDetailsPage(doc, 'TEST-ORDER-003');

      const asins = result.items.map(item => item.asin);
      expect(asins).toEqual(['B07TEST001', 'B08SAMPLE2', 'B09MOCK003']);
    });
  });

  describe('edge cases', () => {
    it('should handle orders with no items', () => {
      const doc = createDocument(createEmptyOrderDetailsHtml());
      const result = parseOrderDetailsPage(doc, 'TEST-ORDER-EMPTY');

      expect(result.orderId).toBe('TEST-ORDER-EMPTY');
      expect(result.orderPlacedDate).toBe('January 1, 2025');
      expect(result.orderTotal).toBe('$0.00');
      expect(result.items).toHaveLength(0);
    });

    it('should use fallback selectors when purchasedItems containers are not present', () => {
      const doc = createDocument(createFallbackSelectorOrderDetailsHtml());
      const result = parseOrderDetailsPage(doc, 'TEST-ORDER-FALLBACK');

      expect(result.orderId).toBe('TEST-ORDER-FALLBACK');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].itemName).toBe('Ergonomic Office Chair with Lumbar Support');
      expect(result.items[0].asin).toBe('B01FALLBK1');
      expect(result.items[1].itemName).toBe('USB-C Hub Adapter 7-in-1 for Laptop');
      expect(result.items[1].asin).toBe('B02FALLBK2');
    });

    it('should handle missing order date gracefully', () => {
      const html = `
        <!DOCTYPE html>
        <html><body>
          <div data-component="purchasedItems">
            <div data-component="itemTitle">
              <a class="a-link-normal" href="https://www.amazon.com/dp/B00NODATE1">Test Item</a>
            </div>
          </div>
        </body></html>
      `;
      const doc = createDocument(html);
      const result = parseOrderDetailsPage(doc, 'TEST-NO-DATE');

      expect(result.orderPlacedDate).toBe('');
      expect(result.items).toHaveLength(1);
    });

    it('should handle items without prices', () => {
      const html = `
        <!DOCTYPE html>
        <html><body>
          <div data-component="purchasedItems">
            <div data-component="itemTitle">
              <a class="a-link-normal" href="https://www.amazon.com/dp/B00NOPRICE">Free Sample Item</a>
            </div>
          </div>
        </body></html>
      `;
      const doc = createDocument(html);
      const result = parseOrderDetailsPage(doc, 'TEST-NO-PRICE');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].itemName).toBe('Free Sample Item');
      expect(result.items[0].itemPrice).toBe('');
    });

    it('should handle items without ASIN in URL', () => {
      const html = `
        <!DOCTYPE html>
        <html><body>
          <div data-component="purchasedItems">
            <div data-component="itemTitle">
              <a class="a-link-normal" href="https://www.amazon.com/some-product-page">Item Without ASIN</a>
            </div>
          </div>
        </body></html>
      `;
      const doc = createDocument(html);
      const result = parseOrderDetailsPage(doc, 'TEST-NO-ASIN');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].asin).toBe('');
    });
  });
});

describe('extractOrderLinksFromTransactionsPage', () => {
  it('should extract multiple order links from transactions page', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    expect(result).toHaveLength(3);
  });

  it('should extract order IDs correctly', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    const orderIds = result.map(link => link.orderId);
    expect(orderIds).toContain('111-2223334-4445556');
    expect(orderIds).toContain('222-3334445-5556667');
    expect(orderIds).toContain('333-4445556-6667778');
  });

  it('should extract transaction amounts', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    const amounts = result.map(link => link.transactionAmount);
    expect(amounts).toContain('-$156.99');
    expect(amounts).toContain('-$42.50');
    expect(amounts).toContain('-$19.99');
  });

  it('should extract payment methods', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    const paymentMethods = result.map(link => link.paymentMethod);
    expect(paymentMethods).toContain('Mastercard ****5678');
    expect(paymentMethods).toContain('Visa ****1234');
  });

  it('should extract merchant types', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    const merchantTypes = result.map(link => link.merchantType);
    expect(merchantTypes).toContain('AMZN Mktp US');
    expect(merchantTypes).toContain('Amazon.com');
    expect(merchantTypes).toContain('Amazon Fresh');
  });

  it('should extract order URLs', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    result.forEach(link => {
      expect(link.orderUrl).toContain('orderID=');
      expect(link.orderUrl).toContain('amazon.com');
    });
  });

  it('should extract order text', () => {
    const doc = createDocument(createTransactionsPageHtml());
    const result = extractOrderLinksFromTransactionsPage(doc);

    result.forEach(link => {
      expect(link.orderText).toMatch(/Order #\d{3}-\d{7}-\d{7}/);
    });
  });

  it('should handle empty transactions page', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div class="transactions-container">
          <p>No transactions found</p>
        </div>
      </body></html>
    `;
    const doc = createDocument(html);
    const result = extractOrderLinksFromTransactionsPage(doc);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for page with no transaction containers', () => {
    // Simulates reaching the end of transaction history
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div class="a-box-group">
          <div class="a-box a-spacing-none a-box-title">
            <span class="a-size-base a-text-bold">Completed</span>
          </div>
          <div class="a-box a-spacing-base">
            <div class="a-box-inner a-padding-none">
              <!-- No transactions here -->
            </div>
          </div>
        </div>
      </body></html>
    `;
    const doc = createDocument(html);
    const result = extractOrderLinksFromTransactionsPage(doc);

    expect(result).toHaveLength(0);
  });

  it('should ignore links without orderID parameter', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <a class="a-link-normal" href="https://www.amazon.com/some-other-page">Not an order</a>
        <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=999-8887776-5554443">
          Order #999-8887776-5554443
        </a>
      </body></html>
    `;
    const doc = createDocument(html);
    const result = extractOrderLinksFromTransactionsPage(doc);

    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('999-8887776-5554443');
  });

  it('should handle alphanumeric order IDs', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=D01-1234567-8901234">
          Order #D01-1234567-8901234
        </a>
      </body></html>
    `;
    const doc = createDocument(html);
    const result = extractOrderLinksFromTransactionsPage(doc);

    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('D01-1234567-8901234');
  });
});

describe('integration scenarios', () => {
  it('should handle a realistic multi-item order scenario', () => {
    const doc = createDocument(createMultiItemOrderDetailsHtml());
    const result = parseOrderDetailsPage(doc, '456-7890123-4567890');

    // Verify we can build a complete order summary
    expect(result.orderId).toBe('456-7890123-4567890');
    expect(result.items.length).toBeGreaterThan(1);

    // Each item should have complete data
    result.items.forEach(item => {
      expect(item.itemName).toBeTruthy();
      expect(item.itemUrl).toBeTruthy();
      expect(item.asin).toBeTruthy();
    });
  });
});

// ============================================================================
// Transaction Types Tests
// ============================================================================

import {
  getTransactionTypeConfig,
  shouldSkipOrderDetails,
  needsItemsPage,
} from '../src/transaction-types';

describe('transaction-types', () => {
  describe('getTransactionTypeConfig', () => {
    it('should return order-details for standard merchant types', () => {
      expect(getTransactionTypeConfig('AMZN Mktp US').itemSource).toBe('order-details');
      expect(getTransactionTypeConfig('Amazon.com').itemSource).toBe('order-details');
      expect(getTransactionTypeConfig('Prime Video Channels').itemSource).toBe('order-details');
      expect(getTransactionTypeConfig('Audible').itemSource).toBe('order-details');
    });

    it('should return skip for Amazon Tips', () => {
      expect(getTransactionTypeConfig('Amazon Tips').itemSource).toBe('skip');
    });

    it('should return items-page for Amazon Grocery', () => {
      expect(getTransactionTypeConfig('Amazon Grocery').itemSource).toBe('items-page');
    });

    it('should return order-details for unknown merchant types', () => {
      const config = getTransactionTypeConfig('Unknown Seller XYZ');
      expect(config.itemSource).toBe('order-details');
    });

    it('should use merchant name as description for unknown types', () => {
      const config = getTransactionTypeConfig('Some New Merchant');
      expect(config.description).toBe('Some New Merchant');
    });

    it('should trim whitespace', () => {
      const config = getTransactionTypeConfig('  Amazon.com  ');
      expect(config.itemSource).toBe('order-details');
    });

    it('should handle empty merchant type (e.g., ExternallyManagedPayment)', () => {
      const config = getTransactionTypeConfig('');
      expect(config.itemSource).toBe('order-details');
    });
  });

  describe('shouldSkipOrderDetails', () => {
    it('should return true for Amazon Tips', () => {
      expect(shouldSkipOrderDetails('Amazon Tips')).toBe(true);
    });

    it('should return false for standard merchant types', () => {
      expect(shouldSkipOrderDetails('AMZN Mktp US')).toBe(false);
      expect(shouldSkipOrderDetails('Amazon.com')).toBe(false);
      expect(shouldSkipOrderDetails('Prime Video Channels')).toBe(false);
      expect(shouldSkipOrderDetails('Audible')).toBe(false);
    });

    it('should return false for unknown merchant types', () => {
      expect(shouldSkipOrderDetails('Unknown Type')).toBe(false);
    });
  });

  describe('needsItemsPage', () => {
    it('should return true for Amazon Grocery', () => {
      expect(needsItemsPage('Amazon Grocery')).toBe(true);
    });

    it('should return false for standard merchant types', () => {
      expect(needsItemsPage('AMZN Mktp US')).toBe(false);
      expect(needsItemsPage('Amazon.com')).toBe(false);
      expect(needsItemsPage('Prime Video Channels')).toBe(false);
      expect(needsItemsPage('Audible')).toBe(false);
    });

    it('should return false for unknown merchant types', () => {
      expect(needsItemsPage('Unknown Type')).toBe(false);
    });
  });
});

// ============================================================================
// Date Utilities Tests
// ============================================================================

import {
  parseDate,
  normalizeToDay,
  isOnOrBeforeDate,
  isBeforeDate,
  validateEndDate,
} from '../src/date-utils';

describe('date-utils', () => {
  describe('parseDate', () => {
    it('should parse "January 25, 2024" format', () => {
      const date = parseDate('January 25, 2024');
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2024);
      expect(date!.getMonth()).toBe(0); // January
      expect(date!.getDate()).toBe(25);
    });

    it('should parse "December 31, 2025" format', () => {
      const date = parseDate('December 31, 2025');
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2025);
      expect(date!.getMonth()).toBe(11); // December
      expect(date!.getDate()).toBe(31);
    });

    it('should return null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('should return null for invalid date', () => {
      expect(parseDate('not a date')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(parseDate('   ')).toBeNull();
    });
  });

  describe('normalizeToDay', () => {
    it('should set time to midnight', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      const normalized = normalizeToDay(date);
      expect(normalized.getHours()).toBe(0);
      expect(normalized.getMinutes()).toBe(0);
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const date = new Date('2024-06-20T23:59:59.999Z');
      const normalized = normalizeToDay(date);
      expect(normalized.getDate()).toBe(date.getDate());
      expect(normalized.getMonth()).toBe(date.getMonth());
      expect(normalized.getFullYear()).toBe(date.getFullYear());
    });
  });

  describe('isOnOrBeforeDate', () => {
    it('should return true when transaction is before end date', () => {
      const tx = new Date('2024-01-15');
      const end = new Date('2024-01-20');
      expect(isOnOrBeforeDate(tx, end)).toBe(true);
    });

    it('should return true when transaction is on end date', () => {
      const tx = new Date('2024-01-15');
      const end = new Date('2024-01-15');
      expect(isOnOrBeforeDate(tx, end)).toBe(true);
    });

    it('should return false when transaction is after end date', () => {
      const tx = new Date('2024-01-25');
      const end = new Date('2024-01-20');
      expect(isOnOrBeforeDate(tx, end)).toBe(false);
    });
  });

  describe('isBeforeDate', () => {
    it('should return true when transaction is before end date', () => {
      const tx = new Date('2024-01-15');
      const end = new Date('2024-01-20');
      expect(isBeforeDate(tx, end)).toBe(true);
    });

    it('should return false when transaction is on end date', () => {
      const tx = new Date('2024-01-15');
      const end = new Date('2024-01-15');
      expect(isBeforeDate(tx, end)).toBe(false);
    });

    it('should return false when transaction is after end date', () => {
      const tx = new Date('2024-01-25');
      const end = new Date('2024-01-20');
      expect(isBeforeDate(tx, end)).toBe(false);
    });
  });

  describe('validateEndDate', () => {
    it('should return null date for undefined', () => {
      const result = validateEndDate(undefined);
      expect(result.date).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should return null date for null', () => {
      const result = validateEndDate(null);
      expect(result.date).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should parse valid date string', () => {
      const result = validateEndDate('January 25, 2024');
      expect(result.date).not.toBeNull();
      expect(result.error).toBeNull();
      expect(result.date!.getFullYear()).toBe(2024);
    });

    it('should return error for non-string', () => {
      const result = validateEndDate(12345);
      expect(result.date).toBeNull();
      expect(result.error).toContain('must be a string');
    });

    it('should return error for invalid date string', () => {
      const result = validateEndDate('not a valid date');
      expect(result.date).toBeNull();
      expect(result.error).toContain('Could not parse');
    });
  });
});

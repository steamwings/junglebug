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
            <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=111-2223334-4445556">
              Order #111-2223334-4445556
            </a>
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
            <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=222-3334445-5556667">
              Order #222-3334445-5556667
            </a>
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
            <a class="a-link-normal" href="https://www.amazon.com/gp/css/order-details?orderID=333-4445556-6667778">
              Order #333-4445556-6667778
            </a>
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

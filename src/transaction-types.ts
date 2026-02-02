/**
 * Transaction Type Configuration
 *
 * Maps merchant/source names (as they appear on Amazon's transactions page)
 * to how the scraper should handle them.
 *
 * Only add entries here for types that need DIFFERENT handling than the default.
 * Unknown types default to 'order-details'.
 */

export type ItemSource =
  | 'order-details'      // Items are on the order details page directly
  | 'items-page'         // Need to click "View all items" from order details
  | 'skip';              // Don't fetch order details (e.g., duplicate transactions)

export interface TransactionTypeConfig {
  /** How to retrieve item details */
  itemSource: ItemSource;
  /** Human-readable description */
  description: string;
}

/**
 * Map of merchant/source names that need special handling.
 *
 * Observed merchant types from samples that use default (order-details):
 * - "AMZN Mktp US" (marketplace)
 * - "Amazon.com" (direct retail)
 * - "Prime Video Channels"
 * - "Audible"
 *
 * Note: Transactions with "ExternallyManagedPayment" as payment method
 * have no merchant type - they default to order-details which is correct.
 */
export const TRANSACTION_TYPES: Record<string, TransactionTypeConfig> = {
  // Tips are duplicate transactions - skip them
  'Amazon Tips': {
    itemSource: 'skip',
    description: 'Delivery tips - order details appear in main transaction',
  },

  // Grocery orders need items page navigation
  'Amazon Grocery': {
    itemSource: 'items-page',
    description: 'Amazon Grocery - items on separate page',
  },
};

/** Set of known merchant types that use order-details (for logging unknown ones) */
const KNOWN_MERCHANT_TYPES = new Set([
  'AMZN Mktp US',
  'Amazon.com',
  'Prime Video Channels',
  'Audible',
  'Amazon Tips',
  'Amazon Grocery',
]);

/**
 * Get the configuration for a given merchant/source name.
 * Returns default config (order-details) if not found.
 * Logs a warning for unknown merchant types.
 */
export function getTransactionTypeConfig(merchantName: string): TransactionTypeConfig {
  const normalized = merchantName.trim();

  // Check for special handling
  if (normalized in TRANSACTION_TYPES) {
    return TRANSACTION_TYPES[normalized];
  }

  // Case-insensitive check for special handling
  const lowerName = normalized.toLowerCase();
  for (const [key, config] of Object.entries(TRANSACTION_TYPES)) {
    if (key.toLowerCase() === lowerName) {
      return config;
    }
  }

  // Warn about unknown merchant types (but still process them)
  if (normalized && !KNOWN_MERCHANT_TYPES.has(normalized)) {
    console.warn(`Unknown merchant type: "${normalized}" - using default (order-details)`);
  }

  // Default: items are on order details page
  return {
    itemSource: 'order-details',
    description: normalized || 'Unknown merchant type',
  };
}

/**
 * Check if we should skip fetching order details for this transaction.
 */
export function shouldSkipOrderDetails(merchantName: string): boolean {
  const config = getTransactionTypeConfig(merchantName);
  return config.itemSource === 'skip';
}

/**
 * Check if we need to navigate to a separate items page.
 */
export function needsItemsPage(merchantName: string): boolean {
  const config = getTransactionTypeConfig(merchantName);
  return config.itemSource === 'items-page';
}

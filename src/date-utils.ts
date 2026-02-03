/**
 * Date utilities for parsing and comparing transaction dates.
 */

/**
 * Parse a date string into a Date object.
 * Supports formats like "January 25, 2024" or any Date-parseable string.
 * @param dateStr - The date string to parse
 * @returns The parsed Date, or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }

  const date = new Date(dateStr);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Normalize a date to midnight (start of day) for comparison.
 * @param date - The date to normalize
 * @returns A new Date set to midnight
 */
export function normalizeToDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Check if a transaction date is before or on the end date.
 * Both dates are normalized to day boundaries for comparison.
 * @param transactionDate - The transaction date to check
 * @param endDate - The end date boundary
 * @returns true if transaction is on or before end date
 */
export function isOnOrBeforeDate(transactionDate: Date, endDate: Date): boolean {
  const txDay = normalizeToDay(transactionDate);
  const endDay = normalizeToDay(endDate);
  return txDay <= endDay;
}

/**
 * Check if a transaction date is strictly before the end date.
 * @param transactionDate - The transaction date to check
 * @param endDate - The end date boundary
 * @returns true if transaction is strictly before end date
 */
export function isBeforeDate(transactionDate: Date, endDate: Date): boolean {
  const txDay = normalizeToDay(transactionDate);
  const endDay = normalizeToDay(endDate);
  return txDay < endDay;
}

/**
 * Validate and parse an end_date variable.
 * @param endDateValue - The value to validate (from window.end_date)
 * @returns Object with parsed date and any validation error
 */
export function validateEndDate(endDateValue: unknown): { date: Date | null; error: string | null } {
  if (endDateValue === undefined || endDateValue === null) {
    return { date: null, error: null };
  }

  if (typeof endDateValue !== 'string') {
    return {
      date: null,
      error: `end_date must be a string (got ${typeof endDateValue})`,
    };
  }

  const parsed = parseDate(endDateValue);
  if (!parsed) {
    return {
      date: null,
      error: `Could not parse end_date: "${endDateValue}". Use format like "January 25, 2024"`,
    };
  }

  return { date: parsed, error: null };
}

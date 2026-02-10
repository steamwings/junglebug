// src/parser.ts
function extractOrderLinksFromTransactionsPage(doc) {
  const orderLinks = [];
  const linkElements = doc.querySelectorAll('a.a-link-normal[href*="orderID"]');
  linkElements.forEach((link) => {
    const anchor = link;
    const href = anchor.href;
    const text = anchor.textContent?.trim() || "";
    const orderIdMatch = href.match(/orderID=([A-Z0-9-]+)/i);
    if (orderIdMatch) {
      const orderId = orderIdMatch[1];
      const container = link.closest(".apx-transactions-line-item-component-container");
      let transactionDate = "";
      let transactionAmount = "";
      let paymentMethod = "";
      let merchantType = "";
      if (container) {
        const amountEl = container.querySelector(".a-size-base-plus.a-text-bold");
        if (amountEl) {
          transactionAmount = amountEl.textContent?.trim() || "";
        }
        const paymentEl = container.querySelector(".a-column.a-span9 .a-size-base.a-text-bold");
        if (paymentEl) {
          paymentMethod = paymentEl.textContent?.trim() || "";
        }
        const merchantSpans = container.querySelectorAll(".a-column.a-span12 .a-size-base");
        merchantSpans.forEach((span) => {
          const spanText = span.textContent?.trim() || "";
          if (spanText && !spanText.startsWith("Order #") && !spanText.startsWith("Refund:")) {
            merchantType = spanText;
          }
        });
        let prevElement = container.parentElement;
        while (prevElement) {
          const dateContainer = prevElement.querySelector(".apx-transaction-date-container span");
          if (dateContainer) {
            transactionDate = dateContainer.textContent?.trim() || "";
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
        paymentMethod,
        merchantType
      });
    }
  });
  return orderLinks;
}
function parseOrderDetailsPage(doc, orderId) {
  const items = [];
  const itemContainers = doc.querySelectorAll('[data-component="purchasedItems"]');
  itemContainers.forEach((container) => {
    const titleElements = container.querySelectorAll('[data-component="itemTitle"] a.a-link-normal');
    const priceElements = container.querySelectorAll(".a-price .a-offscreen");
    titleElements.forEach((titleEl, index) => {
      const itemName = titleEl.textContent?.trim() || "";
      const itemPrice = priceElements[index]?.textContent?.trim() || "";
      const itemUrl = titleEl.href || "";
      const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
      const asin = asinMatch ? asinMatch[1] : "";
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
  if (items.length === 0) {
    const titleElements = doc.querySelectorAll('[data-component="itemTitle"] a.a-link-normal');
    const priceElements = doc.querySelectorAll(".a-price .a-offscreen");
    titleElements.forEach((titleEl, index) => {
      const itemName = titleEl.textContent?.trim() || "";
      const itemUrl = titleEl?.href || "";
      const itemPrice = priceElements[index]?.textContent?.trim() || "";
      const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
      const asin = asinMatch ? asinMatch[1] : "";
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
  const orderDateEl = doc.querySelector('[data-component="orderPlacedLabel"] + [data-component="orderPlacedDate"] span, .order-date-invoice-item span');
  const orderPlacedDate = orderDateEl?.textContent?.trim() || "";
  const orderTotalEl = doc.querySelector(".a-text-bold .a-color-base");
  const orderTotal = orderTotalEl?.textContent?.trim() || "";
  return {
    orderId,
    orderPlacedDate,
    orderTotal,
    items
  };
}
function parseHtml(html) {
  const parser = new DOMParser;
  return parser.parseFromString(html, "text/html");
}
function extractItemsPageUrl(doc) {
  const links = doc.querySelectorAll("a.a-link-normal");
  for (const link of links) {
    const text = link.textContent?.trim().toLowerCase() || "";
    if (text.includes("view all items") || text.includes("view items")) {
      return link.href || null;
    }
  }
  return null;
}
function parseItemsPage(doc, orderId) {
  const items = [];
  const productLinks = doc.querySelectorAll('a[href*="/dp/"]');
  productLinks.forEach((link) => {
    const anchor = link;
    const itemUrl = anchor.href || "";
    const asinMatch = itemUrl.match(/\/dp\/([A-Z0-9]+)/i);
    const asin = asinMatch ? asinMatch[1] : "";
    let itemName = anchor.textContent?.trim() || "";
    if (!itemName) {
      const img = anchor.querySelector("img[alt]");
      if (img) {
        itemName = img.getAttribute("alt") || "";
      }
    }
    if (!itemName || !asin) {
      return;
    }
    if (items.some((item) => item.asin === asin)) {
      return;
    }
    const itemPrice = "";
    items.push({
      itemName,
      itemPrice,
      itemUrl,
      asin
    });
  });
  return {
    orderId,
    orderPlacedDate: "",
    orderTotal: "",
    items
  };
}

// src/transaction-types.ts
var TRANSACTION_TYPES = {
  "Amazon Tips": {
    itemSource: "skip",
    description: "Delivery tips - order details appear in main transaction"
  },
  "Amazon Grocery": {
    itemSource: "items-page",
    description: "Amazon Grocery - items on separate page"
  }
};
var KNOWN_MERCHANT_TYPES = new Set([
  "AMZN Mktp US",
  "Amazon.com",
  "Prime Video Channels",
  "Audible",
  "Amazon Tips",
  "Amazon Grocery"
]);
function getTransactionTypeConfig(merchantName) {
  const normalized = merchantName.trim();
  if (normalized in TRANSACTION_TYPES) {
    return TRANSACTION_TYPES[normalized];
  }
  const lowerName = normalized.toLowerCase();
  for (const [key, config] of Object.entries(TRANSACTION_TYPES)) {
    if (key.toLowerCase() === lowerName) {
      return config;
    }
  }
  if (normalized && !KNOWN_MERCHANT_TYPES.has(normalized)) {
    console.warn(`Unknown merchant type: "${normalized}" - using default (order-details)`);
  }
  return {
    itemSource: "order-details",
    description: normalized || "Unknown merchant type"
  };
}
function shouldSkipOrderDetails(merchantName) {
  const config = getTransactionTypeConfig(merchantName);
  return config.itemSource === "skip";
}
function needsItemsPage(merchantName) {
  const config = getTransactionTypeConfig(merchantName);
  return config.itemSource === "items-page";
}

// src/date-utils.ts
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}
function normalizeToDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}
function isBeforeDate(transactionDate, endDate) {
  const txDay = normalizeToDay(transactionDate);
  const endDay = normalizeToDay(endDate);
  return txDay < endDay;
}
function validateEndDate(endDateValue) {
  if (endDateValue === undefined || endDateValue === null) {
    return { date: null, error: null };
  }
  if (typeof endDateValue !== "string") {
    return {
      date: null,
      error: `end_date must be a string (got ${typeof endDateValue})`
    };
  }
  const parsed = parseDate(endDateValue);
  if (!parsed) {
    return {
      date: null,
      error: `Could not parse end_date: "${endDateValue}". Use format like "January 25, 2024"`
    };
  }
  return { date: parsed, error: null };
}

// src/scraper.ts
var DELAY_BETWEEN_REQUESTS = 1000;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "text/html"
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
function getOldestTransactionDate(orderLinks) {
  let oldest = null;
  for (const order of orderLinks) {
    if (!order.transactionDate)
      continue;
    const date = parseDate(order.transactionDate);
    if (!date)
      continue;
    if (!oldest || date < oldest) {
      oldest = date;
    }
  }
  return oldest;
}
function clickNextPage(doc) {
  const nextPageInput = doc.querySelector('input[name^="ppw-widgetEvent:DefaultNextPageNavigationEvent"]');
  if (!nextPageInput) {
    console.log("No Next Page button found");
    return false;
  }
  const buttonSpan = nextPageInput.closest(".a-button");
  if (buttonSpan?.classList.contains("a-button-disabled")) {
    console.log("Next Page button is disabled");
    return false;
  }
  console.log("Clicking Next Page...");
  nextPageInput.click();
  return true;
}
async function processOrder(order) {
  const config = getTransactionTypeConfig(order.merchantType);
  if (shouldSkipOrderDetails(order.merchantType)) {
    console.log(`  Skipping: ${config.description}`);
    return {
      ...order,
      orderId: order.orderId,
      orderPlacedDate: "",
      orderTotal: "",
      items: []
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
          const orderDetails2 = parseItemsPage(itemsDoc, order.orderId);
          console.log(`  Found ${orderDetails2.items.length} item(s) from items page`);
          return { ...order, ...orderDetails2 };
        }
      }
      const orderDetails = parseOrderDetailsPage(detailsDoc, order.orderId);
      console.log(`  Found ${orderDetails.items.length} item(s) from details page`);
      return { ...order, ...orderDetails };
    }
    return {
      ...order,
      orderId: order.orderId,
      orderPlacedDate: "",
      orderTotal: "",
      items: [],
      error: "Failed to fetch order details"
    };
  }
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
    orderPlacedDate: "",
    orderTotal: "",
    items: [],
    error: "Failed to fetch order details"
  };
}
async function processCurrentPage(orderLinks, endDate) {
  const results = [];
  for (let i = 0;i < orderLinks.length; i++) {
    const order = orderLinks[i];
    if (endDate && order.transactionDate) {
      const txDate = parseDate(order.transactionDate);
      if (txDate && isBeforeDate(txDate, endDate)) {
        console.log(`Transaction ${order.orderId} (${order.transactionDate}) is before end_date, stopping`);
        return { results, shouldContinue: false };
      }
    }
    console.log(`Processing ${i + 1}/${orderLinks.length}: Order ${order.orderId} (${order.merchantType || "unknown"})`);
    const result = await processOrder(order);
    results.push(result);
    if (i < orderLinks.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  return { results, shouldContinue: endDate !== null };
}
async function outputResults(results) {
  console.log(`
=== SCRAPING COMPLETE ===
`);
  console.log("Results:", results);
  console.log(`
=== TRANSACTION SUMMARY ===
`);
  results.forEach((r) => {
    console.log(`Order: ${r.orderId}`);
    console.log(`  Date: ${r.transactionDate}`);
    console.log(`  Amount: ${r.transactionAmount}`);
    console.log(`  Merchant: ${r.merchantType}`);
    console.log(`  Payment: ${r.paymentMethod}`);
    if (r.items && r.items.length > 0) {
      console.log(`  Items:`);
      r.items.forEach((item) => {
        console.log(`    - ${item.itemName}`);
        if (item.itemPrice) {
          console.log(`      Price: ${item.itemPrice}`);
        }
      });
    }
    console.log("");
  });
  const jsonOutput = JSON.stringify(results, null, 2);
  try {
    await navigator.clipboard.writeText(jsonOutput);
    console.log("Results copied to clipboard as JSON!");
  } catch (e) {
    console.log('Could not copy to clipboard. Results available in the "results" variable above.');
  }
  window.amazonTransactionResults = results;
  console.log(`
Results also available as: window.amazonTransactionResults`);
}
async function scrapeAmazonTransactions() {
  console.log("Starting Amazon Transaction Scraper...");
  const { date: endDate, error: dateError } = validateEndDate(window.end_date);
  if (dateError) {
    console.error(`Error: ${dateError}`);
    return [];
  }
  if (endDate) {
    console.log(`Pagination enabled: will scrape until reaching ${endDate.toDateString()}`);
  } else {
    console.log("No end_date set: will scrape current page only");
  }
  const allResults = [];
  let pageNum = 1;
  while (true) {
    console.log(`
=== Page ${pageNum} ===`);
    console.log("Finding order links on the transactions page...");
    const orderLinks = extractOrderLinksFromTransactionsPage(document);
    console.log(`Found ${orderLinks.length} transactions`);
    if (orderLinks.length === 0) {
      console.log("No transactions found on this page");
      break;
    }
    const oldestDate = getOldestTransactionDate(orderLinks);
    if (oldestDate) {
      console.log(`Oldest transaction on this page: ${oldestDate.toDateString()}`);
    }
    const { results, shouldContinue } = await processCurrentPage(orderLinks, endDate);
    allResults.push(...results);
    if (!shouldContinue) {
      console.log("Reached end_date or no more pages needed");
      break;
    }
    console.log(`
Need to fetch more transactions...`);
    if (!clickNextPage(document)) {
      console.log("Cannot navigate to next page");
      break;
    }
    console.log("Waiting for next page to load...");
    await sleep(3000);
    pageNum++;
    if (pageNum > 50) {
      console.warn("Reached maximum page limit (50), stopping");
      break;
    }
  }
  await outputResults(allResults);
  return allResults;
}
scrapeAmazonTransactions();

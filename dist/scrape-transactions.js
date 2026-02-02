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
    const titleEl = container.querySelector('[data-component="itemTitle"] a.a-link-normal');
    const itemName = titleEl?.textContent?.trim() || "";
    const priceEl = container.querySelector(".a-price .a-offscreen");
    const itemPrice = priceEl?.textContent?.trim() || "";
    const itemUrl = titleEl?.href || "";
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
async function scrapeAmazonTransactions() {
  console.log("Starting Amazon Transaction Scraper...");
  console.log("Finding order links on the transactions page...");
  const orderLinks = extractOrderLinksFromTransactionsPage(document);
  console.log(`Found ${orderLinks.length} transactions`);
  const results = [];
  for (let i = 0;i < orderLinks.length; i++) {
    const order = orderLinks[i];
    const config = getTransactionTypeConfig(order.merchantType);
    console.log(`Processing ${i + 1}/${orderLinks.length}: Order ${order.orderId} (${order.merchantType || "unknown"})`);
    if (shouldSkipOrderDetails(order.merchantType)) {
      console.log(`  Skipping: ${config.description}`);
      results.push({
        ...order,
        orderId: order.orderId,
        orderPlacedDate: "",
        orderTotal: "",
        items: []
      });
    } else if (needsItemsPage(order.merchantType)) {
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
            results.push({
              ...order,
              ...orderDetails
            });
            console.log(`  Found ${orderDetails.items.length} item(s) from items page`);
          } else {
            results.push({
              ...order,
              orderId: order.orderId,
              orderPlacedDate: "",
              orderTotal: "",
              items: [],
              error: "Failed to fetch items page"
            });
          }
        } else {
          const orderDetails = parseOrderDetailsPage(detailsDoc, order.orderId);
          results.push({
            ...order,
            ...orderDetails
          });
          console.log(`  Found ${orderDetails.items.length} item(s) from details page`);
        }
      } else {
        results.push({
          ...order,
          orderId: order.orderId,
          orderPlacedDate: "",
          orderTotal: "",
          items: [],
          error: "Failed to fetch order details"
        });
      }
    } else {
      const html = await fetchPage(order.orderUrl);
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
          orderPlacedDate: "",
          orderTotal: "",
          items: [],
          error: "Failed to fetch order details"
        });
      }
    }
    if (i < orderLinks.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
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
  return results;
}
scrapeAmazonTransactions();

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
      if (container) {
        const amountEl = container.querySelector(".a-size-base-plus.a-text-bold");
        if (amountEl) {
          transactionAmount = amountEl.textContent?.trim() || "";
        }
        const paymentEl = container.querySelector(".a-column.a-span9 .a-size-base.a-text-bold");
        if (paymentEl) {
          paymentMethod = paymentEl.textContent?.trim() || "";
        }
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
        paymentMethod
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

// src/scraper.ts
var DELAY_BETWEEN_REQUESTS = 1000;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchOrderDetails(orderUrl) {
  try {
    const response = await fetch(orderUrl, {
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
    console.error(`Failed to fetch ${orderUrl}:`, error);
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
        orderPlacedDate: "",
        orderTotal: "",
        items: [],
        error: "Failed to fetch order details"
      });
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
    console.log(`  Payment: ${r.paymentMethod}`);
    console.log(`  Items:`);
    (r.items || []).forEach((item) => {
      console.log(`    - ${item.itemName}`);
      console.log(`      Price: ${item.itemPrice}`);
    });
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

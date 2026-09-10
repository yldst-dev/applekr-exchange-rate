import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoverProductUrls,
  extractJson,
  parseAccessoryPage,
  parseProductPage,
  safeImage,
} from "../server/infrastructure/apple-parser.js";
import { mergeRegions } from "../server/infrastructure/apple.js";
import { assertSourceUrl } from "../server/infrastructure/http.js";
const checkedAt = "2026-01-01T00:00:00Z";
function page(data: unknown) {
  return `<html><h1>Example</h1><script>window.PRODUCT_SELECTION_BOOTSTRAP = { productSelectionData: ${JSON.stringify(data)} }</script></html>`;
}
test("JSON extraction handles braces inside strings and never executes scripts", () => {
  const expected = { text: 'a } { "', nested: { x: 1 } };
  assert.deepEqual(
    extractJson(
      "productSelectionData: " +
        JSON.stringify(expected) +
        ";throw new Error()",
      "productSelectionData:",
    ),
    expected,
  );
  assert.deepEqual(
    extractJson(
      'productSelectionData: {"x": process.exit(1)}',
      "productSelectionData:",
    ),
    {},
  );
});
test("discovery includes script-rendered product links and normalizes US goto links", () => {
  const html = `<script>const x='<a href="/kr/shop/buy-mac/example/option">Buy</a>'</script><a href="https://evil.example/shop/buy-mac/unsafe">X</a>`;
  assert.deepEqual(discoverProductUrls(html, "kr"), [
    "https://www.apple.com/kr/shop/buy-mac/example",
  ]);
  assert.deepEqual(
    discoverProductUrls(
      '<a href="/us/shop/goto/buy_vision/apple_vision_pro">Buy</a>',
      "us",
    ),
    ["https://www.apple.com/shop/buy-vision/apple-vision-pro"],
  );
});
test("unlocked prices are used and installment or carrier offers do not win", () => {
  const data = {
    products: [
      {
        familyType: "phone",
        fullPrice: "carrier",
        isCarrierDevice: true,
        dimensionCapacity: "256gb",
      },
      {
        familyType: "phone",
        fullPrice: "unlocked",
        carrierPolicyType: "UNLOCKED",
        dimensionCapacity: "256gb",
      },
    ],
    displayValues: {
      prices: {
        carrier: { currentPrice: { raw_amount: "30" } },
        unlocked: { currentPrice: { raw_amount: "999" }, priceCurrency: "USD" },
      },
    },
  };
  const result = parseProductPage(
    page(data),
    "https://www.apple.com/shop/buy-iphone/example",
    "us",
    checkedAt,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].us?.amount, 999);
});
test("Mac matching ignores regional bundle codes but preserves hardware differences", () => {
  const create = (region: "kr" | "us", memory: string) =>
    parseProductPage(
      page({
        products: [
          {
            priceKey: "standard",
            dimensions: { "chassis-dimensionScreensize": "13inch" },
            productConfiguration: {
              processor: "chip",
              memory,
              storage: "disk",
              keyboard: region,
              countrykit: region,
              power_adapter: region,
              ...(region === "kr" ? { software_final: "none" } : {}),
            },
          },
        ],
        mainDisplayValues: {
          prices: { standard: { amount: region === "kr" ? 2200000 : 1000 } },
        },
      }),
      `https://www.apple.com/${region === "kr" ? "kr/" : ""}shop/buy-mac/example`,
      region,
      checkedAt,
    );
  const merged = mergeRegions([
    ...create("kr", "16gb"),
    ...create("us", "16gb"),
    ...create("us", "32gb"),
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged.filter((product) => product.kr && product.us).length, 1);
});
test("accessories match exact base part numbers and retain pagination", () => {
  const html =
    "window.pageLevelData.categoryResults = " +
    JSON.stringify({
      results: {
        tiles: [
          {
            partNumber: "EX123KH/A",
            basePartNumber: "EX123",
            title: "Example accessory",
            link: { url: "/kr/shop/product/ex123kh/a/example" },
            productPrice: { priceCurrent: "₩55,000", priceCurrency: "KRW" },
          },
        ],
      },
      nextLink:
        "https://www.apple.com/kr/shop/accessories/all/made-by-apple?page=2",
    });
  const result = parseAccessoryPage(html, "kr", checkedAt);
  assert.equal(result.products[0].kr?.amount, 55000);
  assert.equal(
    result.next,
    "https://www.apple.com/kr/shop/accessories/all/made-by-apple?page=2",
  );
});
test("external input cannot change the fetch host or image protocol", () => {
  for (const url of [
    "http://www.apple.com",
    "https://www.apple.com.evil.example/",
    "https://127.0.0.1/",
    "https://www.apple.com:444/",
    "https://name:secret@www.apple.com/",
  ])
    assert.throws(() => assertSourceUrl(url));
  assert.equal(safeImage("javascript:alert(1)"), null);
  assert.equal(safeImage("https://evil.example/image.png"), null);
});
test("fallback starting prices never masquerade as option-specific prices", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Example", offers: { lowPrice: 999, priceCurrency: "USD" } })}</script>`;
  const result = parseProductPage(
    html,
    "https://www.apple.com/shop/buy-mac/example",
    "us",
    checkedAt,
  );
  assert.equal(result[0].basis, "starting");
  assert.equal(result[0].us?.amount, 999);
});

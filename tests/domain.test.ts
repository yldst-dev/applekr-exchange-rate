import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateExchange } from "../src/domain/calculate.js";
import {
  nextDailySync,
  synchronize,
  shouldSync,
} from "../src/application/synchronize.js";
import {
  emptyCatalog,
  type CatalogSnapshot,
  type Product,
} from "../src/domain/catalog.js";

const product: Product = {
  id: "example",
  family: "example",
  name: "Example",
  category: "Mac",
  specification: "16GB",
  basis: "configuration",
  image: null,
  kr: {
    amount: 2200000,
    currency: "KRW",
    checkedAt: "2026-01-01T00:00:00Z",
    url: "https://www.apple.com/kr/shop/buy-mac/example",
  },
  us: {
    amount: 1000,
    currency: "USD",
    checkedAt: "2026-01-01T00:00:00Z",
    url: "https://www.apple.com/shop/buy-mac/example",
  },
};
const rate = {
  rate: 1500,
  date: "2026-01-01",
  fetchedAt: "2026-01-01T00:00:00Z",
  source: "Example",
  url: "https://api.frankfurter.dev/",
};
function memoryStore(initial: CatalogSnapshot) {
  let value = initial;
  return {
    read: async () => structuredClone(value),
    write: async (next: CatalogSnapshot) => {
      value = structuredClone(next);
    },
  };
}
test("VAT is removed by division and the price gap uses the same tax basis", () => {
  const value = calculateExchange(2200000, 1000, 1500);
  assert.ok(Math.abs(value.appleRate - 2000) < 1e-8);
  assert.ok(Math.abs(value.vat - 200000) < 1e-8);
  assert.ok(Math.abs(value.expectedPrice - 1650000) < 1e-8);
  assert.ok(Math.abs(value.priceDifference - 550000) < 1e-8);
  assert.ok(Math.abs(value.premiumPercent - 100 / 3) < 1e-8);
});
test("display-price mode includes Korean VAT without adding it twice", () => {
  const value = calculateExchange(2200000, 1000, 1500, false);
  assert.equal(value.appleRate, 2200);
  assert.equal(value.expectedPrice, 1500000);
  assert.equal(value.priceDifference, 700000);
});
test("invalid prices and exchange rates are rejected", () => {
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => calculateExchange(invalid, 1000, 1500));
    assert.throws(() => calculateExchange(2000000, invalid, 1500));
    assert.throws(() => calculateExchange(2000000, 1000, invalid));
  }
});
test("daily schedule uses Korea time at the exact boundary and across year end", () => {
  assert.equal(
    nextDailySync(new Date("2026-12-31T23:59:59Z")).toISOString(),
    "2027-01-01T00:00:00.000Z",
  );
  assert.equal(
    nextDailySync(new Date("2027-01-01T00:00:00Z")).toISOString(),
    "2027-01-02T00:00:00.000Z",
  );
  assert.equal(
    nextDailySync(new Date("2026-01-01T10:00:00Z"), 23).toISOString(),
    "2026-01-01T14:00:00.000Z",
  );
});
test("source outage preserves verified values and their original timestamps", async () => {
  const store = memoryStore({
    ...emptyCatalog(),
    products: [product],
    exchangeRate: rate,
  });
  const result = await synchronize(
    store,
    {
      collect: async () => {
        throw new Error("offline");
      },
    },
    {
      latest: async () => {
        throw new Error("offline");
      },
    },
  );
  assert.deepEqual(result.products, [product]);
  assert.deepEqual(result.exchangeRate, rate);
  assert.equal(result.issues.length, 2);
  assert.equal(result.completedAt, null);
});
test("partial collection preserves only failed sources and removes discontinued products", async () => {
  const removed = {
    ...product,
    id: "removed",
    kr: {
      ...product.kr!,
      url: "https://www.apple.com/kr/shop/buy-ipad/removed",
    },
    us: null,
  };
  const store = memoryStore({
    ...emptyCatalog(),
    products: [product, removed],
  });
  const fresh = {
    ...product,
    kr: null,
    us: { ...product.us!, amount: 1200, checkedAt: "2026-01-02T00:00:00Z" },
  };
  const result = await synchronize(
    store,
    {
      collect: async () => ({
        products: [fresh],
        issues: [{ source: product.kr!.url, message: "offline" }],
      }),
    },
    { latest: async () => rate },
  );
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.products[0].kr, product.kr);
  assert.equal(result.products[0].us?.amount, 1200);
});
test("successful collection replaces old catalog and records completion", async () => {
  const store = memoryStore(emptyCatalog());
  const now = new Date("2026-01-02T00:00:00Z");
  const result = await synchronize(
    store,
    { collect: async () => ({ products: [product], issues: [] }) },
    { latest: async () => rate },
    now,
  );
  assert.equal(result.completedAt, now.toISOString());
  assert.deepEqual(await store.read(), result);
});

test("startup and restarts do not collect twice on the same Korean date", () => {
  assert.equal(
    shouldSync(new Date("2026-01-02T00:00:00Z"), "2026-01-01T18:00:00Z"),
    false,
  );
  assert.equal(
    shouldSync(new Date("2026-01-03T00:00:00Z"), "2026-01-01T18:00:00Z"),
    true,
  );
  assert.equal(
    shouldSync(new Date("2026-01-02T18:00:00Z"), "2026-01-02T00:00:00Z"),
    false,
  );
  assert.equal(shouldSync(new Date("2026-01-02T18:00:00Z"), null), true);
});

test("next visible schedule skips the date already collected at startup", () => {
  assert.equal(
    nextDailySync(
      new Date("2026-01-01T18:00:00Z"),
      9,
      "2026-01-01T18:00:00Z",
    ).toISOString(),
    "2026-01-03T00:00:00.000Z",
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { rankProducts } from "../src/domain/rank-products.js";
import type { Product } from "../src/domain/catalog.js";
const now = Date.parse("2026-01-02T00:00:00Z");
const create = (id: string, family: string, price: number): Product => ({ id, family, name: family, category: "Mac", specification: "16GB", image: null, basis: "configuration", kr: { amount: price, currency: "KRW", url: "https://www.apple.com/kr/", checkedAt: "2026-01-01T00:00:00Z" }, us: { amount: 1000, currency: "USD", url: "https://www.apple.com/", checkedAt: "2026-01-01T00:00:00Z" } });
test("ranking picks the cheapest exchange ratio per family, sorts and limits", () => {
  const result = rankProducts([create("a", "Mac", 2200000), create("b", "Mac", 1100000), create("c", "iPad", 1650000), create("d", "iPhone", 1980000)], 1500, true, now, 2);
  assert.deepEqual(result.map(entry => entry.product.id), ["b", "c"]);
  assert.ok(Math.abs(result[0].appleRate - 1000) < 1e-8);
  const gross = rankProducts([create("b", "Mac", 1100000)], 1500, false, now);
  assert.equal(gross[0].appleRate, 1100);
});
test("ranking rejects unavailable, stale and invalid prices", () => {
  const old = create("old", "Old", 1000); old.kr!.checkedAt = "2025-12-01T00:00:00Z";
  const missing = create("missing", "Missing", 1000); missing.us = null;
  assert.deepEqual(rankProducts([old, missing, create("invalid", "Invalid", NaN)], 1500, true, now), []);
  assert.deepEqual(rankProducts([create("ok", "Mac", 1000)], 0, true, now), []);
});

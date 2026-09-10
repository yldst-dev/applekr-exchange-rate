import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { emptyCatalog, type CatalogSnapshot } from "../src/domain/catalog.js";
import { catalogResponse, parseCatalogSnapshot } from "../server/infrastructure/catalog-snapshot.js";
import { deployedCatalogUrl, readDeployedCatalog } from "../server/infrastructure/deployed-catalog.js";

const snapshot: CatalogSnapshot = {
  ...emptyCatalog(),
  attemptedAt: "2026-09-10T00:00:00.000Z",
  completedAt: "2026-09-10T00:00:00.000Z",
  products: [{
    id: "test-product", family: "test", name: "Test", category: "Mac",
    specification: "16GB", image: null, basis: "configuration", us: null,
    kr: { amount: 2200000, currency: "KRW", checkedAt: "2026-09-10T00:00:00.000Z", url: "https://www.apple.com/kr/shop/buy-mac/test" },
  }],
  exchangeRate: { rate: 1300, date: "2026-09-09", fetchedAt: "2026-09-10T00:00:00.000Z", source: "ECB", url: "https://api.frankfurter.dev/v2/rates" },
};

test("deployment exports preserve verified timestamps and omit transient state", () => {
  const response = catalogResponse(snapshot, new Date("2026-09-10T04:00:00Z"));
  assert.equal(response.syncing, false);
  assert.equal(response.nextSyncAt, "2026-09-11T00:00:00.000Z");
  assert.deepEqual(parseCatalogSnapshot({ ...response, syncing: true, privateValue: "omit" }), snapshot);
});

test("deployment rejects empty, corrupt, duplicate and unsafe price data", () => {
  for (const value of [
    emptyCatalog(),
    { ...snapshot, exchangeRate: { ...snapshot.exchangeRate, rate: 0 } },
    { ...snapshot, products: [snapshot.products[0], snapshot.products[0]] },
    { ...snapshot, attemptedAt: "invalid" },
    { ...snapshot, products: [{ ...snapshot.products[0], kr: { ...snapshot.products[0].kr, currency: "USD" } }] },
    { ...snapshot, products: [{ ...snapshot.products[0], image: "javascript:alert(1)" }] },
  ]) assert.throws(() => parseCatalogSnapshot(value));
});

test("previous deployment URLs reject credentials, other origins and redirects", async () => {
  for (const value of ["http://app.workers.dev", "https://evil.example", "https://app.workers.dev.evil.example", "https://user:pass@app.workers.dev", "https://app.workers.dev/path", "https://app.workers.dev?url=x"]) {
    assert.throws(() => deployedCatalogUrl(value));
  }
  const spy = mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, "error");
    return Response.json(snapshot);
  });
  try {
    assert.deepEqual(await readDeployedCatalog("https://app.workers.dev"), snapshot);
  } finally {
    spy.mock.restore();
  }
});

test("only a missing deployment permits bootstrap; outages and HTML fail closed", async () => {
  for (const [response, missing] of [
    [new Response("missing", { status: 404 }), true],
    [new Response("outage", { status: 503 }), false],
    [new Response("<html></html>", { headers: { "Content-Type": "text/html" } }), false],
  ] as const) {
    const spy = mock.method(globalThis, "fetch", async () => response);
    try {
      if (missing) assert.equal(await readDeployedCatalog("https://app.workers.dev"), null);
      else await assert.rejects(() => readDeployedCatalog("https://app.workers.dev"));
    } finally {
      spy.mock.restore();
    }
  }
});

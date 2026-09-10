import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetiredPurchasePage } from "../server/infrastructure/apple.js";
import { fetchPage } from "../server/infrastructure/http.js";

test("only same-region family redirects retire purchase pages", () => {
  for (const prefix of ["", "kr/"]) {
    const source = `https://www.apple.com/${prefix}shop/buy-ipad/ipad-10-2`;
    assert.equal(isRetiredPurchasePage(source, `https://www.apple.com/${prefix}ipad/`), true);
    assert.equal(isRetiredPurchasePage(source, `https://www.apple.com/${prefix}shop/buy-ipad`), true);
    for (const target of [source, "https://www.apple.com/", "https://www.apple.com/shop/buy-ipad/ipad-air", "https://www.apple.com/kr/mac/", "https://example.com/ipad/"]) {
      assert.equal(isRetiredPurchasePage(source, target), false);
    }
  }
  assert.equal(isRetiredPurchasePage("https://www.apple.com/kr/shop/buy-ipad/ipad-10-2", "https://www.apple.com/ipad/"), false);
});

test("fetchPage retains final URL and rejects unsafe redirects and server failures", async (context) => {
  const mock = context.mock.method(globalThis, "fetch");
  mock.mock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/kr/ipad/" } }));
  mock.mock.mockImplementationOnce(async () => new Response("overview", { status: 200 }), 1);
  assert.deepEqual(await fetchPage("https://www.apple.com/kr/shop/buy-ipad/ipad-10-2"), { text: "overview", url: "https://www.apple.com/kr/ipad/" });
  mock.mock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://example.com/" } }));
  await assert.rejects(fetchPage("https://www.apple.com/ipad/"), /허용되지 않은/);
  mock.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(fetchPage("https://www.apple.com/ipad/"), /503/);
});

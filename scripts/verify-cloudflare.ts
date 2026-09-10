import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { readDeployedCatalog } from "../server/infrastructure/deployed-catalog.js";
import { parseCatalogSnapshot } from "../server/infrastructure/catalog-snapshot.js";

const site = process.env.DEPLOYED_SITE_URL;
if (!site) throw new Error("DEPLOYED_SITE_URL 설정이 필요합니다.");
const expected = parseCatalogSnapshot(JSON.parse(await readFile("dist/api/catalog", "utf8")));
let verified = false;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const actual = await readDeployedCatalog(site);
    assert.deepEqual(actual, expected);
    const response: Response = await fetch(site, { signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="root"/);
    const metadata = load(html);
    const canonical = metadata('meta[property="og:url"]').attr("content");
    const image = metadata('meta[property="og:image"]').attr("content");
    assert.ok(canonical && image);
    assert.equal(new URL(image).origin, new URL(canonical).origin);
    assert.ok(metadata('meta[property="og:title"]').attr("content"));
    assert.ok(metadata('meta[property="og:description"]').attr("content"));
    const headers = { "User-Agent": "TelegramBot (like TwitterBot)" };
    const [preview, thumbnail] = await Promise.all([
      fetch(canonical, { headers, signal: AbortSignal.timeout(15_000) }),
      fetch(image, { headers, signal: AbortSignal.timeout(15_000) }),
    ]);
    assert.equal(preview.status, 200);
    assert.equal(thumbnail.status, 200);
    assert.equal(load(await preview.text())('meta[property="og:image"]').attr("content"), image);
    assert.match(thumbnail.headers.get("Content-Type") ?? "", /image\/png/);
    const png = Buffer.from(await thumbnail.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    verified = true;
    break;
  } catch {
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}
if (!verified) throw new Error("배포된 화면, 가격 데이터 또는 링크 미리보기를 확인하지 못했습니다.");
console.log(JSON.stringify({ event: "deployment_verified", products: expected.products.length }));

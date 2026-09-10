import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    assert.match(await response.text(), /id="root"/);
    verified = true;
    break;
  } catch {
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}
if (!verified) throw new Error("배포된 화면 또는 가격 데이터가 빌드 결과와 일치하지 않습니다.");
console.log(JSON.stringify({ event: "deployment_verified", products: expected.products.length }));

import { synchronize, shouldSync } from "../src/application/synchronize.js";
import { ApplePriceSource } from "./infrastructure/apple.js";
import { FrankfurterSource } from "./infrastructure/frankfurter.js";
import { FileCatalogStore } from "./infrastructure/store.js";
import { parseCatalogSnapshot } from "./infrastructure/catalog-snapshot.js";
import { readDeployedCatalog } from "./infrastructure/deployed-catalog.js";

const store = new FileCatalogStore(process.env.DATA_DIR ?? "./data-cloudflare");
const deployedSite = process.env.DEPLOYED_SITE_URL;
if (deployedSite) {
  const deployed = await readDeployedCatalog(deployedSite);
  if (deployed) await store.write(deployed);
}
let snapshot = await store.read();
const now = new Date();
if (process.argv.includes("--refresh") || !snapshot.products.length ||
  shouldSync(now, snapshot.attemptedAt, 9)) {
  snapshot = await synchronize(store, new ApplePriceSource(), new FrankfurterSource(), now);
}
parseCatalogSnapshot(snapshot);
console.log(JSON.stringify({
  event: "catalog_prepared",
  products: snapshot.products.length,
  issues: snapshot.issues.length,
  attemptedAt: snapshot.attemptedAt,
}));

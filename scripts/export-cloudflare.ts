import { mkdir, writeFile } from "node:fs/promises";
import { FileCatalogStore } from "../server/infrastructure/store.js";
import { catalogResponse, parseCatalogSnapshot } from "../server/infrastructure/catalog-snapshot.js";

const snapshot = parseCatalogSnapshot(
  await new FileCatalogStore(process.env.DATA_DIR ?? "./data-cloudflare").read(),
);
const catalog = catalogResponse(snapshot);
await mkdir("dist/api", { recursive: true });
await writeFile("dist/api/catalog", JSON.stringify(catalog));
await writeFile("dist/api/health", JSON.stringify({
  status: "ok",
  ready: true,
  syncing: false,
  attemptedAt: snapshot.attemptedAt,
  completedAt: snapshot.completedAt,
  issues: snapshot.issues.length,
}));
console.log(JSON.stringify({ event: "catalog_exported", products: snapshot.products.length }));

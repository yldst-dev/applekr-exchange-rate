import {
  categories,
  type CatalogSnapshot,
  type CatalogResponse,
} from "../../src/domain/catalog.js";
import { nextDailySync } from "../../src/application/synchronize.js";

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 8192;
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const source = (value: unknown, hosts: string[]) => {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname) &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
};
const quote = (value: unknown, currency: "KRW" | "USD") =>
  value === null || (object(value) && positive(value.amount) &&
    value.currency === currency && date(value.checkedAt) &&
    source(value.url, ["www.apple.com"]));

function assertCatalogSnapshot(value: unknown): asserts value is CatalogSnapshot {
  if (!object(value) || value.version !== 1 ||
    !Array.isArray(value.products) || !value.products.length ||
    !Array.isArray(value.issues) || !object(value.exchangeRate) ||
    !positive(value.exchangeRate.rate) || !date(value.exchangeRate.date) ||
    !date(value.exchangeRate.fetchedAt) || !text(value.exchangeRate.source) ||
    !source(value.exchangeRate.url, ["api.frankfurter.dev", "www.ecb.europa.eu"]) ||
    !date(value.attemptedAt) ||
    !(value.completedAt === null || date(value.completedAt))) {
    throw new Error("배포할 가격 데이터 형식이 올바르지 않습니다.");
  }
  const ids = new Set<string>();
  for (const product of value.products) {
    if (!object(product) || !text(product.id) || ids.has(product.id) ||
      !text(product.family) || !text(product.name) ||
      typeof product.specification !== "string" ||
      !categories.some(category => category === product.category) ||
      !["configuration", "starting"].includes(String(product.basis)) ||
      !(product.image === null || source(product.image, ["www.apple.com", "store.storeimages.cdn-apple.com"])) ||
      !quote(product.kr, "KRW") || !quote(product.us, "USD") ||
      (!product.kr && !product.us)) {
      throw new Error("배포할 제품 정보가 올바르지 않습니다.");
    }
    ids.add(product.id);
  }
  if (!value.issues.every(issue => object(issue) && text(issue.source) && text(issue.message)))
    throw new Error("가격 수집 상태가 올바르지 않습니다.");
}

export function parseCatalogSnapshot(value: unknown): CatalogSnapshot {
  assertCatalogSnapshot(value);
  const { version, products, exchangeRate, attemptedAt, completedAt, issues } = value;
  return { version, products, exchangeRate, attemptedAt, completedAt, issues };
}

export function catalogResponse(snapshot: CatalogSnapshot, now = new Date()): CatalogResponse {
  return {
    ...snapshot,
    syncing: false,
    nextSyncAt: nextDailySync(now, 9, snapshot.attemptedAt).toISOString(),
  };
}

import type { CatalogStore, PriceSource, RateSource } from "./ports.js";
import type { CatalogSnapshot } from "../domain/catalog.js";

export async function synchronize(
  store: CatalogStore,
  prices: PriceSource,
  rates: RateSource,
  now = new Date(),
): Promise<CatalogSnapshot> {
  const previous = await store.read();
  const snapshot: CatalogSnapshot = {
    ...previous,
    attemptedAt: now.toISOString(),
    issues: [],
  };
  const [priceResult, rateResult] = await Promise.allSettled([
    prices.collect(),
    rates.latest(),
  ]);
  if (priceResult.status === "fulfilled" && priceResult.value.products.length) {
    const fresh = new Map(
      priceResult.value.products.map((product) => [product.id, product]),
    );
    if (priceResult.value.issues.length) {
      for (const product of previous.products) {
        const updated = fresh.get(product.id);
        const failed = (region: "kr" | "us") => {
          const quote = product[region];
          if (!quote) return false;
          return priceResult.value.issues.some((issue) => {
            if (quote.url.startsWith(issue.source)) return true;
            return (
              product.family.startsWith("accessory-") &&
              issue.source.includes("/accessories/") &&
              issue.source.includes("/kr/") === (region === "kr")
            );
          });
        };
        const kr = updated?.kr ?? (failed("kr") ? product.kr : null);
        const us = updated?.us ?? (failed("us") ? product.us : null);
        if (kr || us)
          fresh.set(product.id, { ...(updated ?? product), kr, us });
      }
    }
    snapshot.products = [...fresh.values()];
    snapshot.issues.push(...priceResult.value.issues);
  } else
    snapshot.issues.push({
      source: "Apple",
      message:
        "제품 가격을 갱신하지 못했습니다. 마지막으로 확인한 가격을 표시합니다.",
    });
  if (rateResult.status === "fulfilled")
    snapshot.exchangeRate = rateResult.value;
  else
    snapshot.issues.push({
      source: "Frankfurter",
      message: "환율을 갱신하지 못했습니다. 마지막 공시값을 표시합니다.",
    });
  if (!snapshot.issues.length) snapshot.completedAt = now.toISOString();
  await store.write(snapshot);
  return snapshot;
}

export function nextDailySync(
  now: Date,
  hour = 9,
  attemptedAt?: string | null,
): Date {
  const local = new Date(now.getTime() + 9 * 3600_000);
  const next = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hour - 9,
    ),
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  if (attemptedAt) {
    const attemptedDay = new Date(Date.parse(attemptedAt) + 9 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const nextDay = new Date(next.getTime() + 9 * 3600_000)
      .toISOString()
      .slice(0, 10);
    if (attemptedDay === nextDay) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function shouldSync(
  now: Date,
  attemptedAt: string | null,
  hour = 9,
): boolean {
  if (!attemptedAt) return true;
  const koreaDate = (date: Date) =>
    new Date(date.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const previous = new Date(attemptedAt);
  if (koreaDate(now) === koreaDate(previous)) return false;
  const todaySlot = nextDailySync(now, hour).getTime() - 86_400_000;
  return previous.getTime() < todaySlot;
}

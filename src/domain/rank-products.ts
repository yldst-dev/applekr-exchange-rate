import type { Product } from "./catalog.js";
import { calculateExchange } from "./calculate.js";

export function rankProducts(products: Product[], marketRate: number, excludeVat: boolean, observedAt: number, limit = 12) {
  if (!Number.isFinite(marketRate) || marketRate <= 0) return [];
  const families = new Map<string, { product: Product; appleRate: number; premiumPercent: number }>();
  for (const product of products) {
    if (!product.kr || !product.us) continue;
    if (![product.kr.amount, product.us.amount].every(value => Number.isFinite(value) && value > 0)) continue;
    if (![product.kr.checkedAt, product.us.checkedAt].every(value => {
      const age = observedAt - Date.parse(value);
      return Number.isFinite(age) && age >= 0 && age <= 36 * 3600_000;
    })) continue;
    const calculation = calculateExchange(product.kr.amount, product.us.amount, marketRate, excludeVat);
    const current = families.get(product.family);
    if (!current || calculation.appleRate < current.appleRate || (calculation.appleRate === current.appleRate && product.id < current.product.id)) {
      families.set(product.family, { product, appleRate: calculation.appleRate, premiumPercent: calculation.premiumPercent });
    }
  }
  return [...families.values()].sort((a, b) => a.appleRate - b.appleRate || a.product.id.localeCompare(b.product.id)).slice(0, limit);
}

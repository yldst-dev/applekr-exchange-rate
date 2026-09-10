import type { PriceSource } from "../../src/application/ports.js";
import type { Product, Region, SyncIssue } from "../../src/domain/catalog.js";
import {
  discoverProductUrls,
  parseAccessoryPage,
  parseProductPage,
} from "./apple-parser.js";
import { fetchPage, fetchText } from "./http.js";

export function isRetiredPurchasePage(requested: string, resolved: string): boolean {
  const source = new URL(requested);
  const destination = new URL(resolved);
  const match = source.pathname.match(/^\/(kr\/)?shop\/buy-(iphone|ipad|mac|watch)\/[^/]+\/?$/);
  if (!match || source.origin !== destination.origin) return false;
  const prefix = match[1] ?? "";
  const family = match[2];
  const path = destination.pathname.replace(/\/$/, "");
  return path === `/${prefix}${family}` || path === `/${prefix}shop/buy-${family}`;
}

export function mergeRegions(products: Product[]): Product[] {
  const merged = new Map<string, Product>();
  for (const product of products) {
    const previous = merged.get(product.id);
    if (!previous) merged.set(product.id, product);
    else
      merged.set(product.id, {
        ...(product.kr ? product : previous),
        kr: product.kr ?? previous.kr,
        us: product.us ?? previous.us,
      });
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "ko") ||
      (a.kr?.amount ?? Infinity) - (b.kr?.amount ?? Infinity),
  );
}

export class ApplePriceSource implements PriceSource {
  async collect() {
    const products: Product[] = [];
    const issues: SyncIssue[] = [];
    const checkedAt = new Date().toISOString();
    for (const region of ["kr", "us"] as const) {
      const prefix = `https://www.apple.com/${region === "kr" ? "kr/" : ""}`;
      const urls = new Set<string>();
      const discovery = [
        "shop/buy-iphone",
        "shop/buy-mac",
        "shop/buy-ipad",
        "shop/buy-watch",
        "airpods/",
        "apple-vision-pro/",
        "tv-home/",
      ];
      for (const path of discovery) {
        try {
          const discovered = discoverProductUrls(
            await fetchText(prefix + path),
            region,
          );
          discovered.forEach((url) => urls.add(url));
          if (!discovered.length)
            issues.push({
              source: prefix + path,
              message: "제품 링크를 찾지 못했습니다.",
            });
        } catch {
          issues.push({
            source: prefix + path,
            message: "제품 목록을 불러오지 못했습니다.",
          });
        }
      }
      await this.accessories(region, checkedAt, products, issues, urls);
      const queue = [...urls];
      const workers = Array.from({ length: 3 }, async () => {
        for (;;) {
          const url = queue.shift();
          if (!url) break;
          try {
            const page = await fetchPage(url);
            if (isRetiredPurchasePage(url, page.url)) continue;
            const parsed = parseProductPage(
              page.text,
              url,
              region,
              checkedAt,
            );
            if (!parsed.length)
              issues.push({
                source: url,
                message: "가격 데이터를 확인할 수 없습니다.",
              });
            products.push(...parsed);
          } catch {
            issues.push({
              source: url,
              message: "가격 페이지를 불러오지 못했습니다.",
            });
          }
        }
      });
      await Promise.all(workers);
    }
    return { products: mergeRegions(products), issues };
  }
  private async accessories(
    region: Region,
    checkedAt: string,
    products: Product[],
    issues: SyncIssue[],
    urls: Set<string>,
  ) {
    let url: string | null =
      `https://www.apple.com/${region === "kr" ? "kr/" : ""}shop/accessories/all/made-by-apple`;
    const visited = new Set<string>();
    while (url && !visited.has(url) && visited.size < 100) {
      visited.add(url);
      try {
        const html = await fetchText(url);
        const parsed = parseAccessoryPage(html, region, checkedAt);
        products.push(...parsed.products);
        discoverProductUrls(html, region).forEach((link) => urls.add(link));
        url = parsed.next;
      } catch {
        issues.push({
          source: url ?? "Apple",
          message: "Apple 정품 액세서리 목록을 불러오지 못했습니다.",
        });
        break;
      }
    }
  }
}

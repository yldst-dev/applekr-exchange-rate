import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { Category, Product, Region } from "../../src/domain/catalog.js";

type JsonObject = Record<string, unknown>;
export const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
export const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const string = (value: unknown): string =>
  typeof value === "string" ? value : "";
const clean = (value: unknown): string => {
  const $ = load(string(value));
  $("sup, as-footnote, .visuallyhidden, .a11y").remove();
  return $.text().replace(/\s+/g, " ").trim();
};

export function extractJson(html: string, marker: string): JsonObject {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return {};
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return {};
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < html.length; index++) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "{") depth++;
    else if (character === "}" && --depth === 0) {
      try {
        return object(JSON.parse(html.slice(start, index + 1)));
      } catch {
        return {};
      }
    }
  }
  return {};
}

export function safeAppleUrl(
  value: unknown,
  base = "https://www.apple.com",
): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.apple.com" ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}
export function safeImage(value: unknown): string | null {
  try {
    const url = new URL(string(value));
    if (
      url.protocol !== "https:" ||
      !["store.storeimages.cdn-apple.com", "www.apple.com"].includes(
        url.hostname,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function categoryFor(path: string, name = ""): Category {
  if (/display/.test(path) || /Display/.test(name)) return "디스플레이";
  if (/\/buy-iphone\//.test(path)) return "iPhone";
  if (/\/buy-mac\//.test(path)) return "Mac";
  if (/\/buy-ipad\//.test(path)) return "iPad";
  if (/\/buy-watch\//.test(path)) return "Watch";
  if (/\/buy-airpods\//.test(path)) return "AirPods";
  if (/\/buy-vision\//.test(path)) return "Vision";
  if (/\/buy-(tv|homepod)\//.test(path) || /HomePod|Apple TV/.test(name))
    return "TV 및 홈";
  return "액세서리";
}
const titleFor = (slug: string) =>
  ({
    "apple-watch": "Apple Watch",
    "apple-watch-se": "Apple Watch SE",
    "apple-watch-ultra": "Apple Watch Ultra",
    "apple-watch-hermes": "Apple Watch Hermès",
    "apple-watch-hermes-ultra": "Apple Watch Hermès Ultra",
    "macbook-air": "MacBook Air",
    "macbook-pro": "MacBook Pro",
    "macbook-neo": "MacBook Neo",
    "mac-mini": "Mac mini",
    "mac-studio": "Mac Studio",
    imac: "iMac",
    "apple-vision-pro": "Apple Vision Pro",
  })[slug] ??
  slug
    .replace(/\biphone\b/i, "iPhone")
    .replace(/\bipad\b/i, "iPad")
    .replace(/\bairpods\b/i, "AirPods")
    .replace(/-/g, " ");
const hash = (key: string) =>
  createHash("sha256").update(key).digest("hex").slice(0, 24);
const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

function productQuote(
  base: Omit<Product, "kr" | "us">,
  region: Region,
  amount: number,
  url: string,
  checkedAt: string,
): Product {
  return {
    ...base,
    kr: null,
    us: null,
    [region]: {
      amount,
      currency: region === "kr" ? "KRW" : "USD",
      url,
      checkedAt,
    },
  };
}

export function parseProductPage(
  html: string,
  url: string,
  region: Region,
  checkedAt: string,
): Product[] {
  const $ = load(html);
  const slug = new URL(url).pathname.match(/\/buy-[^/]+\/([^/]+)/)?.[1] ?? "";
  const data = extractJson(html, "productSelectionData:");
  const displays = object(data.displayValues ?? data.mainDisplayValues);
  const prices = object(displays.prices);
  const jsonProducts: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      const visit = (item: unknown) => {
        const value = object(item);
        if (value["@type"] === "Product") jsonProducts.push(value);
        for (const nested of array(value["@graph"])) visit(nested);
      };
      if (Array.isArray(parsed)) parsed.forEach(visit);
      else visit(parsed);
    } catch {
      return;
    }
  });
  const pageName =
    clean(jsonProducts[0]?.name) ||
    clean($("h1").first().text()).replace(/ 구입하기| 구입|Buy /g, "") ||
    titleFor(slug);
  const fallbackImage = safeImage(
    jsonProducts[0]?.image ?? $('meta[property="og:image"]').attr("content"),
  );
  const results = new Map<string, Product>();
  for (const raw of array(data.products)) {
    const product = object(raw);
    if (
      product.isCarrierDevice === true ||
      (product.carrierPolicyType && product.carrierPolicyType !== "UNLOCKED")
    )
      continue;
    const price = object(
      prices[string(product.fullPrice ?? product.priceKey ?? product.price)],
    );
    if (
      price.priceCurrency &&
      price.priceCurrency !== (region === "kr" ? "KRW" : "USD")
    )
      continue;
    const amount = positive(
      object(price.currentPrice).raw_amount ??
        price.amountBeforeTradeIn ??
        price.amount ??
        price.seoPrice,
    );
    if (!amount) continue;
    const dimensions = {
      ...object(product.dimensions),
      ...Object.fromEntries(
        Object.entries(product).filter(
          ([key, value]) =>
            key.includes("dimension") &&
            key !== "dimensionSteporder" &&
            typeof value === "string",
        ),
      ),
    };
    const dimensionEntries = Object.entries(dimensions)
      .filter(([key]) => !/steporder/i.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    const screen = string(dimensions.dimensionScreensize);
    const screenValue = object(
      object(displays.dimensionScreensize)[screen],
    ).value;
    const screenName = clean(string(screenValue).split(/<span|<div/)[0]);
    const name =
      screenName && /iPhone/.test(screenName) ? screenName : pageName;
    const labels = dimensionEntries
      .map(([key, value]) => {
        const display = object(object(displays[key])[string(value)]);
        const label = clean(
          string(display.value ?? display.header).split(
            /<div|<span class="form-label-small"/,
          )[0],
        );
        return (
          label ||
          string(value)
            .replace(
              /(\d)(gb|tb)\b/gi,
              (_, digit: string, unit: string) => digit + unit.toUpperCase(),
            )
            .replace(/_/g, ".")
        );
      })
      .filter(Boolean);
    const configuration = Object.entries(object(product.productConfiguration))
      .filter(([key]) =>
        [
          "processor",
          "memory",
          "storage",
          "retina_display",
          "graphics",
        ].includes(key),
      )
      .sort(([a], [b]) => a.localeCompare(b));
    const family = string(product.familyType) || slug;
    const key = JSON.stringify([slug, family, dimensionEntries, configuration]);
    const id = hash(key);
    const image =
      safeImage(
        object(
          array(
            object(object(data.imageDictionary)[string(product.imageKey)])
              .sources,
          )[0],
        ).srcSet,
      ) ?? fallbackImage;
    const starting = categoryFor(url) === "Watch";
    const specification =
      labels.join(" · ") +
      (configuration.length ? " · 표준 구성" : "") +
      (starting ? " · 기본 밴드 기준" : "");
    results.set(
      id,
      productQuote(
        {
          id,
          family: categoryFor(url) === "iPhone" ? slug + ":" + family : slug,
          name,
          specification: specification || "기본 구성",
          category: categoryFor(url),
          image,
          basis: starting ? "starting" : "configuration",
        },
        region,
        amount,
        url,
        checkedAt,
      ),
    );
  }
  if (results.size) return [...results.values()];
  for (const product of jsonProducts) {
    const name = clean(product.name);
    const offers = Array.isArray(product.offers)
      ? product.offers
      : [product.offers];
    for (const raw of offers) {
      const offer = object(raw);
      if (offer.priceCurrency !== (region === "kr" ? "KRW" : "USD")) continue;
      const amount = positive(offer.price ?? offer.lowPrice);
      if (!amount) continue;
      const id = hash(
        JSON.stringify([
          slug,
          name.toLowerCase().replace(/\s/g, ""),
          "starting",
        ]),
      );
      results.set(
        id,
        productQuote(
          {
            id,
            family: slug,
            name,
            category: categoryFor(url, name),
            specification: "공식 시작 가격 · 옵션별 비교 미지원",
            image: safeImage(product.image) ?? fallbackImage,
            basis: "starting",
          },
          region,
          amount,
          url,
          checkedAt,
        ),
      );
    }
  }
  return [...results.values()];
}

export function parseAccessoryPage(
  html: string,
  region: Region,
  checkedAt: string,
): { products: Product[]; next: string | null } {
  const data = extractJson(html, "window.pageLevelData.categoryResults =");
  if (!data.results)
    throw new Error("액세서리 목록 구조를 확인할 수 없습니다.");
  const products: Product[] = [];
  const visit = (raw: unknown) => {
    if (Array.isArray(raw)) {
      raw.forEach(visit);
      return;
    }
    const value = object(raw);
    if (value.partNumber && value.productPrice) {
      const name = clean(value.title);
      const url = safeAppleUrl(object(value.link).url);
      const price = object(value.productPrice);
      const amount = positive(
        string(price.priceCurrent).replace(/[^0-9.]/g, ""),
      );
      const part = string(value.basePartNumber);
      if (
        !url ||
        !amount ||
        !part ||
        price.priceCurrency !== (region === "kr" ? "KRW" : "USD")
      )
        return;
      const imageData = object(
        object(array(object(value.productImages).items)[0]).value,
      );
      const image = safeImage(object(array(imageData.sources)[0]).srcSet);
      const id = hash("part:" + part.toUpperCase());
      products.push(
        productQuote(
          {
            id,
            family: "accessory-" + part.toLowerCase(),
            name,
            category: categoryFor(url, name),
            specification: `제품 번호 ${part}`,
            image,
            basis: "configuration",
          },
          region,
          amount,
          url,
          checkedAt,
        ),
      );
      return;
    }
    for (const child of Object.values(value))
      if (child && typeof child === "object") visit(child);
  };
  visit(data.results);
  const nextValue = typeof data.nextLink === "string" ? data.nextLink : "";
  const next = safeAppleUrl(nextValue);
  if (next && nextValue) {
    const page = new URL(nextValue, "https://www.apple.com").searchParams.get(
      "page",
    );
    if (page && /^\d{1,3}$/.test(page) && Number(page) <= 100)
      return { products, next: next + "?page=" + page };
  }
  return { products, next: null };
}

export function discoverProductUrls(html: string, region: Region): string[] {
  const $ = load(html);
  const urls = new Set<string>();
  const hrefs = [
    ...$("a[href]")
      .toArray()
      .map((element) => $(element).attr("href")),
    ...Array.from(html.matchAll(/href=["']([^"']+)["']/g), (match) => match[1]),
  ];
  for (const href of hrefs) {
    const normalized = href
      ?.replace("/us/shop/", "/shop/")
      .replace(
        /\/shop\/goto\/buy_([a-z]+)\/([^?#]+)/,
        (_, category: string, model: string) =>
          "/shop/buy-" + category + "/" + model.replace(/_/g, "-"),
      );
    const url = safeAppleUrl(normalized);
    if (!url) continue;
    const path = new URL(url).pathname;
    const match = path.match(
      /^\/(kr\/)?shop\/buy-(iphone|mac|ipad|watch|airpods|vision|tv|homepod)\/([^/]+)/,
    );
    if (
      !match ||
      (region === "kr") !== Boolean(match[1]) ||
      ["carrier-offers"].includes(match[3])
    )
      continue;
    urls.add(
      `https://www.apple.com/${region === "kr" ? "kr/" : ""}shop/buy-${match[2]}/${match[3]}`,
    );
  }
  return [...urls];
}

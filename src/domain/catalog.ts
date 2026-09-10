export const categories = [
  "iPhone",
  "Mac",
  "iPad",
  "Watch",
  "AirPods",
  "Vision",
  "TV 및 홈",
  "디스플레이",
  "액세서리",
] as const;
export type Category = (typeof categories)[number];
export type Region = "kr" | "us";
export interface PriceQuote {
  amount: number;
  currency: "KRW" | "USD";
  url: string;
  checkedAt: string;
}
export interface Product {
  id: string;
  family: string;
  name: string;
  category: Category;
  specification: string;
  image: string | null;
  basis: "configuration" | "starting";
  kr: PriceQuote | null;
  us: PriceQuote | null;
}
export interface ExchangeRate {
  rate: number;
  date: string;
  fetchedAt: string;
  source: string;
  url: string;
}
export interface SyncIssue {
  source: string;
  message: string;
}
export interface CatalogSnapshot {
  version: 1;
  products: Product[];
  exchangeRate: ExchangeRate | null;
  attemptedAt: string | null;
  completedAt: string | null;
  issues: SyncIssue[];
}
export interface CatalogResponse extends CatalogSnapshot {
  syncing: boolean;
  nextSyncAt: string;
}
export const emptyCatalog = (): CatalogSnapshot => ({
  version: 1,
  products: [],
  exchangeRate: null,
  attemptedAt: null,
  completedAt: null,
  issues: [],
});

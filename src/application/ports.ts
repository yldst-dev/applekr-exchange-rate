import type {
  CatalogSnapshot,
  ExchangeRate,
  Product,
  SyncIssue,
} from "../domain/catalog.js";
export interface CatalogStore {
  read(): Promise<CatalogSnapshot>;
  write(snapshot: CatalogSnapshot): Promise<void>;
}
export interface PriceSource {
  collect(): Promise<{ products: Product[]; issues: SyncIssue[] }>;
}
export interface RateSource {
  latest(): Promise<ExchangeRate>;
}

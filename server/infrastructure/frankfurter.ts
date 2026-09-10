import type { RateSource } from "../../src/application/ports.js";
import { fetchText } from "./http.js";
export const rateUrl =
  "https://api.frankfurter.dev/v2/rates?base=USD&quotes=KRW&providers=ECB";
export class FrankfurterSource implements RateSource {
  async latest() {
    const data: unknown = JSON.parse(await fetchText(rateUrl));
    if (!Array.isArray(data) || data.length !== 1)
      throw new Error("환율 응답 형식이 올바르지 않습니다.");
    const value = data[0];
    if (
      value.base !== "USD" ||
      value.quote !== "KRW" ||
      typeof value.rate !== "number" ||
      !Number.isFinite(value.rate) ||
      value.rate <= 0 ||
      typeof value.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
      !Number.isFinite(Date.parse(value.date)) ||
      Date.parse(value.date) > Date.now() + 86_400_000
    )
      throw new Error("환율 값이 올바르지 않습니다.");
    return {
      rate: value.rate,
      date: value.date,
      fetchedAt: new Date().toISOString(),
      source: "유럽중앙은행 · Frankfurter",
      url: rateUrl,
    };
  }
}

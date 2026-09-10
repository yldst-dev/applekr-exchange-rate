export function calculateExchange(
  krw: number,
  usd: number,
  marketRate: number,
  excludeVat = true,
) {
  if (
    ![krw, usd, marketRate].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new Error("가격과 환율은 0보다 큰 숫자여야 합니다.");
  }
  const taxDivisor = excludeVat ? 1.1 : 1;
  const comparablePrice = krw / taxDivisor;
  const appleRate = comparablePrice / usd;
  const difference = appleRate - marketRate;
  return {
    appleRate,
    difference,
    premiumPercent: (difference / marketRate) * 100,
    comparablePrice,
    expectedPrice: usd * marketRate * taxDivisor,
    priceDifference: krw - usd * marketRate * taxDivisor,
    vat: krw - krw / 1.1,
  };
}

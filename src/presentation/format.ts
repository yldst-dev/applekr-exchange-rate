export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
export const won = (value: number, digits = 0) => `${number(value, digits)}원`;
export const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
export const dateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "아직 확인하지 못했습니다";
export const signed = (value: number, digits = 1) =>
  `${value > 0 ? "+" : ""}${number(value, digits)}`;

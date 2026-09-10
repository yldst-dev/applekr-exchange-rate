const allowedHosts = new Set(["www.apple.com", "api.frankfurter.dev"]);

export function assertSourceUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("허용되지 않은 데이터 주소입니다.");
  return url;
}
export async function fetchPage(value: string): Promise<{ text: string; url: string }> {
  let url = assertSourceUrl(value);
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "User-Agent": "AppleExchangeCalculator/1.0",
        Accept: "text/html,application/json",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("이동 주소가 없습니다.");
      url = assertSourceUrl(new URL(location, url).href);
      await response.body?.cancel();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`데이터 응답 오류: ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("응답 내용이 없습니다.");
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value: part } = await reader.read();
      if (done) break;
      size += part.length;
      if (size > 12_000_000) {
        await reader.cancel();
        throw new Error("응답 크기가 너무 큽니다.");
      }
      parts.push(part);
    }
    return { text: Buffer.concat(parts).toString("utf8"), url: url.href };
  }
  throw new Error("페이지 이동이 너무 많습니다.");
}

export async function fetchText(value: string): Promise<string> {
  return (await fetchPage(value)).text;
}

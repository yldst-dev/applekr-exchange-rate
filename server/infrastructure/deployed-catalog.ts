import { parseCatalogSnapshot } from "./catalog-snapshot.js";

export function deployedCatalogUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") ||
    url.username || url.password || url.port || url.pathname !== "/" ||
    url.search || url.hash) {
    throw new Error("배포된 Workers 사이트의 기본 주소를 지정해 주세요.");
  }
  return new URL("/api/catalog", url);
}

export async function readDeployedCatalog(value: string) {
  const response = await fetch(deployedCatalogUrl(value), {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
    await response.body?.cancel();
    throw new Error("이전 배포 데이터를 불러오지 못했습니다. 현재 배포를 유지합니다.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("이전 배포 데이터가 비어 있습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    size += chunk.length;
    if (size > 12_000_000) {
      await reader.cancel();
      throw new Error("이전 배포 데이터가 허용된 크기를 초과했습니다.");
    }
    chunks.push(chunk);
  }
  return parseCatalogSnapshot(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

import type { CatalogResponse } from "../domain/catalog";
export async function fetchCatalog(
  signal?: AbortSignal,
): Promise<CatalogResponse> {
  const response = await fetch("/api/catalog", {
    signal,
    cache: "no-cache",
  }).catch(() => {
    throw new Error(
      "서버에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    );
  });
  if (!response.ok)
    throw new Error(
      "가격 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  const data: unknown = await response.json().catch(() => {
    throw new Error("서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
  });
  if (
    !data ||
    typeof data !== "object" ||
    !("products" in data) ||
    !Array.isArray(data.products) ||
    !("version" in data) ||
    data.version !== 1
  )
    throw new Error("데이터 형식을 확인할 수 없습니다.");
  return data as CatalogResponse;
}

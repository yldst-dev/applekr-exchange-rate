import { useCallback, useEffect, useState } from "react";
import type { CatalogResponse } from "../domain/catalog";
import { fetchCatalog } from "../infrastructure/catalog-api";
export function useCatalog() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      setData(await fetchCatalog(signal));
      setObservedAt(Date.now());
      setError(null);
    } catch (reason) {
      if (!signal?.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "데이터를 불러오지 못했습니다.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal);
    }, 30_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  return { data, error, loading, refresh, observedAt };
}

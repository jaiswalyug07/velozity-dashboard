import { useCallback, useEffect, useRef, useState } from "react";

interface UseQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Lightweight data fetching helper. `fetcher` is memoised by the caller with
 * useCallback so callers can re-run it by changing its dependencies.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (id === requestId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === requestId.current) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}
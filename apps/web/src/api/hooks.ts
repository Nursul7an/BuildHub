/**
 * Мелкая замена библиотеке запросов: экранам нужны данные, состояние загрузки
 * и способ перечитать их после действия. Больше ничего.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from './client';

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useQuery<T>(path: string | null, deps: unknown[] = []): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<T>(path)
      .then((result) => {
        if (!alive.current) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные');
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, reload };
}

/** Действие с блокировкой повторного нажатия и текстом ошибки от сервера. */
export function useAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
): {
  run: (...args: Args) => Promise<boolean>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setBusy(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e: unknown) {
        setError(e instanceof ApiError ? e.message : 'Не удалось выполнить действие');
        return false;
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );

  return { run, busy, error, clearError: () => setError(null) };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, describeError } from './api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** GETs a path and re-runs whenever `deps` change. */
export function useApi<T>(
  path: string | null,
  query?: Record<string, string | number | boolean | undefined | null>,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api<T>(path, { query: query, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(describeError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, loading, error, reload };
}

/** Wraps a mutating call with pending/error state. */
export function useMutation<TArgs, TResult>(
  run: (args: TArgs) => Promise<TResult>,
): {
  mutate: (args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (args: TArgs) => {
      setPending(true);
      setError(null);
      try {
        return await run(args);
      } catch (cause) {
        setError(describeError(cause));
        return null;
      } finally {
        setPending(false);
      }
    },
    [run],
  );

  return { mutate, pending, error, clearError: () => setError(null) };
}

/**
 * Countdown driven by an absolute server deadline rather than a local tick count,
 * so a backgrounded tab or a paused timer cannot buy the student extra time.
 */
export function useCountdown(deadlineMs: number | null, onExpire?: () => void): number {
  const [remaining, setRemaining] = useState(() =>
    deadlineMs === null ? 0 : Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)),
  );
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    if (deadlineMs === null) return;

    const tick = () => {
      const seconds = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !fired.current) {
        fired.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs]);

  return remaining;
}

/** Tracks seconds spent on the currently displayed item. */
export function useElapsed(key: string | number): () => number {
  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [key]);
  return useCallback(() => Math.round((Date.now() - startedAt.current) / 1000), []);
}

export function useTheme(): { theme: 'light' | 'dark' | 'system'; setTheme: (value: 'light' | 'dark' | 'system') => void } {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(
    () => (localStorage.getItem('pp_theme') as 'light' | 'dark' | 'system' | null) ?? 'system',
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem('pp_theme', theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}

/** Full-screen helper for proctored test mode. */
export function useFullscreen(): { active: boolean; enter: () => void; exit: () => void } {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return {
    active,
    enter: () => {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    },
    exit: () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    },
  };
}

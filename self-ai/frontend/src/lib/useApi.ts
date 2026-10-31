"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errText } from "./api";

/** GET `path` on mount (and whenever `path` changes). `reload()` refetches. */
export function useApi<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current;
    try {
      const d = await api<T>(path);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(errText(e));
    }
  }, [path]);

  useEffect(() => {
    // reload() only sets state after its fetch resolves (async), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    if (!pollMs) return;
    const t = setInterval(reload, pollMs);
    return () => clearInterval(t);
  }, [reload, pollMs, path]);

  const loading = !!path && data === null && error === null;
  return { data, error, loading, reload, setData };
}

import { useState, useEffect } from "react";

export type SystemSettings = {
  brand_logo?: string;
};

let cache: SystemSettings | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function invalidateSystemSettings() {
  cache = null;
  notify();
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(cache ?? {});
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;

    const update = () => {
      setSettings(cache ?? {});
    };
    listeners.add(update);

    if (cache === null) {
      fetch("/api/data/settings")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) {
            cache = data as SystemSettings;
            setSettings(cache);
            setLoading(false);
            notify();
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      listeners.delete(update);
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}

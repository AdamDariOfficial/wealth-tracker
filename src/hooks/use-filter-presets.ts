import { useCallback, useEffect, useState } from "react";

export type FilterPreset<T> = { id: string; name: string; values: T; createdAt: number };

const KEY = (ns: string) => `lovable:filter-presets:${ns}`;

export function useFilterPresets<T>(namespace: string) {
  const [presets, setPresets] = useState<FilterPreset<T>[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY(namespace));
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [namespace]);

  const persist = useCallback(
    (next: FilterPreset<T>[]) => {
      setPresets(next);
      try {
        window.localStorage.setItem(KEY(namespace), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [namespace]
  );

  const save = useCallback(
    (name: string, values: T) => {
      const preset: FilterPreset<T> = {
        id: crypto.randomUUID(),
        name: name.trim() || `Preset ${presets.length + 1}`,
        values,
        createdAt: Date.now(),
      };
      persist([preset, ...presets]);
      return preset;
    },
    [persist, presets]
  );

  const remove = useCallback(
    (id: string) => persist(presets.filter((p) => p.id !== id)),
    [persist, presets]
  );

  return { presets, save, remove };
}

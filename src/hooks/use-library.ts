"use client";

import { useCallback, useEffect, useState } from "react";
import { apiMutate } from "@/hooks/use-tournament";
import type { Library } from "@/lib/tournament/types";

export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Impossible de charger la bibliothèque");
      }
      setLibrary((await res.json()) as Library);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, init?: RequestInit) => {
      const next = await apiMutate<Library>(url, init);
      setLibrary(next);
      return next;
    },
    [],
  );

  return { library, loading, error, refresh, setLibrary, mutate };
}

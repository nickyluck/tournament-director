"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TournamentPublic } from "@/lib/tournament/types";

type UseTournamentResult = {
  tournament: TournamentPublic | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => Promise<void>;
  setTournament: (t: TournamentPublic) => void;
};

export function useTournamentStream(): UseTournamentResult {
  const [tournament, setTournament] = useState<TournamentPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Impossible de charger le tournoi");
      }
      const data = (await res.json()) as TournamentPublic;
      setTournament(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.addEventListener("tournament", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as TournamentPublic;
        setTournament(data);
        setLoading(false);
        setError(null);
        setConnected(true);
      } catch {
        setError("Flux live illisible");
      }
    });

    es.addEventListener("error", () => {
      setConnected(false);
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [refresh]);

  return { tournament, loading, error, connected, refresh, setTournament };
}

export async function apiMutate<T = TournamentPublic>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;
  if (!res.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body && body.error
        ? body.error
        : "Action impossible",
    );
  }
  return body as T;
}

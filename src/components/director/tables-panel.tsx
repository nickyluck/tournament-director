"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiMutate } from "@/hooks/use-tournament";
import type { TournamentPublic } from "@/lib/tournament/types";

export function TablesPanel({
  tournament,
  onUpdate,
}: {
  tournament: TournamentPublic;
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rebalance = () => {
    startTransition(async () => {
      try {
        setError(null);
        const next = await apiMutate("/api/tournament/rebalance", { method: "POST" });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  if (tournament.status === "setup") {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Tables</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tournament.configuredTableCount} table
          {tournament.configuredTableCount > 1 ? "s" : ""} prévues ·{" "}
          {tournament.seatsPerTable} places. Le seating automatique s’applique au
          lancement.
        </p>
      </section>
    );
  }

  const tables = [...tournament.tables].sort((a, b) => a.number - b.number);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tables</h2>
        {tournament.status === "running" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={rebalance}>
            Rééquilibrer
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {tables.map((table) => {
          const seated = tournament.players
            .filter((p) => p.status === "active" && p.tableId === table.id)
            .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
          return (
            <div
              key={table.id}
              className={`rounded-lg border px-3 py-3 ${table.open ? "border-border" : "border-dashed border-border/60 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">Table {table.number}</p>
                <Badge variant={table.open ? "default" : "secondary"}>
                  {table.open ? `${seated.length}/${table.seats}` : "Cassée"}
                </Badge>
              </div>
              {table.open ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {seated.length === 0 ? (
                    <li className="text-muted-foreground">Vide</li>
                  ) : (
                    seated.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">Siège {p.seat}</span>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Table fermée</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

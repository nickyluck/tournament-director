"use client";

import type { TournamentPublic } from "@/lib/tournament/types";

const reasonLabel = {
  initial: "Départ",
  rebalance: "Rééquilibrage",
  break: "Casse",
} as const;

export function MovesPanel({ tournament }: { tournament: TournamentPublic }) {
  const moves = tournament.moves.slice(0, 40);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Moves floor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Historique des déplacements appliqués automatiquement.
      </p>

      {moves.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun move pour l’instant.
        </p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
          {moves.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-border/70 px-3 py-2"
            >
              <p className="font-medium">{m.playerName}</p>
              <p className="text-muted-foreground">
                {m.fromTable == null
                  ? `→ Table ${m.toTable} siège ${m.toSeat}`
                  : `Table ${m.fromTable} → Table ${m.toTable} siège ${m.toSeat}`}
                {" · "}
                {reasonLabel[m.reason]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

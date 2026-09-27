"use client";

import { isBreak } from "@/lib/tournament/blinds";
import { formatChips, formatClock } from "@/lib/tournament/helpers";
import type { TournamentPublic } from "@/lib/tournament/types";

export function LiveStats({
  tournament,
  remainingMs,
}: {
  tournament: TournamentPublic;
  remainingMs: number;
}) {
  const level = tournament.currentLevel;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Joueurs restants"
        value={`${tournament.remainingPlayers} / ${Math.max(tournament.entrants, tournament.players.length)}`}
      />
      <Stat label="Tables ouvertes" value={String(tournament.openTables)} />
      <Stat
        label="Stack moyen"
        value={
          tournament.remainingPlayers > 0
            ? formatChips(tournament.averageStack)
            : "—"
        }
      />
      <Stat
        label={
          level
            ? isBreak(level)
              ? "Pause"
              : `Niveau ${tournament.timer.levelIndex + 1}`
            : "Blindes"
        }
        value={
          level
            ? isBreak(level)
              ? level.message || "Pause"
              : `${formatChips(level.smallBlind)} / ${formatChips(level.bigBlind)}${level.ante ? ` · A${formatChips(level.ante)}` : ""}`
            : "—"
        }
        hint={formatClock(remainingMs)}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 font-mono text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

"use client";

import { formatChips, formatClock } from "@/lib/tournament/helpers";
import { useLiveRemaining } from "@/hooks/use-live-remaining";
import { useTournamentStream } from "@/hooks/use-tournament";

export function ClockApp() {
  const { tournament, loading, error } = useTournamentStream();
  const remainingMs = useLiveRemaining(tournament);

  if (loading && !tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <p>Chargement de l’horloge…</p>
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-red-300">
        <p>{error}</p>
      </main>
    );
  }

  if (!tournament) return null;

  const level = tournament.currentLevel;
  const next = tournament.blinds[tournament.timer.levelIndex + 1] ?? null;

  return (
    <main className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-zinc-950 px-6 py-8 text-zinc-50 sm:px-10 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(251,146,60,0.16),transparent_35%),linear-gradient(180deg,#09090b,#18181b)]"
      />

      <header className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">
            Tournament Director
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">{tournament.name}</h1>
        </div>
        <div className="text-right text-sm text-zinc-400 sm:text-base">
          <p>
            {tournament.remainingPlayers} joueurs · {tournament.openTables} tables
          </p>
          <p>
            Stack moyen{" "}
            <span className="text-zinc-100">
              {tournament.remainingPlayers > 0
                ? formatChips(tournament.averageStack)
                : "—"}
            </span>
          </p>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-lg uppercase tracking-[0.35em] text-sky-300/90 sm:text-xl">
          {tournament.status === "setup"
            ? "En préparation"
            : tournament.status === "finished"
              ? "Tournoi terminé"
              : `Niveau ${tournament.timer.levelIndex + 1}`}
        </p>
        <p className="mt-4 font-mono text-[22vw] font-semibold leading-none tracking-tight tabular-nums sm:text-[10rem]">
          {formatClock(remainingMs)}
        </p>
        {level ? (
          <p className="mt-6 text-3xl font-medium tabular-nums sm:text-5xl">
            {formatChips(level.smallBlind)} / {formatChips(level.bigBlind)}
            {level.ante > 0 ? (
              <span className="text-zinc-400"> · ante {formatChips(level.ante)}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-6 text-xl text-zinc-400">Aucune blinde configurée</p>
        )}
        {!tournament.timer.running && tournament.status === "running" ? (
          <p className="mt-4 text-amber-300">Pause</p>
        ) : null}
      </section>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400 sm:text-base">
        <p>
          {next
            ? `Suivant : ${formatChips(next.smallBlind)} / ${formatChips(next.bigBlind)}${next.ante ? ` ante ${formatChips(next.ante)}` : ""}`
            : "Dernier niveau"}
        </p>
        <p>{tournament.timer.running ? "Chrono en cours" : "Chrono arrêté"}</p>
      </footer>
    </main>
  );
}

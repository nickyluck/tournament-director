"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { DirectorHeader } from "@/components/director/header";
import { LiveStats } from "@/components/director/live-stats";
import { TimerPanel } from "@/components/director/timer-panel";
import { TablesPanel } from "@/components/director/tables-panel";
import { FloorMovesAlert } from "@/components/floor/floor-moves-alert";
import { useLiveRemaining } from "@/hooks/use-live-remaining";
import { apiMutate, useTournamentStream } from "@/hooks/use-tournament";
import { cn } from "@/lib/utils";

function isSeated(
  status: string,
  players: { status: string; tableId: string | null; seat: number | null }[],
  tables: { open: boolean }[],
) {
  const actives = players.filter((p) => p.status === "active");
  return (
    status === "setup" &&
    actives.length >= 2 &&
    tables.some((t) => t.open) &&
    actives.every((p) => p.tableId != null && p.seat != null)
  );
}

export function DirectorApp() {
  const { tournament, loading, error, connected, setTournament } =
    useTournamentStream();
  const remainingMs = useLiveRemaining(tournament);
  const [startError, setStartError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (loading && !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center px-4">
        <p className="text-muted-foreground">Chargement du tournoi…</p>
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Alert variant="destructive">
          <AlertTitle>Impossible de charger</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!tournament) return null;

  const seated = isSeated(tournament.status, tournament.players, tournament.tables);

  const start = () => {
    startTransition(async () => {
      try {
        setStartError(null);
        const next = await apiMutate("/api/tournament/start", { method: "POST" });
        setTournament(next);
      } catch (err) {
        setStartError(err instanceof Error ? err.message : "Impossible de démarrer");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(15,23,42,0.06),_transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <DirectorHeader
        name={tournament.name}
        status={tournament.status}
        connected={connected}
        pin={tournament.mobilePin}
      />

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {tournament.status === "setup" ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">Préparation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configurez le tournoi et inscrivez les joueurs, puis placez-les
                aux tables ici avant de démarrer.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/setup"
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  Configuration
                </Link>
                <Link
                  href="/players"
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  Inscriptions
                </Link>
                <Button disabled={pending || !seated} onClick={start}>
                  Démarrer le tournoi
                </Button>
              </div>
              {!seated ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {tournament.players.length < 2
                    ? "Inscrivez au moins 2 joueurs, puis placez-les."
                    : "Placez les joueurs aux tables (panneau de droite)."}
                </p>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">
                  Placement prêt — démarrez quand tout le monde est installé.
                </p>
              )}
              {startError ? (
                <p className="mt-2 text-sm text-destructive">{startError}</p>
              ) : null}
            </section>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/setup"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Configuration
              </Link>
              <Link
                href="/players"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Joueurs / éliminations
              </Link>
            </div>
          )}

          <LiveStats tournament={tournament} remainingMs={remainingMs} />
          <TimerPanel
            tournament={tournament}
            remainingMs={remainingMs}
            onUpdate={setTournament}
          />
          <FloorMovesAlert tournament={tournament} />
        </div>

        <div className="space-y-4">
          <TablesPanel tournament={tournament} onUpdate={setTournament} />
        </div>
      </main>
    </div>
  );
}

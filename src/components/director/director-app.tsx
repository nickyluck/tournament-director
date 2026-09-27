"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DirectorHeader } from "@/components/director/header";
import { LiveStats } from "@/components/director/live-stats";
import { PlayersPanel } from "@/components/director/players-panel";
import { SetupPanel } from "@/components/director/setup-panel";
import { TimerPanel } from "@/components/director/timer-panel";
import { TablesPanel } from "@/components/director/tables-panel";
import { MovesPanel } from "@/components/director/moves-panel";
import { ResetBar } from "@/components/director/reset-bar";
import { useLiveRemaining } from "@/hooks/use-live-remaining";
import { useTournamentStream } from "@/hooks/use-tournament";

export function DirectorApp() {
  const { tournament, loading, error, connected, setTournament } =
    useTournamentStream();
  const remainingMs = useLiveRemaining(tournament);

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
          <LiveStats tournament={tournament} remainingMs={remainingMs} />
          <TimerPanel
            tournament={tournament}
            remainingMs={remainingMs}
            onUpdate={setTournament}
          />
          <SetupPanel tournament={tournament} onUpdate={setTournament} />
          <ResetBar onUpdate={setTournament} />
        </div>

        <div className="space-y-4">
          <PlayersPanel tournament={tournament} onUpdate={setTournament} />
          <TablesPanel tournament={tournament} onUpdate={setTournament} />
          <MovesPanel tournament={tournament} />
        </div>
      </main>
    </div>
  );
}

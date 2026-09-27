"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DirectorHeader } from "@/components/director/header";
import { SetupPanel } from "@/components/director/setup-panel";
import { ResetBar } from "@/components/director/reset-bar";
import { useTournamentStream } from "@/hooks/use-tournament";

export function SetupApp() {
  const { tournament, loading, error, connected, setTournament } =
    useTournamentStream();

  if (loading && !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center px-4">
        <p className="text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if ((error && !tournament) || !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Alert variant="destructive">
          <AlertTitle>Impossible de charger</AlertTitle>
          <AlertDescription>{error ?? "Tournoi indisponible"}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(15,23,42,0.06),_transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <DirectorHeader
        name={tournament.name}
        status={tournament.status}
        connected={connected}
        pin={tournament.mobilePin}
      />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Structure, tables, table finale et ordre de cassage.
            </p>
          </div>
          <Link className="text-sm underline underline-offset-4" href="/">
            Retour console
          </Link>
        </div>
        <SetupPanel tournament={tournament} onUpdate={setTournament} />
        <ResetBar onUpdate={setTournament} />
      </main>
    </div>
  );
}

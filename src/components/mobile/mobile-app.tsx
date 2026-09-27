"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EliminateDialog } from "@/components/eliminate-dialog";
import { isBreak } from "@/lib/tournament/blinds";
import { formatChips, formatClock } from "@/lib/tournament/helpers";
import { useLiveRemaining } from "@/hooks/use-live-remaining";
import { apiMutate, useTournamentStream } from "@/hooks/use-tournament";
import type { Player, TimerAction, TournamentPublic } from "@/lib/tournament/types";

export function MobileApp() {
  const { tournament, loading, error, setTournament } = useTournamentStream();
  const remainingMs = useLiveRemaining(tournament);
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Player | null>(null);

  if (loading && !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <p className="text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if ((error && !tournament) || !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Alert variant="destructive">
          <AlertTitle>Connexion impossible</AlertTitle>
          <AlertDescription>{error ?? "Tournoi indisponible"}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const actives = tournament.players
    .filter((p) => p.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const eliminated = [...tournament.players]
    .filter((p) => p.status === "eliminated")
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

  const requirePin = (): boolean => {
    if (!pin.trim()) {
      setLocalError("Saisissez le PIN affiché sur l’écran directeur.");
      return false;
    }
    return true;
  };

  const confirmEliminate = (killerId: string | null) => {
    if (!target) return;
    if (!requirePin()) return;
    startTransition(async () => {
      try {
        setLocalError(null);
        setMessage(null);
        const next = await apiMutate<TournamentPublic>("/api/tournament/eliminate", {
          method: "POST",
          body: JSON.stringify({
            playerId: target.id,
            pin: pin.trim(),
            fromMobile: true,
            killerId,
          }),
        });
        setTournament(next);
        setMessage(
          killerId
            ? `${target.name} éliminé (killer enregistré).`
            : `${target.name} éliminé.`,
        );
        setTarget(null);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const runTimer = (action: TimerAction, label: string) => {
    if (!requirePin()) return;
    startTransition(async () => {
      try {
        setLocalError(null);
        setMessage(null);
        const next = await apiMutate<TournamentPublic>("/api/tournament/timer", {
          method: "POST",
          body: JSON.stringify({
            action,
            pin: pin.trim(),
            fromMobile: true,
          }),
        });
        setTournament(next);
        setMessage(label);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const level = tournament.currentLevel;
  const running = tournament.status === "running";

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Floor mobile
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{tournament.remainingPlayers} restants</Badge>
          <Badge variant="outline">{tournament.openTables} tables</Badge>
          <a className="text-xs underline underline-offset-4 self-center" href="/standings">
            Classement
          </a>
        </div>
      </header>

      {tournament.status === "setup" ? (
        <Alert>
          <AlertTitle>
            {tournament.tables.some((t) => t.open)
              ? "Placement en cours"
              : "Tournoi pas encore lancé"}
          </AlertTitle>
          <AlertDescription>
            {tournament.tables.some((t) => t.open)
              ? "Les joueurs peuvent rejoindre leurs tables. Chrono et éliminations après le départ."
              : "Les éliminations et le chrono seront disponibles après le placement puis le départ sur la console directeur."}
          </AlertDescription>
        </Alert>
      ) : null}

      {tournament.status === "finished" ? (
        <Alert className="mb-4">
          <AlertTitle>Tournoi terminé</AlertTitle>
          <AlertDescription>
            Plus aucune élimination à saisir.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium" htmlFor="pin">
          PIN directeur
        </label>
        <Input
          id="pin"
          className="mt-2 tracking-[0.35em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          disabled={pending || tournament.status !== "running"}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Le PIN est affiché en grand sur l’écran du directeur. Requis pour
          éliminer ou contrôler le chrono.
        </p>
      </section>

      {running ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Chrono</h2>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums">
            {formatClock(remainingMs)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {level
              ? isBreak(level)
                ? `Pause${level.message ? ` · ${level.message}` : ""}`
                : `Niveau ${tournament.timer.levelIndex + 1} · ${formatChips(level.smallBlind)}/${formatChips(level.bigBlind)}${level.ante ? ` · ante ${formatChips(level.ante)}` : ""}`
              : "Aucun niveau"}
            {tournament.timer.running ? " · en lecture" : " · chrono arrêté"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tournament.timer.running ? (
              <Button
                disabled={pending}
                onClick={() => runTimer("pause", "Chrono en pause.")}
              >
                Pause
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() => runTimer("play", "Chrono repris.")}
              >
                Lecture
              </Button>
            )}
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => runTimer("next", "Niveau suivant.")}
            >
              Passer le niveau
            </Button>
          </div>
        </section>
      ) : null}

      {localError ? (
        <p className="mt-3 text-sm text-destructive">{localError}</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Joueurs actifs</h2>
        {actives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun joueur actif.</p>
        ) : (
          <ul className="space-y-2">
            {actives.map((p) => {
              const table = tournament.tables.find((t) => t.id === p.tableId);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {table
                        ? `Table ${table.number} · siège ${p.seat}`
                        : "Placement en cours"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending || !running}
                    onClick={() => setTarget(p)}
                  >
                    Éliminer
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {eliminated.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Éliminés</h2>
          <ul className="space-y-2 text-sm">
            {eliminated.map((p) => (
              <li
                key={p.id}
                className="flex justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 opacity-80"
              >
                <span>
                  {p.name}
                  {p.killerName ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · Killer {p.killerName}
                    </span>
                  ) : null}
                </span>
                <span>#{p.place}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EliminateDialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        player={target}
        candidates={actives.filter((p) => p.id !== target?.id)}
        pending={pending}
        onConfirm={confirmEliminate}
      />
    </main>
  );
}

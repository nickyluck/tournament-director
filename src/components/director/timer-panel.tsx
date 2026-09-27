"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { isBreak } from "@/lib/tournament/blinds";
import { formatClock, formatChips } from "@/lib/tournament/helpers";
import { apiMutate } from "@/hooks/use-tournament";
import type { TimerAction, TournamentPublic } from "@/lib/tournament/types";

export function TimerPanel({
  tournament,
  remainingMs,
  onUpdate,
}: {
  tournament: TournamentPublic;
  remainingMs: number;
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [pending, startTransition] = useTransition();
  const level = tournament.currentLevel;
  const disabled = tournament.status === "setup" || pending;

  const run = (action: TimerAction) => {
    startTransition(async () => {
      const next = await apiMutate("/api/tournament/timer", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      onUpdate(next);
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Timer</h2>
      <div className="mt-3 flex flex-col gap-1">
        <p className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
          {formatClock(remainingMs)}
        </p>
        <p className="text-sm text-muted-foreground">
          {level
            ? isBreak(level)
              ? `Pause · ${level.durationMinutes} min${level.message ? ` · ${level.message}` : ""}`
              : `Niveau ${tournament.timer.levelIndex + 1} · ${formatChips(level.smallBlind)}/${formatChips(level.bigBlind)}${level.ante ? ` ante ${formatChips(level.ante)}` : ""} · ${level.durationMinutes} min`
            : "Aucun niveau"}
          {tournament.timer.running ? " · en lecture" : " · chrono arrêté"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tournament.timer.running ? (
          <Button disabled={disabled} onClick={() => run("pause")}>
            Pause
          </Button>
        ) : (
          <Button disabled={disabled} onClick={() => run("play")}>
            Lecture
          </Button>
        )}
        <Button disabled={disabled} variant="secondary" onClick={() => run("plus1")}>
          +1 min
        </Button>
        <Button disabled={disabled} variant="outline" onClick={() => run("prev")}>
          Niveau −
        </Button>
        <Button disabled={disabled} variant="outline" onClick={() => run("next")}>
          Niveau +
        </Button>
      </div>
    </section>
  );
}

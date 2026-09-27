"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeatingMove, TournamentPublic } from "@/lib/tournament/types";

const reasonLabel = {
  initial: "Placement",
  rebalance: "Rééquilibrage",
  break: "Casse de table",
  manual: "Déplacement manuel",
} as const;

export function formatMoveLine(m: SeatingMove): string {
  if (m.fromTable == null) {
    return `${m.playerName} → Table ${m.toTable} · siège ${m.toSeat}`;
  }
  if (m.fromTable === m.toTable) {
    return `${m.playerName} · Table ${m.toTable} : siège → ${m.toSeat}`;
  }
  return `${m.playerName} · T${m.fromTable} → T${m.toTable} siège ${m.toSeat}`;
}

type MoveGroup = {
  key: string;
  reason: SeatingMove["reason"];
  at: string;
  title: string;
  lines: string[];
};

function groupRecentMoves(moves: SeatingMove[], limit = 8): MoveGroup[] {
  const groups: MoveGroup[] = [];
  for (const m of moves.slice(0, 30)) {
    const bucketKey =
      m.reason === "break"
        ? `break:${m.at}:${m.fromTable ?? "x"}`
        : m.id;
    const existing = groups.find((g) => g.key === bucketKey);
    if (existing) {
      existing.lines.push(formatMoveLine(m));
      continue;
    }
    const title =
      m.reason === "break" && m.fromTable != null
        ? `Table ${m.fromTable} cassée`
        : reasonLabel[m.reason];
    groups.push({
      key: bucketKey,
      reason: m.reason,
      at: m.at,
      title,
      lines: [formatMoveLine(m)],
    });
    if (groups.length >= limit) break;
  }
  return groups;
}

export function FloorMovesAlert({
  tournament,
  compact = false,
}: {
  tournament: TournamentPublic;
  compact?: boolean;
}) {
  const groups = useMemo(
    () => groupRecentMoves(tournament.moves),
    [tournament.moves],
  );
  const flashKey = groups[0]?.key ?? "";
  const [flash, setFlash] = useState(false);
  const prevKey = useRef<string>("");

  useEffect(() => {
    if (!flashKey || flashKey === prevKey.current) return;
    const isFirst = prevKey.current === "";
    prevKey.current = flashKey;
    if (isFirst) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 4000);
    return () => window.clearTimeout(t);
  }, [flashKey]);

  if (groups.length === 0) {
    return (
      <section
        className={`rounded-xl border border-dashed border-border bg-muted/20 ${compact ? "p-3" : "p-4"}`}
      >
        <h2 className={`font-semibold ${compact ? "text-base" : "text-lg"}`}>
          Mouvements floor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aucun déplacement pour l’instant.
        </p>
      </section>
    );
  }

  const latest = groups[0];
  const isBreak = latest.reason === "break";
  const isUrgent = latest.reason === "break" || latest.reason === "manual" || latest.reason === "rebalance";

  return (
    <section
      className={`rounded-xl border p-4 transition-shadow ${
        flash
          ? "border-amber-500 bg-amber-100 shadow-[0_0_0_3px_rgba(245,158,11,0.35)]"
          : isBreak
            ? "border-amber-400 bg-amber-50"
            : isUrgent
              ? "border-sky-300 bg-sky-50"
              : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mouvements floor
            {flash ? " · Nouveau" : ""}
          </p>
          <h2 className={`mt-1 font-semibold ${compact ? "text-lg" : "text-xl"}`}>
            {latest.title}
          </h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isBreak
              ? "bg-amber-200 text-amber-950"
              : latest.reason === "manual"
                ? "bg-sky-200 text-sky-950"
                : "bg-slate-200 text-slate-800"
          }`}
        >
          {reasonLabel[latest.reason]}
        </span>
      </div>

      <ul className={`mt-3 space-y-1.5 ${compact ? "text-sm" : "text-base"}`}>
        {latest.lines.map((line) => (
          <li key={line} className="font-medium leading-snug">
            {line}
          </li>
        ))}
      </ul>

      {groups.length > 1 ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Précédents
          </p>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
            {groups.slice(1).map((g) => (
              <li key={g.key} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                <p className="font-medium">
                  {g.title}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {reasonLabel[g.reason]}
                  </span>
                </p>
                {g.lines.slice(0, 4).map((line) => (
                  <p key={line} className="text-muted-foreground">
                    {line}
                  </p>
                ))}
                {g.lines.length > 4 ? (
                  <p className="text-xs text-muted-foreground">
                    +{g.lines.length - 4} autre(s)
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

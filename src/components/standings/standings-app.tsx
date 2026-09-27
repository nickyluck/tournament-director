"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useTournamentStream } from "@/hooks/use-tournament";
import type { Player, TournamentPublic } from "@/lib/tournament/types";

type StandingRow = {
  player: Player;
  kills: number;
  sortPlace: number;
};

function buildStandings(tournament: TournamentPublic): StandingRow[] {
  const kills = new Map<string, number>();
  for (const p of tournament.players) {
    if (p.killerId) {
      kills.set(p.killerId, (kills.get(p.killerId) ?? 0) + 1);
    }
  }

  const activeCount = tournament.players.filter((p) => p.status === "active").length;

  return tournament.players
    .map((player) => {
      const sortPlace =
        player.place ??
        (player.status === "active" ? (activeCount > 1 ? 0 : 1) : 999);
      return {
        player,
        kills: kills.get(player.id) ?? 0,
        sortPlace: player.status === "active" && player.place == null ? 0 : sortPlace,
      };
    })
    .sort((a, b) => {
      // Actives (place null) first as "en lice", then by place ascending
      const aActive = a.player.status === "active" && a.player.place == null;
      const bActive = b.player.status === "active" && b.player.place == null;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (aActive && bActive) {
        return a.player.name.localeCompare(b.player.name, "fr");
      }
      return (a.player.place ?? 999) - (b.player.place ?? 999);
    });
}

export function StandingsApp() {
  const { tournament, loading, error } = useTournamentStream();

  const rows = useMemo(
    () => (tournament ? buildStandings(tournament) : []),
    [tournament],
  );

  if (loading && !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4">
        <p className="text-muted-foreground">Chargement du classement…</p>
      </main>
    );
  }

  if ((error && !tournament) || !tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4">
        <p className="text-destructive">{error ?? "Tournoi indisponible"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,#eef2ff)]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Classement
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{tournament.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tournament.remainingPlayers} restants · {tournament.entrants || tournament.players.length}{" "}
              entrants
            </p>
          </div>
          <Link className="text-sm underline underline-offset-4" href="/">
            Retour directeur
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Place</th>
                <th className="px-4 py-3">Joueur</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Killer</th>
                <th className="px-4 py-3 text-right">Kills</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun joueur inscrit.
                  </td>
                </tr>
              ) : (
                rows.map(({ player, kills }) => (
                  <tr key={player.id} className="border-t border-border/70">
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {player.place != null ? `#${player.place}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{player.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          player.status === "active"
                            ? player.place === 1
                              ? "default"
                              : "secondary"
                            : "outline"
                        }
                      >
                        {player.status === "active"
                          ? player.place === 1
                            ? "Vainqueur"
                            : "En lice"
                          : "Éliminé"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {player.killerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{kills}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

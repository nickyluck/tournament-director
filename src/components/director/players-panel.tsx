"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EliminateDialog } from "@/components/eliminate-dialog";
import { apiMutate } from "@/hooks/use-tournament";
import type { Player, TournamentPublic } from "@/lib/tournament/types";

export function PlayersPanel({
  tournament,
  onUpdate,
}: {
  tournament: TournamentPublic;
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Player | null>(null);
  const setup = tournament.status === "setup";

  const submit = () => {
    const value = name.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        setError(null);
        const next = await apiMutate("/api/tournament/players", {
          method: "POST",
          body: JSON.stringify({ name: value }),
        });
        onUpdate(next);
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const remove = (playerId: string) => {
    startTransition(async () => {
      try {
        setError(null);
        const next = await apiMutate("/api/tournament/players", {
          method: "DELETE",
          body: JSON.stringify({ playerId }),
        });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const confirmEliminate = (killerId: string | null) => {
    if (!target) return;
    startTransition(async () => {
      try {
        setError(null);
        const next = await apiMutate("/api/tournament/eliminate", {
          method: "POST",
          body: JSON.stringify({ playerId: target.id, killerId }),
        });
        onUpdate(next);
        setTarget(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const actives = tournament.players.filter((p) => p.status === "active");
  const eliminated = [...tournament.players]
    .filter((p) => p.status === "eliminated")
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Joueurs</h2>
        <Badge variant="secondary">{tournament.players.length} inscrits</Badge>
      </div>

      {setup ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du joueur"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            Ajouter
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {tournament.players.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun joueur pour l’instant. Ajoutez les inscrits avant le départ.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {actives.map((p) => {
            const table = tournament.tables.find((t) => t.id === p.tableId);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {table
                      ? `Table ${table.number} · siège ${p.seat}`
                      : setup
                        ? "En attente de seating"
                        : "Sans table"}
                  </p>
                </div>
                {setup ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(p.id)}
                  >
                    Retirer
                  </Button>
                ) : tournament.status === "running" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => setTarget(p)}
                  >
                    Éliminer
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {eliminated.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground">Éliminés</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {eliminated.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 opacity-70">
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
        </div>
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
    </section>
  );
}

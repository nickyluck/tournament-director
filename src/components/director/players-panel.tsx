"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EliminateDialog } from "@/components/eliminate-dialog";
import { useLibrary } from "@/hooks/use-library";
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
  const [rosterName, setRosterName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Player | null>(null);
  const { library, refresh: refreshLibrary, mutate: mutateLibrary } = useLibrary();
  const setup = tournament.status === "setup";

  const enrolledNames = useMemo(
    () => new Set(tournament.players.map((p) => p.name.toLowerCase())),
    [tournament.players],
  );

  const roster = library?.players ?? [];
  const available = roster.filter((p) => !enrolledNames.has(p.name.toLowerCase()));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitNew = () => {
    const value = name.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/players", {
          method: "POST",
          body: JSON.stringify({ name: value, saveToRoster: true }),
        });
        onUpdate(next);
        setName("");
        await refreshLibrary();
        setMessage(`${value} inscrit et ajouté à l’annuaire.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const enrollSelected = () => {
    const names = available.filter((p) => selected.has(p.id)).map((p) => p.name);
    if (names.length === 0) return;
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/players", {
          method: "POST",
          body: JSON.stringify({ names, saveToRoster: false }),
        });
        onUpdate(next);
        setSelected(new Set());
        setMessage(`${names.length} joueur(s) inscrit(s).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const addToRosterOnly = () => {
    const value = rosterName.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        await mutateLibrary("/api/library/players", {
          method: "POST",
          body: JSON.stringify({ name: value }),
        });
        setRosterName("");
        setMessage(`${value} ajouté à l’annuaire.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const deleteFromRoster = (id: string, playerName: string) => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        await mutateLibrary("/api/library/players", {
          method: "DELETE",
          body: JSON.stringify({ id }),
        });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setMessage(`${playerName} retiré de l’annuaire.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const remove = (playerId: string) => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
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
        setMessage(null);
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
        <>
          <div className="mt-4 rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Annuaire</h3>
              <Badge variant="outline">{roster.length} enregistrés</Badge>
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addToRosterOnly();
              }}
            >
              <Input
                value={rosterName}
                onChange={(e) => setRosterName(e.target.value)}
                placeholder="Nouveau joueur dans l’annuaire"
                disabled={pending}
              />
              <Button type="submit" variant="secondary" disabled={pending || !rosterName.trim()}>
                Ajouter
              </Button>
            </form>

            {roster.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun joueur enregistré. Ajoutez des noms pour les réutiliser.
              </p>
            ) : (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {roster.map((p) => {
                  const enrolled = enrolledNames.has(p.name.toLowerCase());
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-slate-900"
                          disabled={pending || enrolled}
                          checked={enrolled || selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                        />
                        <span className={enrolled ? "text-muted-foreground line-through" : ""}>
                          {p.name}
                        </span>
                        {enrolled ? (
                          <span className="text-xs text-muted-foreground">inscrit</span>
                        ) : null}
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => deleteFromRoster(p.id, p.name)}
                      >
                        Suppr.
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || selected.size === 0}
                onClick={enrollSelected}
              >
                Inscrire la sélection ({selected.size})
              </Button>
              {available.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setSelected(new Set(available.map((p) => p.id)))}
                >
                  Tout sélectionner
                </Button>
              ) : null}
            </div>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitNew();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inscrire un nouveau joueur"
              disabled={pending}
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              Inscrire
            </Button>
          </form>
        </>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}

      {tournament.players.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun joueur pour l’instant. Sélectionnez dans l’annuaire ou inscrivez-en de nouveaux.
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
                        ? "En attente de placement"
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

"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createId, formatChips, sampleBlindStructure } from "@/lib/tournament/helpers";
import { apiMutate } from "@/hooks/use-tournament";
import type { BlindLevel, TournamentPublic } from "@/lib/tournament/types";

export function SetupPanel({
  tournament,
  onUpdate,
}: {
  tournament: TournamentPublic;
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [name, setName] = useState(tournament.name);
  const [startingStack, setStartingStack] = useState(String(tournament.startingStack));
  const [seatsPerTable, setSeatsPerTable] = useState(String(tournament.seatsPerTable));
  const [tableCount, setTableCount] = useState(String(tournament.configuredTableCount));
  const [blinds, setBlinds] = useState<BlindLevel[]>(tournament.blinds);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(tournament.name);
    setStartingStack(String(tournament.startingStack));
    setSeatsPerTable(String(tournament.seatsPerTable));
    setTableCount(String(tournament.configuredTableCount));
    setBlinds(tournament.blinds);
  }, [
    tournament.updatedAt,
    tournament.name,
    tournament.startingStack,
    tournament.seatsPerTable,
    tournament.configuredTableCount,
    tournament.blinds,
  ]);

  const locked = tournament.status !== "setup";

  const save = () => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/config", {
          method: "PATCH",
          body: JSON.stringify({
            name,
            startingStack: Number(startingStack),
            seatsPerTable: Number(seatsPerTable),
            configuredTableCount: Number(tableCount),
            blinds,
          }),
        });
        onUpdate(next);
        setMessage("Configuration enregistrée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const start = () => {
    startTransition(async () => {
      try {
        setError(null);
        // Persist config first
        await apiMutate("/api/tournament/config", {
          method: "PATCH",
          body: JSON.stringify({
            name,
            startingStack: Number(startingStack),
            seatsPerTable: Number(seatsPerTable),
            configuredTableCount: Number(tableCount),
            blinds,
          }),
        });
        const next = await apiMutate("/api/tournament/start", { method: "POST" });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const updateBlind = (id: string, patch: Partial<BlindLevel>) => {
    setBlinds((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Configuration</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tables, stack de départ et structure de blindes. Verrouillé après le lancement.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Nom du tournoi">
          <Input value={name} disabled={locked || pending} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Stack de départ">
          <Input
            type="number"
            value={startingStack}
            disabled={locked || pending}
            onChange={(e) => setStartingStack(e.target.value)}
          />
        </Field>
        <Field label="Nombre de tables">
          <Input
            type="number"
            min={1}
            value={tableCount}
            disabled={locked || pending}
            onChange={(e) => setTableCount(e.target.value)}
          />
        </Field>
        <Field label="Places par table">
          <Input
            type="number"
            min={2}
            max={10}
            value={seatsPerTable}
            disabled={locked || pending}
            onChange={(e) => setSeatsPerTable(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Blindes</h3>
        {!locked ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setBlinds(sampleBlindStructure())}
            >
              Modèle sample
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                setBlinds((prev) => [
                  ...prev,
                  {
                    id: createId("blind"),
                    durationMinutes: 20,
                    smallBlind: (prev.at(-1)?.smallBlind ?? 100) * 2,
                    bigBlind: (prev.at(-1)?.bigBlind ?? 200) * 2,
                    ante: prev.at(-1)?.ante ?? 0,
                  },
                ])
              }
            >
              + Niveau
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Durée (min)</th>
              <th className="py-2 pr-2">SB</th>
              <th className="py-2 pr-2">BB</th>
              <th className="py-2 pr-2">Ante</th>
              {!locked ? <th className="py-2"> </th> : null}
            </tr>
          </thead>
          <tbody>
            {blinds.map((b, i) => (
              <tr key={b.id} className="border-t border-border/60">
                <td className="py-2 pr-2 tabular-nums">{i + 1}</td>
                <td className="py-2 pr-2">
                  <Input
                    className="h-8 w-20"
                    type="number"
                    disabled={locked || pending}
                    value={b.durationMinutes}
                    onChange={(e) =>
                      updateBlind(b.id, { durationMinutes: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    className="h-8 w-24"
                    type="number"
                    disabled={locked || pending}
                    value={b.smallBlind}
                    onChange={(e) =>
                      updateBlind(b.id, { smallBlind: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    className="h-8 w-24"
                    type="number"
                    disabled={locked || pending}
                    value={b.bigBlind}
                    onChange={(e) =>
                      updateBlind(b.id, { bigBlind: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    className="h-8 w-24"
                    type="number"
                    disabled={locked || pending}
                    value={b.ante}
                    onChange={(e) =>
                      updateBlind(b.id, { ante: Number(e.target.value) })
                    }
                  />
                </td>
                {!locked ? (
                  <td className="py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending || blinds.length <= 1}
                      onClick={() => setBlinds((prev) => prev.filter((x) => x.id !== b.id))}
                    >
                      Suppr.
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={save}>
            Enregistrer
          </Button>
          <Button type="button" disabled={pending} onClick={start}>
            Démarrer le tournoi
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Structure active — niveau {tournament.timer.levelIndex + 1} / {tournament.blinds.length}.
          Stack départ {formatChips(tournament.startingStack)}.
        </p>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

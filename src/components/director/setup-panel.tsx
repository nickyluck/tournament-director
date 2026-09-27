"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lastPlayLevel } from "@/lib/tournament/blinds";
import { createId, formatChips, sampleBlindStructure } from "@/lib/tournament/helpers";
import { useLibrary } from "@/hooks/use-library";
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
  const [finalTableSeats, setFinalTableSeats] = useState(String(tournament.finalTableSeats));
  const [tableCount, setTableCount] = useState(String(tournament.configuredTableCount));
  const [blinds, setBlinds] = useState<BlindLevel[]>(tournament.blinds);
  const [breakOrder, setBreakOrder] = useState<string[]>(tournament.breakOrder);
  const [structureName, setStructureName] = useState("");
  const [selectedStructureId, setSelectedStructureId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { library, mutate: mutateLibrary } = useLibrary();

  const setup = tournament.status === "setup";
  const running = tournament.status === "running";
  const structureEditable = setup || running;
  const metaEditable = setup;
  const lockedPrefix = running ? tournament.timer.levelIndex : 0;

  useEffect(() => {
    setName(tournament.name);
    setStartingStack(String(tournament.startingStack));
    setSeatsPerTable(String(tournament.seatsPerTable));
    setFinalTableSeats(String(tournament.finalTableSeats));
    setTableCount(String(tournament.configuredTableCount));
    setBlinds(tournament.blinds);
    setBreakOrder(tournament.breakOrder);
  }, [
    tournament.updatedAt,
    tournament.name,
    tournament.startingStack,
    tournament.seatsPerTable,
    tournament.finalTableSeats,
    tournament.configuredTableCount,
    tournament.blinds,
    tournament.breakOrder,
  ]);

  const structures = library?.structures ?? [];
  const playersSeated =
    tournament.players.filter((p) => p.status === "active").length >= 2 &&
    tournament.tables.some((t) => t.open) &&
    tournament.players
      .filter((p) => p.status === "active")
      .every((p) => p.tableId != null && p.seat != null);

  const openTables = useMemo(
    () =>
      [...tournament.tables]
        .filter((t) => t.open)
        .sort((a, b) => {
          const ia = breakOrder.indexOf(a.id);
          const ib = breakOrder.indexOf(b.id);
          if (ia === -1 && ib === -1) return b.number - a.number;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        }),
    [tournament.tables, breakOrder],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableBlindIds = useMemo(() => blinds.map((b) => b.id), [blinds]);

  const saveConfig = (extra?: {
    blinds?: BlindLevel[];
    breakOrder?: string[];
  }) => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/config", {
          method: "PATCH",
          body: JSON.stringify({
            name,
            startingStack: Number(startingStack),
            ...(metaEditable
              ? {
                  seatsPerTable: Number(seatsPerTable),
                  finalTableSeats: Number(finalTableSeats),
                  configuredTableCount: Number(tableCount),
                }
              : {}),
            blinds: extra?.blinds ?? blinds,
            breakOrder: extra?.breakOrder ?? breakOrder,
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
        await apiMutate("/api/tournament/config", {
          method: "PATCH",
          body: JSON.stringify({
            name,
            startingStack: Number(startingStack),
            seatsPerTable: Number(seatsPerTable),
            finalTableSeats: Number(finalTableSeats),
            configuredTableCount: Number(tableCount),
            blinds,
            breakOrder,
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

  const onBlindDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlinds((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex < lockedPrefix || newIndex < lockedPrefix) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const onBreakDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = openTables.map((t) => t.id);
    const ordered = [
      ...breakOrder.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !breakOrder.includes(id)),
    ];
    const oldIndex = ordered.indexOf(String(active.id));
    const newIndex = ordered.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(ordered, oldIndex, newIndex);
    setBreakOrder(nextOrder);
    startTransition(async () => {
      try {
        setError(null);
        const next = await apiMutate("/api/tournament/config", {
          method: "PATCH",
          body: JSON.stringify({ breakOrder: nextOrder }),
        });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const loadStructure = (id: string) => {
    const structure = structures.find((s) => s.id === id);
    if (!structure) return;
    setBlinds(structure.blinds.map((b) => ({ ...b, id: createId("blind") })));
    setStructureName(structure.name);
    setSelectedStructureId(structure.id);
    setMessage(`Structure « ${structure.name} » chargée.`);
  };

  const saveStructure = () => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await mutateLibrary("/api/library/structures", {
          method: "POST",
          body: JSON.stringify({
            id: selectedStructureId || undefined,
            name: structureName.trim() || "Structure",
            blinds,
          }),
        });
        const saved =
          next.structures.find(
            (s) => s.name.toLowerCase() === (structureName.trim() || "Structure").toLowerCase(),
          ) ?? next.structures.at(-1);
        if (saved) {
          setSelectedStructureId(saved.id);
          setStructureName(saved.name);
        }
        setMessage("Structure enregistrée dans la bibliothèque.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const deleteStructure = () => {
    if (!selectedStructureId) return;
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        await mutateLibrary("/api/library/structures", {
          method: "DELETE",
          body: JSON.stringify({ id: selectedStructureId }),
        });
        setSelectedStructureId("");
        setMessage("Structure supprimée de la bibliothèque.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const addLevel = () => {
    const last = lastPlayLevel(blinds);
    setBlinds((prev) => [
      ...prev,
      {
        id: createId("blind"),
        kind: "level",
        durationMinutes: last?.durationMinutes ?? 20,
        smallBlind: (last?.smallBlind ?? 100) * 2,
        bigBlind: (last?.bigBlind ?? 200) * 2,
        ante: last?.ante ?? 0,
        message: null,
      },
    ]);
  };

  const addBreak = () => {
    setBlinds((prev) => [
      ...prev,
      {
        id: createId("blind"),
        kind: "break",
        durationMinutes: 10,
        smallBlind: 0,
        bigBlind: 0,
        ante: 0,
        message: "Changement de jetons",
      },
    ]);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Configuration</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {running
          ? "Structure éditable pour le niveau courant et les suivants."
          : "Tables, stack, structure et ordre de cassage."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Nom du tournoi">
          <Input
            value={name}
            disabled={!structureEditable || pending}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Stack de départ">
          <Input
            type="number"
            value={startingStack}
            disabled={!structureEditable || pending}
            onChange={(e) => setStartingStack(e.target.value)}
          />
        </Field>
        <Field label="Nombre de tables">
          <Input
            type="number"
            min={1}
            value={tableCount}
            disabled={!metaEditable || pending}
            onChange={(e) => setTableCount(e.target.value)}
          />
        </Field>
        <Field label="Places par table">
          <Input
            type="number"
            min={2}
            max={10}
            value={seatsPerTable}
            disabled={!metaEditable || pending}
            onChange={(e) => setSeatsPerTable(e.target.value)}
          />
        </Field>
        <Field label="Places table finale">
          <Input
            type="number"
            min={2}
            max={10}
            value={finalTableSeats}
            disabled={!metaEditable || pending}
            onChange={(e) => setFinalTableSeats(e.target.value)}
          />
        </Field>
      </div>

      {openTables.length > 0 ? (
        <div className="mt-6">
          <h3 className="font-medium">Ordre de cassage</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            De haut en bas : première table cassée en priorité.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBreakDragEnd}>
            <SortableContext items={openTables.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-3 space-y-2">
                {openTables.map((table, index) => (
                  <SortableBreakRow
                    key={table.id}
                    id={table.id}
                    label={`Table ${table.number}`}
                    priority={index + 1}
                    disabled={pending || (!setup && !running)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Structure de blindes</h3>
        {structureEditable ? (
          <div className="flex flex-wrap gap-2">
            {setup ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setBlinds(sampleBlindStructure());
                  setSelectedStructureId("");
                }}
              >
                Modèle sample
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={addLevel}>
              + Niveau
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={addBreak}>
              + Pause
            </Button>
          </div>
        ) : null}
      </div>

      {setup ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Bibliothèque de structures">
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={selectedStructureId}
              disabled={pending}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStructureId(id);
                if (id) loadStructure(id);
              }}
            >
              <option value="">— Choisir une structure enregistrée —</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.blinds.length} étapes)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nom pour enregistrer">
            <Input
              value={structureName}
              disabled={pending}
              placeholder="ex. MTT soirée"
              onChange={(e) => setStructureName(e.target.value)}
            />
          </Field>
          <div className="flex gap-2 pb-0.5">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={saveStructure}>
              Enregistrer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending || !selectedStructureId}
              onClick={deleteStructure}
            >
              Suppr.
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlindDragEnd}>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-2 w-8" />
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Durée</th>
                <th className="py-2 pr-2">SB</th>
                <th className="py-2 pr-2">BB</th>
                <th className="py-2 pr-2">Ante</th>
                <th className="py-2 pr-2">Message</th>
                {structureEditable ? <th className="py-2"> </th> : null}
              </tr>
            </thead>
            <SortableContext items={sortableBlindIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {blinds.map((b, i) => {
                  const frozen = i < lockedPrefix;
                  return (
                    <SortableBlindRow
                      key={b.id}
                      blind={b}
                      index={i}
                      frozen={frozen}
                      pending={pending}
                      structureEditable={structureEditable}
                      canDelete={structureEditable && !frozen && blinds.length > lockedPrefix + 1}
                      onUpdate={updateBlind}
                      onDelete={() =>
                        setBlinds((prev) => prev.filter((x) => x.id !== b.id))
                      }
                    />
                  );
                })}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {structureEditable ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => saveConfig()}
          >
            Enregistrer
          </Button>
          {setup ? (
            <>
              <Button type="button" disabled={pending || !playersSeated} onClick={start}>
                Démarrer le tournoi
              </Button>
              {!playersSeated ? (
                <p className="w-full text-sm text-muted-foreground">
                  Placez d’abord les joueurs (panneau Tables) avant de démarrer le chrono.
                </p>
              ) : (
                <p className="w-full text-sm text-emerald-700">
                  Placement prêt — démarrez quand les joueurs sont installés.
                </p>
              )}
            </>
          ) : (
            <p className="w-full text-sm text-muted-foreground">
              Les niveaux déjà joués restent figés. Enregistrez pour appliquer.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Structure active — étape {tournament.timer.levelIndex + 1} / {tournament.blinds.length}.
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

function SortableBreakRow({
  id,
  label,
  priority,
  disabled,
}: {
  id: string;
  label: string;
  priority: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Réordonner"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <span className="text-xs tabular-nums text-muted-foreground">#{priority}</span>
      <span className="font-medium">{label}</span>
    </li>
  );
}

function SortableBlindRow({
  blind,
  index,
  frozen,
  pending,
  structureEditable,
  canDelete,
  onUpdate,
  onDelete,
}: {
  blind: BlindLevel;
  index: number;
  frozen: boolean;
  pending: boolean;
  structureEditable: boolean;
  canDelete: boolean;
  onUpdate: (id: string, patch: Partial<BlindLevel>) => void;
  onDelete: () => void;
}) {
  const isBreak = blind.kind === "break";
  const editable = structureEditable && !frozen && !pending;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blind.id,
    disabled: !editable,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : frozen ? 0.55 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t border-border/60 ${isBreak ? "bg-amber-50/60" : ""} ${frozen ? "bg-muted/30" : ""}`}
    >
      <td className="py-2 pr-1">
        {editable ? (
          <button
            type="button"
            className="cursor-grab touch-none px-1 text-muted-foreground active:cursor-grabbing"
            aria-label="Réordonner"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : (
          <span className="px-1 text-muted-foreground/40">·</span>
        )}
      </td>
      <td className="py-2 pr-2 tabular-nums">{index + 1}</td>
      <td className="py-2 pr-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            isBreak ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
          }`}
        >
          {isBreak ? "Pause" : "Niveau"}
        </span>
      </td>
      <td className="py-2 pr-2">
        <Input
          className="h-8 w-20"
          type="number"
          disabled={!editable}
          value={blind.durationMinutes}
          onChange={(e) => onUpdate(blind.id, { durationMinutes: Number(e.target.value) })}
        />
      </td>
      <td className="py-2 pr-2">
        {isBreak ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Input
            className="h-8 w-24"
            type="number"
            disabled={!editable}
            value={blind.smallBlind}
            onChange={(e) => onUpdate(blind.id, { smallBlind: Number(e.target.value) })}
          />
        )}
      </td>
      <td className="py-2 pr-2">
        {isBreak ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Input
            className="h-8 w-24"
            type="number"
            disabled={!editable}
            value={blind.bigBlind}
            onChange={(e) => onUpdate(blind.id, { bigBlind: Number(e.target.value) })}
          />
        )}
      </td>
      <td className="py-2 pr-2">
        {isBreak ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Input
            className="h-8 w-24"
            type="number"
            disabled={!editable}
            value={blind.ante}
            onChange={(e) => onUpdate(blind.id, { ante: Number(e.target.value) })}
          />
        )}
      </td>
      <td className="py-2 pr-2">
        <Input
          className="h-8 min-w-[160px]"
          disabled={!editable || !isBreak}
          placeholder={isBreak ? "ex. changement de jetons" : ""}
          value={blind.message ?? ""}
          onChange={(e) =>
            onUpdate(blind.id, {
              message: e.target.value.length > 0 ? e.target.value : null,
            })
          }
        />
      </td>
      {structureEditable ? (
        <td className="py-2">
          <Button type="button" size="sm" variant="ghost" disabled={!canDelete || pending} onClick={onDelete}>
            Suppr.
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

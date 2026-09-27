"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiMutate } from "@/hooks/use-tournament";
import type { Player, TournamentPublic } from "@/lib/tournament/types";

function isSeated(tournament: TournamentPublic): boolean {
  const actives = tournament.players.filter((p) => p.status === "active");
  return (
    actives.length >= 2 &&
    tournament.tables.some((t) => t.open) &&
    actives.every((p) => p.tableId != null && p.seat != null)
  );
}

type SeatDropId = `seat:${string}:${number}`;

function seatDropId(tableId: string, seat: number): SeatDropId {
  return `seat:${tableId}:${seat}`;
}

function parseSeatDropId(id: string): { tableId: string; seat: number } | null {
  if (!id.startsWith("seat:")) return null;
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  return { tableId: parts[1], seat: Number(parts[2]) };
}

export function TablesPanel({
  tournament,
  onUpdate,
}: {
  tournament: TournamentPublic;
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const setup = tournament.status === "setup";
  const seated = isSeated(tournament);
  const canDrag = (setup && seated) || tournament.status === "running";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of tournament.players) map.set(p.id, p);
    return map;
  }, [tournament.players]);

  const activePlayer = activePlayerId ? playersById.get(activePlayerId) ?? null : null;

  const placePlayers = () => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/seat", { method: "POST" });
        onUpdate(next);
        setMessage("Joueurs placés — glissez-déposez pour ajuster.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const rebalance = () => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/rebalance", { method: "POST" });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActivePlayerId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActivePlayerId(null);
    const { active, over } = event;
    if (!over || pending) return;
    const target = parseSeatDropId(String(over.id));
    if (!target) return;
    const playerId = String(active.id);
    const player = playersById.get(playerId);
    if (!player) return;
    if (player.tableId === target.tableId && player.seat === target.seat) return;

    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        const next = await apiMutate("/api/tournament/move", {
          method: "POST",
          body: JSON.stringify({
            playerId,
            toTableId: target.tableId,
            toSeat: target.seat,
          }),
        });
        onUpdate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  if (setup && !seated) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Tables</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tournament.configuredTableCount} table
          {tournament.configuredTableCount > 1 ? "s" : ""} prévues ·{" "}
          {tournament.seatsPerTable} places (finale {tournament.finalTableSeats}).
          Placez les joueurs avant de démarrer le chrono.
        </p>
        <Button
          className="mt-4"
          disabled={pending || tournament.players.length < 2}
          onClick={placePlayers}
        >
          Placer les joueurs
        </Button>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </section>
    );
  }

  const tables = [...tournament.tables].sort((a, b) => a.number - b.number);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tables</h2>
        {setup ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={placePlayers}>
            Replacer
          </Button>
        ) : tournament.status === "running" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={rebalance}>
            Rééquilibrer
          </Button>
        ) : null}
      </div>
      {canDrag ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Glissez un joueur vers un siège libre (ou occupé pour échanger).
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tables.map((table) => {
            const seatedHere = tournament.players.filter(
              (p) => p.status === "active" && p.tableId === table.id,
            );
            const bySeat = new Map(
              seatedHere
                .filter((p) => p.seat != null)
                .map((p) => [p.seat as number, p]),
            );
            return (
              <div
                key={table.id}
                className={`rounded-lg border px-3 py-3 ${table.open ? "border-border" : "border-dashed border-border/60 opacity-60"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">Table {table.number}</p>
                  <Badge variant={table.open ? "default" : "secondary"}>
                    {table.open ? `${seatedHere.length}/${table.seats}` : "Cassée"}
                  </Badge>
                </div>
                {table.open ? (
                  <ul className="mt-2 space-y-1.5">
                    {Array.from({ length: table.seats }, (_, i) => i + 1).map((seat) => {
                      const occupant = bySeat.get(seat) ?? null;
                      return (
                        <SeatSlot
                          key={`${table.id}-${seat}`}
                          tableId={table.id}
                          seat={seat}
                          player={occupant}
                          draggable={canDrag && !pending}
                        />
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Table fermée</p>
                )}
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activePlayer ? (
            <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm shadow-md">
              {activePlayer.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function SeatSlot({
  tableId,
  seat,
  player,
  draggable,
}: {
  tableId: string;
  seat: number;
  player: Player | null;
  draggable: boolean;
}) {
  const dropId = seatDropId(tableId, seat);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: player?.id ?? `empty-${dropId}`,
    disabled: !player || !draggable,
  });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <li
      ref={setDropRef}
      className={`flex min-h-9 items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm ${
        isOver ? "border-sky-400 bg-sky-50" : "border-border/60"
      }`}
    >
      <span className="w-12 shrink-0 text-xs text-muted-foreground">Siège {seat}</span>
      {player ? (
        <button
          type="button"
          ref={setDragRef}
          style={style}
          className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left font-medium ${
            draggable ? "cursor-grab active:cursor-grabbing hover:bg-muted/60" : ""
          } ${isDragging ? "opacity-40" : ""}`}
          {...attributes}
          {...listeners}
        >
          {player.name}
        </button>
      ) : (
        <span className="flex-1 text-muted-foreground">Libre</span>
      )}
    </li>
  );
}

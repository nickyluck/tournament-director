import { createId } from "./helpers";
import type { Player, SeatingMove, Table } from "./types";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function targetTableCount(
  remaining: number,
  seatsPerTable: number,
  finalTableSeats = seatsPerTable,
): number {
  if (remaining <= 0) return 0;
  if (remaining <= finalTableSeats) return 1;
  return Math.ceil(remaining / seatsPerTable);
}

export function syncBreakOrder(breakOrder: string[], tables: Table[]): string[] {
  const openIds = new Set(tables.filter((t) => t.open).map((t) => t.id));
  const kept = breakOrder.filter((id) => openIds.has(id));
  const missing = tables
    .filter((t) => t.open && !kept.includes(t.id))
    .sort((a, b) => b.number - a.number)
    .map((t) => t.id);
  return [...kept, ...missing];
}

export function defaultBreakOrder(tables: Table[]): string[] {
  return tables
    .filter((t) => t.open)
    .sort((a, b) => b.number - a.number)
    .map((t) => t.id);
}

function openTables(tables: Table[]): Table[] {
  return tables.filter((t) => t.open).sort((a, b) => a.number - b.number);
}

function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.status === "active");
}

function playersAtTable(players: Player[], tableId: string): Player[] {
  return activePlayers(players).filter((p) => p.tableId === tableId);
}

function freeSeats(table: Table, players: Player[]): number[] {
  const taken = new Set(
    playersAtTable(players, table.id)
      .map((p) => p.seat)
      .filter((s): s is number => s != null),
  );
  const seats: number[] = [];
  for (let s = 1; s <= table.seats; s += 1) {
    if (!taken.has(s)) seats.push(s);
  }
  return seats;
}

function assignSeat(
  players: Player[],
  playerId: string,
  table: Table,
  seat: number,
  fromTable: number | null,
  reason: SeatingMove["reason"],
  moves: SeatingMove[],
): void {
  const player = players.find((p) => p.id === playerId);
  if (!player) return;
  const changed = player.tableId !== table.id || player.seat !== seat;
  player.tableId = table.id;
  player.seat = seat;
  if (changed) {
    moves.push({
      id: createId("move"),
      playerId: player.id,
      playerName: player.name,
      fromTable,
      toTable: table.number,
      toSeat: seat,
      at: new Date().toISOString(),
      reason,
    });
  }
}

function pickTableToBreak(
  opens: Table[],
  players: Player[],
  breakOrder: string[],
): Table {
  for (const id of breakOrder) {
    const match = opens.find((t) => t.id === id);
    if (match) return match;
  }
  return [...opens].sort((a, b) => {
    const ca = playersAtTable(players, a.id).length;
    const cb = playersAtTable(players, b.id).length;
    if (ca !== cb) return ca - cb;
    return b.number - a.number;
  })[0];
}

export type RebalanceOptions = {
  finalTableSeats?: number;
  breakOrder?: string[];
};

export type RebalanceResult = {
  players: Player[];
  tables: Table[];
  moves: SeatingMove[];
  breakOrder: string[];
};

/** Création des tables et seating initial équilibré aléatoire. */
export function seatInitial(
  players: Player[],
  configuredTableCount: number,
  seatsPerTable: number,
  finalTableSeats = seatsPerTable,
): { tables: Table[]; players: Player[]; moves: SeatingMove[]; breakOrder: string[] } {
  const actives = shuffle(activePlayers(players));
  const minNeeded = targetTableCount(actives.length, seatsPerTable, finalTableSeats);
  const capacityOk = configuredTableCount * seatsPerTable >= actives.length;
  const count = Math.max(capacityOk ? configuredTableCount : minNeeded, minNeeded, 1);

  const tables: Table[] = Array.from({ length: count }, (_, i) => ({
    id: createId("table"),
    number: i + 1,
    seats: count === 1 ? Math.max(seatsPerTable, finalTableSeats, actives.length) : seatsPerTable,
    open: true,
  }));

  if (tables.length === 1) {
    tables[0].seats = Math.max(finalTableSeats, actives.length, seatsPerTable);
  }

  const nextPlayers = players.map((p) => ({ ...p, tableId: null, seat: null }));
  const moves: SeatingMove[] = [];
  const open = openTables(tables);

  actives.forEach((original, index) => {
    const table = open[index % open.length];
    const seats = freeSeats(table, nextPlayers);
    const seat = seats.length
      ? seats[Math.floor(Math.random() * seats.length)]
      : 1;
    assignSeat(nextPlayers, original.id, table, seat, null, "initial", moves);
  });

  return {
    tables,
    players: nextPlayers,
    moves,
    breakOrder: defaultBreakOrder(tables),
  };
}

/**
 * Rééquilibrage + casse de tables selon breakOrder et taille de table finale.
 * Écart max entre tables ouvertes ≤ 1.
 */
export function rebalanceAndBreak(
  players: Player[],
  tables: Table[],
  seatsPerTable: number,
  options: RebalanceOptions = {},
): RebalanceResult {
  const finalTableSeats = options.finalTableSeats ?? seatsPerTable;
  let breakOrder = [...(options.breakOrder ?? [])];
  const nextPlayers = players.map((p) => ({ ...p }));
  const nextTables = tables.map((t) => ({ ...t }));
  const moves: SeatingMove[] = [];
  const remaining = activePlayers(nextPlayers).length;
  const target = targetTableCount(remaining, seatsPerTable, finalTableSeats);

  // Apply seat capacities: multi-table uses seatsPerTable; final uses finalTableSeats.
  for (const t of nextTables) {
    if (t.open) {
      t.seats = target === 1 ? Math.max(finalTableSeats, remaining) : seatsPerTable;
    }
  }

  while (openTables(nextTables).length > target) {
    const opens = openTables(nextTables);
    if (opens.length === 0) break;

    const victim = pickTableToBreak(opens, nextPlayers, breakOrder);
    const displaced = playersAtTable(nextPlayers, victim.id);
    for (const p of displaced) {
      p.tableId = null;
      p.seat = null;
    }
    const table = nextTables.find((t) => t.id === victim.id)!;
    table.open = false;
    breakOrder = breakOrder.filter((id) => id !== victim.id);

    // Refresh capacities on remaining opens before seating displaced.
    const stillOpen = openTables(nextTables);
    for (const t of stillOpen) {
      t.seats =
        stillOpen.length === 1
          ? Math.max(finalTableSeats, remaining)
          : seatsPerTable;
    }

    for (const p of shuffle(displaced)) {
      const destinations = openTables(nextTables)
        .map((t) => ({
          table: t,
          count: playersAtTable(nextPlayers, t.id).length,
          free: freeSeats(t, nextPlayers),
        }))
        .filter((d) => d.free.length > 0)
        .sort((a, b) => a.count - b.count);

      const dest = destinations[0];
      if (!dest) break;
      assignSeat(
        nextPlayers,
        p.id,
        dest.table,
        dest.free[0],
        victim.number,
        "break",
        moves,
      );
    }
  }

  const opens = openTables(nextTables);
  const need = target - opens.length;
  if (need > 0) {
    const closed = nextTables
      .filter((t) => !t.open)
      .sort((a, b) => a.number - b.number);
    for (let i = 0; i < need; i += 1) {
      if (closed[i]) {
        closed[i].open = true;
        closed[i].seats =
          target === 1 ? Math.max(finalTableSeats, remaining) : seatsPerTable;
      } else {
        nextTables.push({
          id: createId("table"),
          number: nextTables.length + 1,
          seats: target === 1 ? Math.max(finalTableSeats, remaining) : seatsPerTable,
          open: true,
        });
      }
    }
  }

  let safety = 200;
  while (safety > 0) {
    safety -= 1;
    const live = openTables(nextTables);
    if (live.length <= 1) break;

    const scored = live
      .map((t) => ({
        table: t,
        count: playersAtTable(nextPlayers, t.id).length,
        free: freeSeats(t, nextPlayers),
      }))
      .sort((a, b) => b.count - a.count);

    const fullest = scored[0];
    const emptiest = scored[scored.length - 1];
    if (fullest.count - emptiest.count <= 1) break;
    if (emptiest.free.length === 0) break;

    const mover = shuffle(playersAtTable(nextPlayers, fullest.table.id))[0];
    if (!mover) break;

    assignSeat(
      nextPlayers,
      mover.id,
      emptiest.table,
      emptiest.free[0],
      fullest.table.number,
      "rebalance",
      moves,
    );
  }

  for (const t of nextTables) {
    if (!t.open) {
      for (const p of nextPlayers) {
        if (p.tableId === t.id) {
          p.tableId = null;
          p.seat = null;
        }
      }
    }
  }

  const finalOpens = openTables(nextTables);
  if (finalOpens.length === 1) {
    finalOpens[0].seats = Math.max(finalTableSeats, remaining);
  }

  breakOrder = syncBreakOrder(breakOrder, nextTables);

  return {
    players: nextPlayers,
    tables: nextTables,
    moves,
    breakOrder,
  };
}

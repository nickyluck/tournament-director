import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rebalanceAndBreak, seatInitial, targetTableCount } from "./seating";
import type { Player } from "./types";

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Joueur ${i + 1}`,
    status: "active" as const,
    place: null,
    tableId: null,
    seat: null,
    killerId: null,
    killerName: null,
  }));
}

describe("seating", () => {
  it("calcule le nombre cible de tables", () => {
    assert.equal(targetTableCount(18, 9), 2);
    assert.equal(targetTableCount(19, 9), 3);
    assert.equal(targetTableCount(0, 9), 0);
  });

  it("répartit équitablement au départ (écart ≤ 1)", () => {
    const { tables, players } = seatInitial(makePlayers(20), 3, 9);
    const open = tables.filter((t) => t.open);
    assert.ok(open.length >= 3);
    const counts = open.map(
      (t) => players.filter((p) => p.status === "active" && p.tableId === t.id).length,
    );
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    assert.equal(counts.reduce((a, b) => a + b, 0), 20);
  });

  it("casse la plus petite table et rééquilibre", () => {
    const seeded = seatInitial(makePlayers(10), 2, 9);
    // Eliminate players conceptually leaving 9 => 1 table
    const players = seeded.players.map((p, i) =>
      i === 0
        ? { ...p, status: "eliminated" as const, place: 10, tableId: null, seat: null }
        : p,
    );
    const result = rebalanceAndBreak(players, seeded.tables, 9);
    const open = result.tables.filter((t) => t.open);
    assert.equal(open.length, 1);
    const seated = result.players.filter((p) => p.status === "active");
    assert.equal(seated.length, 9);
    assert.ok(seated.every((p) => p.tableId === open[0].id));
  });
});

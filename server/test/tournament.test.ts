import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/db.js";
import { generateBracket, seedOrder } from "../src/tournament.js";
import type { Player } from "../src/types.js";

describe("bracket generation", () => {
  it("produces standard seed order for 8 players", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("creates size-1 matches for a power-of-two field", () => {
    const players: Player[] = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      seed: i + 1,
    }));
    const matches = generateBracket(players);
    expect(matches).toHaveLength(7);
    expect(matches.filter((m) => m.round === 1)).toHaveLength(4);
  });

  it("auto-advances byes when the field is not a power of two", () => {
    const players: Player[] = Array.from({ length: 3 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      seed: i + 1,
    }));
    const matches = generateBracket(players);
    // Bracket size 4 -> 3 matches. Top seed gets a bye into the final round.
    expect(matches).toHaveLength(3);
    const advanced = matches.filter((m) => m.round === 2 && m.player1Id !== null);
    expect(advanced.length).toBeGreaterThan(0);
  });
});

describe("tournament API end-to-end", () => {
  let dbPath: string;
  let dir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "td-test-"));
    dbPath = join(dir, "db.json");
    app = createApp(new Store(dbPath));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs a full 4-player tournament to a champion", async () => {
    const created = await request(app)
      .post("/api/tournaments")
      .send({ name: "Spring Open" })
      .expect(201);
    const id = created.body.id;

    for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
      await request(app)
        .post(`/api/tournaments/${id}/players`)
        .send({ name })
        .expect(201);
    }

    const started = await request(app)
      .post(`/api/tournaments/${id}/start`)
      .expect(200);
    expect(started.body.status).toBe("in_progress");

    let tournament = started.body;

    // Play all semifinal matches (round 1), then the final.
    for (let round = 1; round <= 2; round++) {
      const roundMatches = tournament.matches.filter(
        (m: { round: number; player1Id: string | null; player2Id: string | null; winnerId: string | null }) =>
          m.round === round && m.player1Id && m.player2Id && !m.winnerId
      );
      for (const match of roundMatches) {
        const result = await request(app)
          .post(`/api/tournaments/${id}/matches/${match.id}/result`)
          .send({ winnerId: match.player1Id })
          .expect(200);
        tournament = result.body.tournament;
      }
    }

    expect(tournament.status).toBe("completed");
    expect(tournament.championId).toBeTruthy();
  });

  it("rejects starting with fewer than 2 players", async () => {
    const created = await request(app)
      .post("/api/tournaments")
      .send({ name: "Tiny" })
      .expect(201);
    await request(app)
      .post(`/api/tournaments/${created.body.id}/players`)
      .send({ name: "Solo" })
      .expect(201);
    await request(app)
      .post(`/api/tournaments/${created.body.id}/start`)
      .expect(400);
  });
});

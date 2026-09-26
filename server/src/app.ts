import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import { Store } from "./db.js";
import { generateBracket, recordResult } from "./tournament.js";
import type { Player, Tournament } from "./types.js";

export function createApp(store: Store = new Store()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = store.getDatabase();

  const findTournament = (id: string): Tournament | undefined =>
    db.tournaments.find((t) => t.id === id);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/tournaments", (_req, res) => {
    res.json(db.tournaments);
  });

  app.post("/api/tournaments", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Tournament name is required." });
    }
    const tournament: Tournament = {
      id: randomUUID(),
      name,
      status: "registration",
      players: [],
      matches: [],
      championId: null,
      createdAt: new Date().toISOString(),
    };
    db.tournaments.push(tournament);
    store.save();
    res.status(201).json(tournament);
  });

  app.get("/api/tournaments/:id", (req, res) => {
    const tournament = findTournament(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found." });
    res.json(tournament);
  });

  app.post("/api/tournaments/:id/players", (req, res) => {
    const tournament = findTournament(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found." });
    if (tournament.status !== "registration") {
      return res
        .status(409)
        .json({ error: "Players can only be added during registration." });
    }
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Player name is required." });

    const player: Player = {
      id: randomUUID(),
      name,
      seed: tournament.players.length + 1,
    };
    tournament.players.push(player);
    store.save();
    res.status(201).json(player);
  });

  app.post("/api/tournaments/:id/start", (req, res) => {
    const tournament = findTournament(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found." });
    if (tournament.status !== "registration") {
      return res.status(409).json({ error: "Tournament already started." });
    }
    if (tournament.players.length < 2) {
      return res
        .status(400)
        .json({ error: "At least 2 players are required to start." });
    }
    try {
      tournament.matches = generateBracket(tournament.players);
      tournament.status = "in_progress";
      store.save();
      res.json(tournament);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/api/tournaments/:id/matches/:matchId/result", (req, res) => {
    const tournament = findTournament(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Not found." });
    if (tournament.status !== "in_progress") {
      return res.status(409).json({ error: "Tournament is not in progress." });
    }
    const winnerId = String(req.body?.winnerId ?? "");
    try {
      const champion = recordResult(tournament, req.params.matchId, winnerId);
      store.save();
      res.json({ tournament, championId: champion });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return app;
}

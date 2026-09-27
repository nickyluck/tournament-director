import { promises as fs } from "fs";
import path from "path";
import { generatePin, sampleBlindStructure, createId } from "./helpers";
import { rebalanceAndBreak, seatInitial } from "./seating";
import type {
  BlindLevel,
  TimerAction,
  Tournament,
  TournamentPublic,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tournament.json");

type Listener = (tournament: TournamentPublic) => void;

const globalForTournament = globalThis as unknown as {
  __tdListeners?: Set<Listener>;
  __tdCache?: Tournament | null;
  __tdWriteChain?: Promise<void>;
};

function listeners(): Set<Listener> {
  if (!globalForTournament.__tdListeners) {
    globalForTournament.__tdListeners = new Set();
  }
  return globalForTournament.__tdListeners;
}

function defaultTournament(): Tournament {
  return {
    name: "Tournoi du soir",
    status: "setup",
    startingStack: 20_000,
    seatsPerTable: 9,
    configuredTableCount: 2,
    mobilePin: generatePin(),
    entrants: 0,
    players: [],
    tables: [],
    blinds: sampleBlindStructure(),
    timer: {
      running: false,
      levelIndex: 0,
      remainingMs: sampleBlindStructure()[0].durationMinutes * 60_000,
      anchorAt: null,
    },
    moves: [],
    updatedAt: new Date().toISOString(),
  };
}

export function effectiveRemainingMs(t: Tournament, now = Date.now()): number {
  if (!t.timer.running || t.timer.anchorAt == null) {
    return Math.max(0, t.timer.remainingMs);
  }
  const elapsed = now - t.timer.anchorAt;
  return Math.max(0, t.timer.remainingMs - elapsed);
}

export function enrich(t: Tournament, now = Date.now()): TournamentPublic {
  const remainingPlayers = t.players.filter((p) => p.status === "active").length;
  const openTables = t.tables.filter((table) => table.open).length;
  const averageStack =
    remainingPlayers > 0
      ? Math.round((t.startingStack * Math.max(t.entrants, t.players.length)) / remainingPlayers)
      : 0;
  const currentLevel = t.blinds[t.timer.levelIndex] ?? null;

  return {
    ...t,
    remainingPlayers,
    openTables,
    averageStack,
    currentLevel,
    effectiveRemainingMs: effectiveRemainingMs(t, now),
  };
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeAtomic(tournament: Tournament): Promise<void> {
  await ensureDataDir();
  const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(tournament, null, 2)}\n`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function normalizeTournament(parsed: Tournament): Tournament {
  parsed.players = parsed.players.map((p) => ({
    ...p,
    killerId: p.killerId ?? null,
    killerName: p.killerName ?? null,
  }));
  return parsed;
}

async function readFromDisk(): Promise<Tournament> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Tournament;
    return normalizeTournament(parsed);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const fresh = defaultTournament();
      await writeAtomic(fresh);
      return fresh;
    }
    throw err;
  }
}

export async function getTournament(): Promise<Tournament> {
  if (globalForTournament.__tdCache) {
    return structuredClone(globalForTournament.__tdCache);
  }
  const t = await readFromDisk();
  globalForTournament.__tdCache = t;
  return structuredClone(t);
}

async function persistAndNotify(t: Tournament): Promise<TournamentPublic> {
  t.updatedAt = new Date().toISOString();
  globalForTournament.__tdCache = structuredClone(t);

  const chain = (globalForTournament.__tdWriteChain ?? Promise.resolve()).then(
    async () => {
      await writeAtomic(t);
    },
  );
  globalForTournament.__tdWriteChain = chain.then(
    () => undefined,
    () => undefined,
  );
  await chain;

  const publicState = enrich(t);
  for (const listener of listeners()) {
    try {
      listener(publicState);
    } catch {
      // ignore broken listeners
    }
  }
  return publicState;
}

export function subscribe(listener: Listener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

export async function getPublicTournament(): Promise<TournamentPublic> {
  return enrich(await getTournament());
}

export async function resetTournament(): Promise<TournamentPublic> {
  return persistAndNotify(defaultTournament());
}

export async function updateSetup(input: {
  name?: string;
  startingStack?: number;
  seatsPerTable?: number;
  configuredTableCount?: number;
  blinds?: BlindLevel[];
}): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Le tournoi a déjà démarré — configuration verrouillée.");
  }
  if (input.name != null) t.name = input.name.trim() || t.name;
  if (input.startingStack != null) {
    if (input.startingStack <= 0) throw new Error("Stack de départ invalide.");
    t.startingStack = Math.floor(input.startingStack);
  }
  if (input.seatsPerTable != null) {
    if (input.seatsPerTable < 2 || input.seatsPerTable > 10) {
      throw new Error("Places par table : entre 2 et 10.");
    }
    t.seatsPerTable = Math.floor(input.seatsPerTable);
  }
  if (input.configuredTableCount != null) {
    if (input.configuredTableCount < 1 || input.configuredTableCount > 50) {
      throw new Error("Nombre de tables invalide.");
    }
    t.configuredTableCount = Math.floor(input.configuredTableCount);
  }
  if (input.blinds != null) {
    if (input.blinds.length === 0) throw new Error("Au moins un niveau de blindes.");
    t.blinds = input.blinds.map((b) => ({
      ...b,
      id: b.id || createId("blind"),
      durationMinutes: Math.max(1, Math.floor(b.durationMinutes)),
      smallBlind: Math.max(0, Math.floor(b.smallBlind)),
      bigBlind: Math.max(0, Math.floor(b.bigBlind)),
      ante: Math.max(0, Math.floor(b.ante)),
    }));
    t.timer.remainingMs = t.blinds[0].durationMinutes * 60_000;
    t.timer.levelIndex = 0;
    t.timer.running = false;
    t.timer.anchorAt = null;
  }
  return persistAndNotify(t);
}

export async function addPlayer(name: string): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Impossible d'ajouter un joueur après le départ.");
  }
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du joueur est requis.");
  if (t.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Ce joueur est déjà inscrit.");
  }
  t.players.push({
    id: createId("player"),
    name: trimmed,
    status: "active",
    place: null,
    tableId: null,
    seat: null,
    killerId: null,
    killerName: null,
  });
  return persistAndNotify(t);
}

export async function removePlayer(playerId: string): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Impossible de retirer un joueur après le départ.");
  }
  const before = t.players.length;
  t.players = t.players.filter((p) => p.id !== playerId);
  if (t.players.length === before) throw new Error("Joueur introuvable.");
  return persistAndNotify(t);
}

export async function startTournament(): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") throw new Error("Le tournoi a déjà démarré.");
  const actives = t.players.filter((p) => p.status === "active");
  if (actives.length < 2) {
    throw new Error("Il faut au moins 2 joueurs pour démarrer.");
  }
  if (t.blinds.length === 0) throw new Error("Structure de blindes manquante.");

  const seated = seatInitial(t.players, t.configuredTableCount, t.seatsPerTable);
  t.players = seated.players;
  t.tables = seated.tables;
  t.moves = seated.moves;
  t.entrants = actives.length;
  t.status = "running";
  t.mobilePin = generatePin();
  t.timer = {
    running: true,
    levelIndex: 0,
    remainingMs: t.blinds[0].durationMinutes * 60_000,
    anchorAt: Date.now(),
  };
  return persistAndNotify(t);
}

function syncTimerClock(t: Tournament, now = Date.now()): void {
  if (t.timer.running && t.timer.anchorAt != null) {
    t.timer.remainingMs = effectiveRemainingMs(t, now);
    t.timer.anchorAt = now;
  }
}

function applyLevel(t: Tournament, index: number, now = Date.now()): void {
  const level = t.blinds[index];
  if (!level) return;
  t.timer.levelIndex = index;
  t.timer.remainingMs = level.durationMinutes * 60_000;
  t.timer.anchorAt = t.timer.running ? now : null;
}

export async function controlTimer(
  action: TimerAction,
  options?: { pin?: string; requirePin?: boolean },
): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status === "setup") throw new Error("Démarrez le tournoi d'abord.");
  if (t.status === "finished") throw new Error("Le tournoi est terminé.");
  if (options?.requirePin) {
    if (!options.pin || options.pin !== t.mobilePin) {
      throw new Error("PIN incorrect.");
    }
  }

  const now = Date.now();
  syncTimerClock(t, now);

  switch (action) {
    case "play":
      t.timer.running = true;
      t.timer.anchorAt = now;
      break;
    case "pause":
      t.timer.running = false;
      t.timer.anchorAt = null;
      break;
    case "plus1":
      t.timer.remainingMs += 60_000;
      if (t.timer.running) t.timer.anchorAt = now;
      break;
    case "next":
      if (t.timer.levelIndex < t.blinds.length - 1) {
        applyLevel(t, t.timer.levelIndex + 1, now);
      }
      break;
    case "prev":
      if (t.timer.levelIndex > 0) {
        applyLevel(t, t.timer.levelIndex - 1, now);
      }
      break;
    default:
      throw new Error("Action timer inconnue.");
  }

  return persistAndNotify(t);
}

/** Advance level automatically when timer hits 0 while running. */
export async function tickTimerIfNeeded(): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "running" || !t.timer.running) {
    return enrich(t);
  }
  const now = Date.now();
  const remaining = effectiveRemainingMs(t, now);
  if (remaining > 0) return enrich(t);

  syncTimerClock(t, now);
  if (t.timer.levelIndex < t.blinds.length - 1) {
    applyLevel(t, t.timer.levelIndex + 1, now);
  } else {
    t.timer.running = false;
    t.timer.remainingMs = 0;
    t.timer.anchorAt = null;
  }
  return persistAndNotify(t);
}

export async function eliminatePlayer(
  playerId: string,
  options?: {
    pin?: string;
    requirePin?: boolean;
    killerId?: string | null;
  },
): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "running") {
    throw new Error("Les éliminations ne sont possibles qu'en cours de tournoi.");
  }
  if (options?.requirePin) {
    if (!options.pin || options.pin !== t.mobilePin) {
      throw new Error("PIN incorrect.");
    }
  }

  // Normalize legacy records missing killer fields.
  for (const p of t.players) {
    if (p.killerId === undefined) p.killerId = null;
    if (p.killerName === undefined) p.killerName = null;
  }

  const player = t.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Joueur introuvable.");
  if (player.status !== "active") throw new Error("Ce joueur est déjà éliminé.");

  const killerId = options?.killerId ?? null;
  if (killerId) {
    if (killerId === playerId) {
      throw new Error("Un joueur ne peut pas être son propre killer.");
    }
    const killer = t.players.find((p) => p.id === killerId);
    if (!killer || killer.status !== "active") {
      throw new Error("Killer invalide : choisissez un joueur encore actif.");
    }
    player.killerId = killer.id;
    player.killerName = killer.name;
  } else {
    player.killerId = null;
    player.killerName = null;
  }

  const remainingBefore = t.players.filter((p) => p.status === "active").length;
  player.status = "eliminated";
  player.place = remainingBefore;
  player.tableId = null;
  player.seat = null;

  const remainingAfter = remainingBefore - 1;
  if (remainingAfter <= 1) {
    const winner = t.players.find((p) => p.status === "active");
    if (winner) {
      winner.place = 1;
      // keep winner seated until finished display
    }
    t.status = "finished";
    t.timer.running = false;
    t.timer.anchorAt = null;
    // Close all but one table optionally
    const result = rebalanceAndBreak(t.players, t.tables, t.seatsPerTable);
    t.players = result.players;
    t.tables = result.tables;
    t.moves = [...result.moves, ...t.moves].slice(0, 200);
    return persistAndNotify(t);
  }

  const result = rebalanceAndBreak(t.players, t.tables, t.seatsPerTable);
  t.players = result.players;
  t.tables = result.tables;
  t.moves = [...result.moves, ...t.moves].slice(0, 200);
  return persistAndNotify(t);
}

export async function forceRebalance(): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "running") {
    throw new Error("Rééquilibrage disponible uniquement en cours de tournoi.");
  }
  const result = rebalanceAndBreak(t.players, t.tables, t.seatsPerTable);
  t.players = result.players;
  t.tables = result.tables;
  if (result.moves.length > 0) {
    t.moves = [...result.moves, ...t.moves].slice(0, 200);
  }
  return persistAndNotify(t);
}

export async function regeneratePin(): Promise<TournamentPublic> {
  const t = await getTournament();
  t.mobilePin = generatePin();
  return persistAndNotify(t);
}

export function loadSampleBlinds(): BlindLevel[] {
  return sampleBlindStructure();
}

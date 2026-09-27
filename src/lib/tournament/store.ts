import { promises as fs } from "fs";
import path from "path";
import { normalizeBlindLevels } from "./blinds";
import { generatePin, sampleBlindStructure, createId } from "./helpers";
import { ensureRosterPlayer } from "./library";
import {
  defaultBreakOrder,
  rebalanceAndBreak,
  seatInitial,
  syncBreakOrder,
} from "./seating";
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
  const blinds = sampleBlindStructure();
  return {
    name: "Tournoi du soir",
    status: "setup",
    startingStack: 20_000,
    seatsPerTable: 9,
    finalTableSeats: 9,
    configuredTableCount: 2,
    breakOrder: [],
    mobilePin: generatePin(),
    entrants: 0,
    players: [],
    tables: [],
    blinds,
    timer: {
      running: false,
      levelIndex: 0,
      remainingMs: blinds[0].durationMinutes * 60_000,
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

function blindSnapshot(b: BlindLevel) {
  return JSON.stringify({
    id: b.id,
    kind: b.kind,
    durationMinutes: b.durationMinutes,
    smallBlind: b.smallBlind,
    bigBlind: b.bigBlind,
    ante: b.ante,
    message: b.message,
  });
}

function normalizeTournament(parsed: Tournament): Tournament {
  parsed.players = parsed.players.map((p) => ({
    ...p,
    killerId: p.killerId ?? null,
    killerName: p.killerName ?? null,
  }));
  parsed.blinds = normalizeBlindLevels(parsed.blinds ?? []);
  if (parsed.finalTableSeats == null || parsed.finalTableSeats < 2) {
    parsed.finalTableSeats = parsed.seatsPerTable;
  }
  if (!Array.isArray(parsed.breakOrder)) {
    parsed.breakOrder = defaultBreakOrder(parsed.tables ?? []);
  } else {
    parsed.breakOrder = syncBreakOrder(parsed.breakOrder, parsed.tables ?? []);
  }
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
    return structuredClone(normalizeTournament(globalForTournament.__tdCache));
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

function clearSeating(t: Tournament): void {
  t.tables = [];
  t.moves = [];
  t.breakOrder = [];
  for (const p of t.players) {
    p.tableId = null;
    p.seat = null;
  }
}

function allActivesSeated(t: Tournament): boolean {
  const actives = t.players.filter((p) => p.status === "active");
  return (
    actives.length >= 2 &&
    t.tables.some((table) => table.open) &&
    actives.every((p) => p.tableId != null && p.seat != null)
  );
}

function applyRebalance(t: Tournament): void {
  const result = rebalanceAndBreak(t.players, t.tables, t.seatsPerTable, {
    finalTableSeats: t.finalTableSeats,
    breakOrder: t.breakOrder,
  });
  t.players = result.players;
  t.tables = result.tables;
  t.breakOrder = result.breakOrder;
  if (result.moves.length > 0) {
    t.moves = [...result.moves, ...t.moves].slice(0, 200);
  }
}

function applyBlindsUpdate(t: Tournament, incomingRaw: BlindLevel[]): void {
  const incoming = normalizeBlindLevels(incomingRaw);
  if (incoming.length === 0) throw new Error("Au moins une étape dans la structure.");
  if (!incoming.some((b) => b.kind === "level")) {
    throw new Error("Au moins un niveau de blindes (hors pause) est requis.");
  }

  if (t.status === "setup") {
    t.blinds = incoming;
    t.timer.remainingMs = t.blinds[0].durationMinutes * 60_000;
    t.timer.levelIndex = 0;
    t.timer.running = false;
    t.timer.anchorAt = null;
    return;
  }

  if (t.status !== "running") {
    throw new Error("Structure verrouillée.");
  }

  const levelIndex = t.timer.levelIndex;
  const locked = t.blinds.slice(0, levelIndex);
  if (incoming.length < locked.length) {
    throw new Error("Impossible de supprimer des niveaux déjà joués.");
  }
  for (let i = 0; i < locked.length; i += 1) {
    if (blindSnapshot(incoming[i]) !== blindSnapshot(locked[i])) {
      throw new Error("Les niveaux déjà joués ne peuvent pas être modifiés.");
    }
  }

  const oldCurrent = t.blinds[levelIndex] ?? null;
  const now = Date.now();
  syncTimerClock(t, now);

  t.blinds = incoming;

  let newIndex = oldCurrent
    ? incoming.findIndex((b) => b.id === oldCurrent.id)
    : levelIndex;
  if (newIndex < levelIndex) newIndex = levelIndex;
  if (newIndex < 0 || newIndex >= incoming.length) {
    newIndex = Math.min(levelIndex, incoming.length - 1);
  }
  t.timer.levelIndex = newIndex;

  const newCurrent = incoming[newIndex];
  if (
    oldCurrent &&
    newCurrent &&
    oldCurrent.id === newCurrent.id &&
    oldCurrent.durationMinutes !== newCurrent.durationMinutes
  ) {
    t.timer.remainingMs = newCurrent.durationMinutes * 60_000;
    t.timer.anchorAt = t.timer.running ? now : null;
  }
}

export async function updateSetup(input: {
  name?: string;
  startingStack?: number;
  seatsPerTable?: number;
  finalTableSeats?: number;
  configuredTableCount?: number;
  breakOrder?: string[];
  blinds?: BlindLevel[];
}): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status === "finished") {
    throw new Error("Le tournoi est terminé — configuration verrouillée.");
  }

  const isSetup = t.status === "setup";
  const isRunning = t.status === "running";

  if (input.name != null) t.name = input.name.trim() || t.name;
  if (input.startingStack != null) {
    if (input.startingStack <= 0) throw new Error("Stack de départ invalide.");
    t.startingStack = Math.floor(input.startingStack);
  }

  let seatingDirty = false;

  if (input.seatsPerTable != null) {
    if (!isSetup) throw new Error("Places par table modifiables uniquement en préparation.");
    if (input.seatsPerTable < 2 || input.seatsPerTable > 10) {
      throw new Error("Places par table : entre 2 et 10.");
    }
    const next = Math.floor(input.seatsPerTable);
    if (next !== t.seatsPerTable) seatingDirty = true;
    t.seatsPerTable = next;
    if (t.finalTableSeats > next * 2) {
      // keep final table seats as-is unless absurd; no auto-clamp beyond range
    }
  }

  if (input.finalTableSeats != null) {
    if (!isSetup) throw new Error("Taille de table finale modifiable uniquement en préparation.");
    if (input.finalTableSeats < 2 || input.finalTableSeats > 10) {
      throw new Error("Places table finale : entre 2 et 10.");
    }
    const next = Math.floor(input.finalTableSeats);
    if (next !== t.finalTableSeats) seatingDirty = true;
    t.finalTableSeats = next;
  }

  if (input.configuredTableCount != null) {
    if (!isSetup) throw new Error("Nombre de tables modifiable uniquement en préparation.");
    if (input.configuredTableCount < 1 || input.configuredTableCount > 50) {
      throw new Error("Nombre de tables invalide.");
    }
    const next = Math.floor(input.configuredTableCount);
    if (next !== t.configuredTableCount) seatingDirty = true;
    t.configuredTableCount = next;
  }

  if (input.breakOrder != null) {
    if (!isSetup && !isRunning) {
      throw new Error("Ordre de cassage non modifiable.");
    }
    const openIds = new Set(t.tables.filter((table) => table.open).map((table) => table.id));
    const cleaned = input.breakOrder.filter((id) => openIds.has(id));
    t.breakOrder = syncBreakOrder(cleaned, t.tables);
  }

  if (input.blinds != null) {
    if (!isSetup && !isRunning) {
      throw new Error("Structure verrouillée.");
    }
    applyBlindsUpdate(t, input.blinds);
  }

  if (seatingDirty) clearSeating(t);
  return persistAndNotify(t);
}

function pushPlayer(t: Tournament, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du joueur est requis.");
  if (t.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`Ce joueur est déjà inscrit : ${trimmed}`);
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
}

export async function addPlayer(
  name: string,
  options?: { saveToRoster?: boolean },
): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Impossible d'ajouter un joueur après le départ.");
  }
  pushPlayer(t, name);
  clearSeating(t);
  if (options?.saveToRoster !== false) {
    await ensureRosterPlayer(name);
  }
  return persistAndNotify(t);
}

export async function enrollPlayers(
  names: string[],
  options?: { saveToRoster?: boolean },
): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Impossible d'ajouter un joueur après le départ.");
  }
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("Aucun joueur à inscrire.");

  let added = 0;
  for (const name of unique) {
    if (t.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      continue;
    }
    pushPlayer(t, name);
    added += 1;
    if (options?.saveToRoster !== false) {
      await ensureRosterPlayer(name);
    }
  }
  if (added > 0) clearSeating(t);
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
  clearSeating(t);
  return persistAndNotify(t);
}

/** Place les joueurs aux tables pendant la phase setup (avant le chrono). */
export async function seatPlayers(): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "setup") {
    throw new Error("Le placement n’est disponible qu’avant le départ.");
  }
  const actives = t.players.filter((p) => p.status === "active");
  if (actives.length < 2) {
    throw new Error("Il faut au moins 2 joueurs pour placer.");
  }

  const seated = seatInitial(
    t.players,
    t.configuredTableCount,
    t.seatsPerTable,
    t.finalTableSeats,
  );
  t.players = seated.players;
  t.tables = seated.tables;
  t.moves = seated.moves;
  t.breakOrder = seated.breakOrder;
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
  if (!t.blinds.some((b) => b.kind === "level")) {
    throw new Error("La structure doit contenir au moins un niveau de blindes.");
  }
  if (!allActivesSeated(t)) {
    throw new Error("Placez d’abord les joueurs aux tables avant de démarrer.");
  }

  t.entrants = actives.length;
  t.status = "running";
  t.mobilePin = generatePin();
  t.timer = {
    running: true,
    levelIndex: 0,
    remainingMs: t.blinds[0].durationMinutes * 60_000,
    anchorAt: Date.now(),
  };
  t.breakOrder = syncBreakOrder(t.breakOrder, t.tables);
  return persistAndNotify(t);
}

export async function movePlayer(
  playerId: string,
  toTableId: string,
  toSeat: number,
): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status === "finished") {
    throw new Error("Tournoi terminé — déplacements impossibles.");
  }
  if (t.tables.length === 0) {
    throw new Error("Aucun placement en cours.");
  }

  const player = t.players.find((p) => p.id === playerId);
  if (!player || player.status !== "active") {
    throw new Error("Joueur introuvable ou déjà éliminé.");
  }

  const toTable = t.tables.find((table) => table.id === toTableId);
  if (!toTable || !toTable.open) {
    throw new Error("Table cible invalide.");
  }
  const seat = Math.floor(toSeat);
  if (seat < 1 || seat > toTable.seats) {
    throw new Error(`Siège invalide (1–${toTable.seats}).`);
  }

  if (player.tableId === toTableId && player.seat === seat) {
    return enrich(t);
  }

  const fromTable = t.tables.find((table) => table.id === player.tableId) ?? null;
  const fromTableNumber = fromTable?.number ?? null;
  const occupant = t.players.find(
    (p) =>
      p.status === "active" &&
      p.id !== playerId &&
      p.tableId === toTableId &&
      p.seat === seat,
  );

  const now = new Date().toISOString();
  const moves = [];

  if (occupant) {
    const occFrom = occupant.tableId === player.tableId ? fromTableNumber : toTable.number;
    occupant.tableId = player.tableId;
    occupant.seat = player.seat;
    if (occupant.tableId && occupant.seat != null) {
      const destTable = t.tables.find((table) => table.id === occupant.tableId);
      moves.push({
        id: createId("move"),
        playerId: occupant.id,
        playerName: occupant.name,
        fromTable: toTable.number,
        toTable: destTable?.number ?? fromTableNumber ?? 0,
        toSeat: occupant.seat,
        at: now,
        reason: "manual" as const,
      });
      void occFrom;
    }
  }

  player.tableId = toTableId;
  player.seat = seat;
  moves.push({
    id: createId("move"),
    playerId: player.id,
    playerName: player.name,
    fromTable: fromTableNumber,
    toTable: toTable.number,
    toSeat: seat,
    at: now,
    reason: "manual" as const,
  });

  t.moves = [...moves, ...t.moves].slice(0, 200);
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
    }
    t.status = "finished";
    t.timer.running = false;
    t.timer.anchorAt = null;
    applyRebalance(t);
    return persistAndNotify(t);
  }

  applyRebalance(t);
  return persistAndNotify(t);
}

export async function forceRebalance(): Promise<TournamentPublic> {
  const t = await getTournament();
  if (t.status !== "running") {
    throw new Error("Rééquilibrage disponible uniquement en cours de tournoi.");
  }
  applyRebalance(t);
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

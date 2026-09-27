import { promises as fs } from "fs";
import path from "path";
import { createId } from "./helpers";
import { normalizeBlindLevels } from "./blinds";
import type { BlindLevel, Library, RosterPlayer, SavedStructure } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const LIBRARY_FILE = path.join(DATA_DIR, "library.json");

const globalForLibrary = globalThis as unknown as {
  __tdLibraryCache?: Library | null;
  __tdLibraryWriteChain?: Promise<void>;
};

function emptyLibrary(): Library {
  return { structures: [], players: [] };
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeAtomic(library: Library): Promise<void> {
  await ensureDataDir();
  const tmp = `${LIBRARY_FILE}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(library, null, 2)}\n`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, LIBRARY_FILE);
}

function normalizeLibrary(parsed: Library): Library {
  return {
    structures: (parsed.structures ?? []).map((s) => ({
      id: s.id || createId("structure"),
      name: (s.name ?? "").trim() || "Sans nom",
      blinds: normalizeBlindLevels(s.blinds ?? []),
      updatedAt: s.updatedAt || new Date().toISOString(),
    })),
    players: (parsed.players ?? []).map((p) => ({
      id: p.id || createId("roster"),
      name: (p.name ?? "").trim(),
      createdAt: p.createdAt || new Date().toISOString(),
    })).filter((p) => p.name.length > 0),
  };
}

async function readFromDisk(): Promise<Library> {
  try {
    const raw = await fs.readFile(LIBRARY_FILE, "utf8");
    return normalizeLibrary(JSON.parse(raw) as Library);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const fresh = emptyLibrary();
      await writeAtomic(fresh);
      return fresh;
    }
    throw err;
  }
}

export async function getLibrary(): Promise<Library> {
  if (globalForLibrary.__tdLibraryCache) {
    return structuredClone(globalForLibrary.__tdLibraryCache);
  }
  const lib = await readFromDisk();
  globalForLibrary.__tdLibraryCache = lib;
  return structuredClone(lib);
}

async function persist(library: Library): Promise<Library> {
  globalForLibrary.__tdLibraryCache = structuredClone(library);
  const chain = (globalForLibrary.__tdLibraryWriteChain ?? Promise.resolve()).then(
    async () => {
      await writeAtomic(library);
    },
  );
  globalForLibrary.__tdLibraryWriteChain = chain.then(
    () => undefined,
    () => undefined,
  );
  await chain;
  return structuredClone(library);
}

export async function saveStructure(input: {
  id?: string;
  name: string;
  blinds: BlindLevel[];
}): Promise<Library> {
  const name = input.name.trim();
  if (!name) throw new Error("Le nom de la structure est requis.");
  const blinds = normalizeBlindLevels(input.blinds);
  if (blinds.length === 0) throw new Error("La structure doit contenir au moins une étape.");
  if (!blinds.some((b) => b.kind === "level")) {
    throw new Error("La structure doit contenir au moins un niveau de blindes.");
  }

  const lib = await getLibrary();
  const now = new Date().toISOString();
  const existingIdx = input.id
    ? lib.structures.findIndex((s) => s.id === input.id)
    : lib.structures.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());

  if (existingIdx >= 0) {
    const prev = lib.structures[existingIdx];
    lib.structures[existingIdx] = {
      ...prev,
      name,
      blinds,
      updatedAt: now,
    };
  } else {
    const structure: SavedStructure = {
      id: createId("structure"),
      name,
      blinds,
      updatedAt: now,
    };
    lib.structures.push(structure);
  }

  lib.structures.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return persist(lib);
}

export async function deleteStructure(id: string): Promise<Library> {
  const lib = await getLibrary();
  const before = lib.structures.length;
  lib.structures = lib.structures.filter((s) => s.id !== id);
  if (lib.structures.length === before) throw new Error("Structure introuvable.");
  return persist(lib);
}

export async function addRosterPlayer(name: string): Promise<Library> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du joueur est requis.");
  const lib = await getLibrary();
  if (lib.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Ce joueur est déjà dans l’annuaire.");
  }
  const player: RosterPlayer = {
    id: createId("roster"),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  lib.players.push(player);
  lib.players.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return persist(lib);
}

export async function deleteRosterPlayer(id: string): Promise<Library> {
  const lib = await getLibrary();
  const before = lib.players.length;
  lib.players = lib.players.filter((p) => p.id !== id);
  if (lib.players.length === before) throw new Error("Joueur introuvable dans l’annuaire.");
  return persist(lib);
}

/** Ajoute au roster s’il n’existe pas déjà (insensible à la casse). */
export async function ensureRosterPlayer(name: string): Promise<Library> {
  const trimmed = name.trim();
  if (!trimmed) return getLibrary();
  const lib = await getLibrary();
  if (lib.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    return lib;
  }
  return addRosterPlayer(trimmed);
}

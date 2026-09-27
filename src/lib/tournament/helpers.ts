import type { BlindLevel } from "./types";

export function createId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Structure type MTT 20–30 joueurs, niveaux 20 min. */
export function sampleBlindStructure(): BlindLevel[] {
  const levels: Array<[number, number, number, number]> = [
    [20, 100, 200, 0],
    [20, 200, 400, 0],
    [20, 300, 600, 0],
    [20, 400, 800, 100],
    [20, 500, 1000, 100],
    [20, 600, 1200, 200],
    [20, 800, 1600, 200],
    [20, 1000, 2000, 300],
    [20, 1500, 3000, 400],
    [20, 2000, 4000, 500],
    [20, 3000, 6000, 1000],
    [20, 4000, 8000, 1000],
    [20, 5000, 10000, 1500],
    [20, 6000, 12000, 2000],
    [20, 8000, 16000, 3000],
    [20, 10000, 20000, 4000],
  ];

  return levels.map(([durationMinutes, smallBlind, bigBlind, ante]) => ({
    id: createId("blind"),
    durationMinutes,
    smallBlind,
    bigBlind,
    ante,
  }));
}

export function formatChips(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

import { createId } from "./helpers";
import type { BlindLevel, BlindStepKind } from "./types";

type BlindInput = Partial<BlindLevel> & {
  durationMinutes?: number;
  smallBlind?: number;
  bigBlind?: number;
  ante?: number;
};

export function isBreak(level: BlindLevel | null | undefined): boolean {
  return level?.kind === "break";
}

export function normalizeBlindLevel(input: BlindInput, fallbackKind: BlindStepKind = "level"): BlindLevel {
  const kind: BlindStepKind = input.kind === "break" ? "break" : fallbackKind;
  const message =
    typeof input.message === "string" && input.message.trim().length > 0
      ? input.message.trim()
      : null;

  if (kind === "break") {
    return {
      id: input.id || createId("blind"),
      kind: "break",
      durationMinutes: Math.max(1, Math.floor(input.durationMinutes ?? 10)),
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      message,
    };
  }

  return {
    id: input.id || createId("blind"),
    kind: "level",
    durationMinutes: Math.max(1, Math.floor(input.durationMinutes ?? 20)),
    smallBlind: Math.max(0, Math.floor(input.smallBlind ?? 0)),
    bigBlind: Math.max(0, Math.floor(input.bigBlind ?? 0)),
    ante: Math.max(0, Math.floor(input.ante ?? 0)),
    message,
  };
}

export function normalizeBlindLevels(blinds: BlindInput[]): BlindLevel[] {
  return blinds.map((b) => normalizeBlindLevel(b));
}

export function lastPlayLevel(blinds: BlindLevel[]): BlindLevel | null {
  for (let i = blinds.length - 1; i >= 0; i -= 1) {
    if (blinds[i].kind === "level") return blinds[i];
  }
  return null;
}

/** Libellé court pour UI / horloge. */
export function formatBlindStepLabel(
  level: BlindLevel,
  index: number,
  options?: { includeBlinds?: boolean },
): string {
  const includeBlinds = options?.includeBlinds ?? true;
  if (level.kind === "break") {
    return level.message ? `Pause — ${level.message}` : "Pause";
  }
  if (!includeBlinds) {
    return `Niveau ${index + 1}`;
  }
  const chips = `${level.smallBlind} / ${level.bigBlind}`;
  return level.ante > 0
    ? `Niveau ${index + 1} · ${chips} ante ${level.ante}`
    : `Niveau ${index + 1} · ${chips}`;
}

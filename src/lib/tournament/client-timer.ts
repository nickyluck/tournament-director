import type { TournamentPublic } from "@/lib/tournament/types";

/** Client-safe mirror of store.effectiveRemainingMs (no Node deps). */
export function effectiveRemainingMs(
  t: Pick<TournamentPublic, "timer" | "effectiveRemainingMs">,
  now = Date.now(),
): number {
  if (!t.timer.running || t.timer.anchorAt == null) {
    return Math.max(0, t.timer.remainingMs);
  }
  const elapsed = now - t.timer.anchorAt;
  return Math.max(0, t.timer.remainingMs - elapsed);
}

import { randomUUID } from "node:crypto";
import type { Match, Player, Tournament } from "./types.js";

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard tournament seeding order for a bracket of the given size.
 * Returns an array of seed numbers (1-based) in slot order, so that top
 * seeds are spread apart and only meet in later rounds.
 */
export function seedOrder(size: number): number[] {
  let pods = [1, 2];
  while (pods.length < size) {
    const sum = pods.length * 2 + 1;
    const next: number[] = [];
    for (const p of pods) {
      next.push(p);
      next.push(sum - p);
    }
    pods = next;
  }
  return pods;
}

/**
 * Build a single-elimination bracket for the given (seed-ordered) players.
 * Byes are assigned to the highest seeds and auto-advanced into round 2.
 */
export function generateBracket(players: Player[]): Match[] {
  if (players.length < 2) {
    throw new Error("A tournament needs at least 2 players to start.");
  }

  const ordered = [...players].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(ordered.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);

  const matches: Match[] = [];
  const byRound: Match[][] = [];

  for (let r = 1; r <= rounds; r++) {
    const count = size / Math.pow(2, r);
    const roundMatches: Match[] = [];
    for (let i = 0; i < count; i++) {
      const match: Match = {
        id: randomUUID(),
        round: r,
        index: i,
        player1Id: null,
        player2Id: null,
        winnerId: null,
        nextMatchId: null,
        nextSlot: null,
      };
      roundMatches.push(match);
      matches.push(match);
    }
    byRound.push(roundMatches);
  }

  // Link each match to the match it feeds into.
  for (let r = 0; r < byRound.length - 1; r++) {
    for (const match of byRound[r]) {
      const nextIndex = Math.floor(match.index / 2);
      const next = byRound[r + 1][nextIndex];
      match.nextMatchId = next.id;
      match.nextSlot = match.index % 2 === 0 ? 1 : 2;
    }
  }

  // Seed players into round 1. seed value -> player, or bye if beyond player count.
  const seedToPlayer = new Map<number, Player>();
  ordered.forEach((p, idx) => seedToPlayer.set(idx + 1, p));

  const round1 = byRound[0];
  for (let i = 0; i < round1.length; i++) {
    const seed1 = order[i * 2];
    const seed2 = order[i * 2 + 1];
    round1[i].player1Id = seedToPlayer.get(seed1)?.id ?? null;
    round1[i].player2Id = seedToPlayer.get(seed2)?.id ?? null;
  }

  // Auto-advance byes in round 1 (a match with exactly one player).
  for (const match of round1) {
    const hasP1 = match.player1Id !== null;
    const hasP2 = match.player2Id !== null;
    if (hasP1 !== hasP2) {
      const winnerId = match.player1Id ?? match.player2Id;
      match.winnerId = winnerId;
      placeWinner(matches, match, winnerId!);
    }
  }

  return matches;
}

function placeWinner(matches: Match[], match: Match, winnerId: string): void {
  if (!match.nextMatchId || !match.nextSlot) return;
  const next = matches.find((m) => m.id === match.nextMatchId);
  if (!next) return;
  if (match.nextSlot === 1) next.player1Id = winnerId;
  else next.player2Id = winnerId;
}

/**
 * Record the winner of a match and advance them to the next round.
 * Returns the champion id if the final match was just decided.
 */
export function recordResult(
  tournament: Tournament,
  matchId: string,
  winnerId: string
): string | null {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) throw new Error("Match not found.");
  if (match.player1Id === null || match.player2Id === null) {
    throw new Error("Both players must be present before recording a result.");
  }
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    throw new Error("Winner must be one of the two players in the match.");
  }

  match.winnerId = winnerId;
  placeWinner(tournament.matches, match, winnerId);

  const finalRound = Math.max(...tournament.matches.map((m) => m.round));
  const finalMatch = tournament.matches.find((m) => m.round === finalRound);
  if (finalMatch && finalMatch.winnerId) {
    tournament.championId = finalMatch.winnerId;
    tournament.status = "completed";
    return finalMatch.winnerId;
  }
  return null;
}

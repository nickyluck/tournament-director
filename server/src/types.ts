export interface Player {
  id: string;
  name: string;
  seed: number;
}

export interface Match {
  id: string;
  round: number;
  index: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
  nextSlot: 1 | 2 | null;
}

export type TournamentStatus = "registration" | "in_progress" | "completed";

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  players: Player[];
  matches: Match[];
  championId: string | null;
  createdAt: string;
}

export interface Database {
  tournaments: Tournament[];
}

export type PlayerStatus = "active" | "eliminated";

export type BlindLevel = {
  id: string;
  durationMinutes: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
};

export type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  /** Place at elimination (remaining+1 when eliminated). Winner gets 1. */
  place: number | null;
  tableId: string | null;
  seat: number | null;
  /** Optional killer who eliminated this player (null = Aucun). */
  killerId: string | null;
  killerName: string | null;
};

export type Table = {
  id: string;
  number: number;
  seats: number;
  open: boolean;
};

export type SeatingMove = {
  id: string;
  playerId: string;
  playerName: string;
  fromTable: number | null;
  toTable: number;
  toSeat: number;
  at: string;
  reason: "initial" | "rebalance" | "break";
};

export type TimerState = {
  running: boolean;
  levelIndex: number;
  /** Remaining ms at the moment of `anchorAt` (when running) or when paused. */
  remainingMs: number;
  /** Epoch ms when remainingMs was last anchored (play / sync). */
  anchorAt: number | null;
};

export type TournamentStatus = "setup" | "running" | "finished";

export type Tournament = {
  name: string;
  status: TournamentStatus;
  startingStack: number;
  seatsPerTable: number;
  /** Desired number of tables configured before start. */
  configuredTableCount: number;
  mobilePin: string;
  entrants: number;
  players: Player[];
  tables: Table[];
  blinds: BlindLevel[];
  timer: TimerState;
  moves: SeatingMove[];
  updatedAt: string;
};

export type TournamentPublic = Tournament & {
  remainingPlayers: number;
  openTables: number;
  averageStack: number;
  currentLevel: BlindLevel | null;
  effectiveRemainingMs: number;
};

export type TimerAction = "play" | "pause" | "plus1" | "next" | "prev";

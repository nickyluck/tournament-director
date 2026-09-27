export type PlayerStatus = "active" | "eliminated";

export type BlindStepKind = "level" | "break";

export type BlindLevel = {
  id: string;
  kind: BlindStepKind;
  durationMinutes: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** Message affiché pendant une pause (ex. changement de jetons). */
  message: string | null;
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
  reason: "initial" | "rebalance" | "break" | "manual";
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
  /** Places à la table finale (peut différer de seatsPerTable). */
  finalTableSeats: number;
  /** Desired number of tables configured before start. */
  configuredTableCount: number;
  /**
   * Ordre de priorité de cassage (IDs de tables), du plus prioritaire au moins.
   * Les tables absentes utilisent le fallback automatique.
   */
  breakOrder: string[];
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

/** Structure de blindes enregistrée (réutilisable entre tournois). */
export type SavedStructure = {
  id: string;
  name: string;
  blinds: BlindLevel[];
  updatedAt: string;
};

/** Joueur dans l’annuaire (hors inscription au tournoi courant). */
export type RosterPlayer = {
  id: string;
  name: string;
  createdAt: string;
};

export type Library = {
  structures: SavedStructure[];
  players: RosterPlayer[];
};

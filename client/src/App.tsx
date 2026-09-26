import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Match, Tournament } from "./types";

export function App() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [playerName, setPlayerName] = useState("");

  const refreshList = useCallback(async () => {
    try {
      setTournaments(await api.listTournaments());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshSelected = useCallback(async (id: string) => {
    try {
      setSelected(await api.getTournament(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (selectedId) void refreshSelected(selectedId);
    else setSelected(null);
  }, [selectedId, refreshSelected]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createTournament = () =>
    run(async () => {
      if (!newName.trim()) return;
      const created = await api.createTournament(newName.trim());
      setNewName("");
      await refreshList();
      setSelectedId(created.id);
    });

  const addPlayer = () =>
    run(async () => {
      if (!selectedId || !playerName.trim()) return;
      await api.addPlayer(selectedId, playerName.trim());
      setPlayerName("");
      await refreshSelected(selectedId);
    });

  const startTournament = () =>
    run(async () => {
      if (!selectedId) return;
      await api.start(selectedId);
      await refreshSelected(selectedId);
      await refreshList();
    });

  const recordResult = (matchId: string, winnerId: string) =>
    run(async () => {
      if (!selectedId) return;
      await api.recordResult(selectedId, matchId, winnerId);
      await refreshSelected(selectedId);
      await refreshList();
    });

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Tournament Director</h1>
        <div className="new-tournament">
          <input
            aria-label="New tournament name"
            placeholder="New tournament name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTournament()}
          />
          <button onClick={createTournament}>Create</button>
        </div>
        <ul className="tournament-list">
          {tournaments.map((t) => (
            <li key={t.id}>
              <button
                className={t.id === selectedId ? "active" : ""}
                onClick={() => setSelectedId(t.id)}
              >
                <span>{t.name}</span>
                <span className={`badge ${t.status}`}>{t.status}</span>
              </button>
            </li>
          ))}
          {tournaments.length === 0 && <li className="muted">No tournaments yet.</li>}
        </ul>
      </aside>

      <main className="content">
        {error && <div className="error">{error}</div>}
        {!selected && <p className="muted">Select or create a tournament to begin.</p>}
        {selected && (
          <TournamentView
            tournament={selected}
            playerName={playerName}
            setPlayerName={setPlayerName}
            onAddPlayer={addPlayer}
            onStart={startTournament}
            onRecordResult={recordResult}
          />
        )}
      </main>
    </div>
  );
}

interface ViewProps {
  tournament: Tournament;
  playerName: string;
  setPlayerName: (v: string) => void;
  onAddPlayer: () => void;
  onStart: () => void;
  onRecordResult: (matchId: string, winnerId: string) => void;
}

function TournamentView({
  tournament,
  playerName,
  setPlayerName,
  onAddPlayer,
  onStart,
  onRecordResult,
}: ViewProps) {
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of tournament.players) map.set(p.id, p.name);
    return map;
  }, [tournament.players]);

  const rounds = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    for (const m of tournament.matches) {
      const arr = grouped.get(m.round) ?? [];
      arr.push(m);
      grouped.set(m.round, arr);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({
        round,
        matches: matches.sort((a, b) => a.index - b.index),
      }));
  }, [tournament.matches]);

  const roundLabel = (round: number, total: number) => {
    const fromEnd = total - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semifinals";
    if (fromEnd === 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  return (
    <div>
      <header className="tournament-header">
        <h2>{tournament.name}</h2>
        <span className={`badge ${tournament.status}`}>{tournament.status}</span>
      </header>

      {tournament.status === "completed" && tournament.championId && (
        <div className="champion" role="status">
          Champion: {nameById.get(tournament.championId)}
        </div>
      )}

      {tournament.status === "registration" && (
        <section className="panel">
          <h3>Players ({tournament.players.length})</h3>
          <div className="add-player">
            <input
              aria-label="Player name"
              placeholder="Player name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddPlayer()}
            />
            <button onClick={onAddPlayer}>Add player</button>
          </div>
          <ol className="players">
            {tournament.players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ol>
          <button
            className="primary"
            disabled={tournament.players.length < 2}
            onClick={onStart}
          >
            Start tournament
          </button>
        </section>
      )}

      {tournament.status !== "registration" && (
        <section className="bracket">
          {rounds.map(({ round, matches }) => (
            <div className="round" key={round}>
              <h4>{roundLabel(round, rounds.length)}</h4>
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  nameById={nameById}
                  disabled={tournament.status === "completed"}
                  onPick={(winnerId) => onRecordResult(m.id, winnerId)}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function MatchCard({
  match,
  nameById,
  disabled,
  onPick,
}: {
  match: Match;
  nameById: Map<string, string>;
  disabled: boolean;
  onPick: (winnerId: string) => void;
}) {
  const renderSide = (playerId: string | null, slot: 1 | 2) => {
    const isWinner = match.winnerId !== null && match.winnerId === playerId;
    const canPick =
      !disabled &&
      match.winnerId === null &&
      match.player1Id !== null &&
      match.player2Id !== null &&
      playerId !== null;
    return (
      <button
        className={`side ${isWinner ? "winner" : ""}`}
        disabled={!canPick}
        onClick={() => playerId && onPick(playerId)}
        aria-label={`Slot ${slot}`}
      >
        {playerId ? nameById.get(playerId) : <em className="tbd">TBD</em>}
      </button>
    );
  };

  return (
    <div className="match">
      {renderSide(match.player1Id, 1)}
      {renderSide(match.player2Id, 2)}
    </div>
  );
}

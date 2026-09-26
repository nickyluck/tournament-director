import type { Player, Tournament } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  listTournaments: () => fetch("/api/tournaments").then(handle<Tournament[]>),

  getTournament: (id: string) =>
    fetch(`/api/tournaments/${id}`).then(handle<Tournament>),

  createTournament: (name: string) =>
    fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(handle<Tournament>),

  addPlayer: (id: string, name: string) =>
    fetch(`/api/tournaments/${id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(handle<Player>),

  start: (id: string) =>
    fetch(`/api/tournaments/${id}/start`, { method: "POST" }).then(
      handle<Tournament>
    ),

  recordResult: (id: string, matchId: string, winnerId: string) =>
    fetch(`/api/tournaments/${id}/matches/${matchId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId }),
    }).then(handle<{ tournament: Tournament; championId: string | null }>),
};

# tournament-director

A small full-stack app for running single-elimination tournaments: create an
event, register players, generate a seeded bracket, and record match results
until a champion is crowned.

## Stack

- **Server** (`server/`): Node.js + TypeScript + Express REST API with JSON-file
  persistence. Bracket seeding and advancement logic lives in
  `server/src/tournament.ts`.
- **Client** (`client/`): React + TypeScript single-page app built with Vite.
  The dev server proxies `/api` to the backend.

## Requirements

- Node.js 22+
- npm 10+

## Getting started

```bash
npm install            # install all workspaces
npm run dev            # start API (:3001) and web client (:5173) together
```

Then open http://localhost:5173.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run server and client together (hot reload). |
| `npm run build` | Type-check and build both workspaces. |
| `npm test` | Run the server test suite (Vitest + Supertest). |
| `npm run lint` | Lint both workspaces. |
| `npm run typecheck` | Type-check both workspaces. |

## API overview

| Method & path | Description |
| --- | --- |
| `GET /api/health` | Health check. |
| `GET /api/tournaments` | List tournaments. |
| `POST /api/tournaments` | Create a tournament (`{ name }`). |
| `GET /api/tournaments/:id` | Get a tournament with players and bracket. |
| `POST /api/tournaments/:id/players` | Register a player (`{ name }`). |
| `POST /api/tournaments/:id/start` | Generate the bracket and begin play. |
| `POST /api/tournaments/:id/matches/:matchId/result` | Record a match winner (`{ winnerId }`). |

## Data

Tournament data is stored in `server/data/db.json` (git-ignored). Set the
`DB_PATH` environment variable to change the location.

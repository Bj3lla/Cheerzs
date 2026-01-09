# Cheerzs!

Cheerzs! is a multiplayer drinking game built with React + TypeScript. Multiplayer rooms sync in real-time via Ably, while the backend runs as Vercel serverless functions using Supabase for persistence.

## Tech stack

- Frontend: TypeScript + React + Vite
- Realtime: Ably (Pub/Sub WebSockets)
- Backend: Vercel Serverless Functions (api/*)
- Database: Supabase (PostgreSQL)

## Quick start

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run dev:vercel  # serves /api/* locally
npm test            # unit tests
npm run build       # production build
```

## Local testing of /api routes

- `npm run dev` (Vite on http://localhost:5173) does not serve Vercel functions in `api/`, so `/api/*` will result in 404 message.
- Use `npm run dev:vercel` to test API routes locally (it prints a URL, commonly http://localhost:3000).

## Environment variables

- Vercel env vars are available in production, but not automatically on your machine.
- To use the same env vars locally: `npx vercel env pull .env.local` then restart `npm run dev:vercel`.

## Architecture

### Entry Point

```
index.html (DOM root)
  ↓
src/main.tsx (React hydration)
  ↓
src/App.tsx (Router + Game Provider)
  ↓
src/context/GameContext.tsx (Game state via useGameLogic)
  ↓
src/pages/* (Page components)
```

- App entry: [index.html](index.html) → [src/main.tsx](src/main.tsx) → [src/App.tsx](src/App.tsx)
- Pages/routes: [src/pages/](src/pages/)
- Shared game state: [src/context/GameContext.tsx](src/context/GameContext.tsx)
- Core game engine (cards + sync): [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)
- Serverless API routes: [api/](api/)

---

### Core game logic

**File:** [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)

- Central game engine: card generation, rule management, multiplayer sync.
- Key methods:
  - `generatePrompt()` — picks next category + card and updates state
  - `getRoomBroadcastState()` — serializes state for Ably broadcast
  - `applyRoomBroadcastState(state, language)` — applies state received over Ably on remote clients (from host). 
  - `setRoomSession(roomID, players)` / `clearRoomSession()` — multiplayer session lifecycle (enter/exit multiplayer)

Card payloads broadcast between clients are modeled as a discriminated union (`CardDescriptor`).

---

### Pages & navigation

All pages reside in [src/pages/](src/pages/).

- `/` → `HomePage.tsx`
- `/create-room` → `CreateRoomPage.tsx`
- `/join-room` → `JoinRoomPage.tsx`
- `/waiting-room/:roomId` → `WaitingRoomPage.tsx`
- `/game` → `GamePage.tsx`
- `/add-players` → `AddPlayersManuallyPage.tsx`
- `/menu` → `MenuPage.tsx`

---

### Real-time multiplayer (Ably)

- Client auth via `/api/ably-auth`
- Clients subscribe to a room channel and receive state updates (e.g. card drawn, players joined)
- Host publishes authoritative state (card + active rules + started flag)

---

### Backend API (Vercel serverless)

Endpoints live in [api/](api/).

Common patterns:
- Input validation (roomID, username, playerId)
- Rate limiting
- PlayerId validation on mutating routes

Helpful libs:
- Ably REST helper (lazy import): [api/_lib/ably.ts](api/_lib/ably.ts)
- Validation + rate limiting: [api/_lib/security.ts](api/_lib/security.ts)

---

## Data & i18n

- Game questions/tasks/rules: [src/data/](src/data/)
- Translations: [src/locales/translations.ts](src/locales/translations.ts)

---

## Testing

- Unit tests: Vitest + React Testing Library
- Setup: [src/test/setup.ts](src/test/setup.ts)

---

## Build & deploy

- Build tool: Vite ([vite.config.js](vite.config.js))
- Deploy: Vercel ([vercel.json](vercel.json))

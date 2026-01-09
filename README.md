
# Cheerzs!

**Cheerzs!** is a multiplayer drinking game built with React + TypeScript. Multiplayer rooms sync in real-time via Ably, while the backend runs as Vercel serverless functions using Supabase for persistence.

## Tech stack

- Frontend: TypeScript + React + Vite
- Realtime: Ably (Pub/Sub WebSockets)
- Backend: Vercel Serverless Functions (`api/*`)
- Database: Supabase (PostgreSQL)

## Important terminal commands

- `npm install` — install dependencies
- `npm run dev` — run Vite dev server (frontend only)
- `npm run dev:vercel` — run Vercel dev server (serves `/api/*`)
- `npm run build` — build for production

## Local testing of `/api` routes

- When you run `npm run dev` (Vite on http://localhost:5173), Vercel serverless functions in `api/` are **not** served, so `/api/create-room` will return 404.
- To test API routes locally, run `npm run dev:vercel` and use the URL it prints (commonly http://localhost:3000).

## Environment variables

- Environment variables you set in Vercel are available in production, but not automatically on your machine.
- To use the same env vars locally, run `npx vercel env pull .env.local` then restart `npm run dev:vercel`.

---

## Application Architecture

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

**File:** [index.html](index.html)
- Standard HTML5 entry point with root `<div id="root"></div>`
- Loads main.tsx module

**File:** [src/main.tsx](src/main.tsx)
- Mounts React app into DOM with StrictMode
- Imports CSS and App component

**File:** [src/App.tsx](src/App.tsx)
- **BrowserRouter** for client-side routing
- **GameProvider** wraps entire app for context access
- **RoomCleanupOnLanding** component: Handles cleanup when player leaves a room (via sendBeacon)
- Defines all application routes

---

## Core Game Logic

### Game State Management

**File:** [src/context/GameContext.tsx](src/context/GameContext.tsx)
- Wraps `useGameLogic` hook and exposes via React Context
- **`GameProvider`**: Initializes game state with language preference
- **`useGame()`**: Hook to access game state from any component

**File:** [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts) (439 lines)
- **Central game orchestration** — handles all game logic and state
- **Key State Variables:**
	- `gameStarted`: Boolean tracking if game is active
	- `category`: Current card category (truth, dare, never, point, rule, repeal, drinkingbuddy, wildcard)
	- `prompt`: Text displayed to players
	- `currentCard`: Serialized card descriptor for multiplayer sync
	- `activeRules`: Array of active rules with round tracking
	- `roomId` / `roomPlayers`: Multiplayer session info
	- `friends`: Local-mode player list

- **Key Methods:**
	- **`generatePrompt()`**: Generates next game card based on RNG and category distribution
		- Returns `CardDescriptor` (discriminated union type for different card types)
		- Updates state and broadcasts to other players via `broadcastStateRef`
	- **`getRoomBroadcastState()`**: Serializes current game state for Ably publish
	- **`applyRoomBroadcastState(state, language)`**: Applies received state from host on remote clients
	- **`setRoomSession(roomID, players)`**: Enters multiplayer mode
	- **`clearRoomSession()`**: Exits multiplayer mode
	- **`resetGameState()`**: Clears all game state (decks, rules, players)

- **Card Types (CardDescriptor discriminated union):**
	```typescript
	type CardDescriptor =
		| { kind: "repeal"; ruleId: string | number }
		| { kind: "question"; category: CategoryKey; questionId?: string | number; selectedPlayer?: PlayerName }
		| { kind: "rule"; ruleId: string | number }
		| { kind: "wildcard"; questionId?: string | number; selectedPlayer?: PlayerName }
		| { kind: "drinkingbuddy"; p1: PlayerName | null; p2: PlayerName | null };
	```

---

## Pages & Navigation

All pages located in [src/pages/](src/pages/)

| Route | Page File | Purpose |
|-------|-----------|---------|
| `/` | `HomePage.tsx` | Entry page; collect player name, choose create/join/manual |
| `/create-room` | `CreateRoomPage.tsx` | Create new room (POST `/api/create-room`) |
| `/join-room` | `JoinRoomPage.tsx` | Join existing room (POST `/api/join-room`) |
| `/waiting-room/:roomId` | `WaitingRoomPage.tsx` | Pre-game lobby; Ably real-time player sync; host starts game |
| `/game` | `GamePage.tsx` | Main game loop; displays cards, Ably event listeners |
| `/add-players` | `AddPlayersManuallyPage.tsx` | Local-only mode: add friends manually |
| `/menu` | `MenuPage.tsx` | Post-game menu / settings |

### Key Page Responsibilities

**HomePage.tsx**
- Player name input validation
- Routes to create-room, join-room, or add-players-manually

**CreateRoomPage.tsx / JoinRoomPage.tsx**
- API requests to create or join a room
- Stores `playerId` and `playerRoomId` in localStorage
- Saves player name in localStorage
- Redirects to waiting-room on success

**WaitingRoomPage.tsx**
- Fetches current room state via `/api/room-state`
- Listens to Ably `room:${roomID}` channel for player-joined events
- Displays list of current players
- Host-only: "Start Game" button calls `/api/start-game`
- Non-host: Waits for host to start; auto-navigates to /game if already started
- Handles player removal (host only)

**GamePage.tsx**
- Core game loop: displays card + prompt
- Listens to Ably `room:${roomID}` channel for card updates
- Calls `/api/draw-card` to request next card (host only)
- Receives state via `applyRoomBroadcastState` from Ably broadcast

---

## Key Hooks

**File:** [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)
- Orchestrates all game logic; see "Core Game Logic" section above

**File:** [src/hooks/useQuestionState.ts](src/hooks/useQuestionState.ts)
- Manages "read" vs "unread" question decks per category
- **`pickQuestion(categoryKey)`**: Returns next unread question; re-shuffles read deck when unread is exhausted
- Prevents duplicate questions within a game

**File:** [src/hooks/useRuleManagement.ts](src/hooks/useRuleManagement.ts)
- Tracks active rules and their durations (rounds)
- **`addRule(rule, activeRules)`**: Adds rule with 3-round duration
- **`updateActiveRules(activeRules)`**: Decrements rule durations; returns expired rule if any
- **`clearRepel()`**: Clears "repeal" state after displaying

**File:** [src/hooks/useFriendManagement.ts](src/hooks/useFriendManagement.ts)
- Local-mode player list management (for adding friends manually)
- **`addFriend(name)`**: Adds player to friends array
- **`removeFriend(name)`**: Removes player from friends array

**File:** [src/hooks/useLanguage.ts](src/hooks/useLanguage.ts)
- Language preference (en / no) with localStorage persistence
- Exports `LanguageCode` type

---

## Real-Time Multiplayer (Ably)

**Ably Integration Points:**

1. **WaitingRoomPage.tsx**
	 - Subscribes to `room-${roomID}` channel
	 - Listens for `player-joined` events to update player list

2. **GamePage.tsx**
	 - Subscribes to `room-${roomID}` channel
	 - Listens for `card-drawn` events → calls `applyRoomBroadcastState`

3. **useGameLogic.ts**
	 - Stores broadcast state in `broadcastStateRef.current`
	 - Host publishes card state on each draw via `/api/draw-card`

**Auth Flow:**
- Client calls `/api/ably-auth?roomID=...&username=...&playerId=...`
- Server validates player via Supabase, generates token request
- Client receives token and connects to Ably

---

## Backend API Endpoints

All endpoints in [api/](api/) folder; run on Vercel serverless

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/create-room` | POST | Create new room + insert host as player |
| `/api/join-room` | POST | Join existing room; check username uniqueness |
| `/api/room-state` | GET | Fetch room host, players, game state |
| `/api/game-state` | GET | Fetch current card/rules state |
| `/api/start-game` | POST | Mark room game as started (host only) |
| `/api/draw-card` | POST | Generate next card + broadcast via Ably |
| `/api/leave-room` | POST | Remove player; delete room if empty |
| `/api/remove-player` | POST | Remove specific player (host only) |
| `/api/ably-auth` | POST | Generate Ably auth token request |
| `/api/heartbeat` | POST | Keep-alive ping (unused currently) |
| `/api/cleanup-stale-rooms` | GET | Cron job to delete old rooms |

### Security Features
- **PlayerId validation**: Mutating endpoints verify `playerId` matches database record for room + username
- **Rate limiting**: IP-based rate limiting on all endpoints (in-memory store)
- **Validation**: All inputs (roomID, username, playerId) validated via `validateRoomId`, `validateUsername`

**Lazy Ably Import:** [api/_lib/ably.ts](api/_lib/ably.ts)
- Avoids module-load crashes on Vercel by lazy-loading Ably library
- Used across all API endpoints that need to publish events

**Security Helpers:** [api/_lib/security.ts](api/_lib/security.ts)
- `validateRoomId(roomID)`: 4–6 uppercase alphanumeric
- `validateUsername(username)`: 1–50 alphanumeric + space
- `getClientIp(req)`: Extract client IP (handles proxies)
- `rateLimit({ key, limit, windowMs })`: In-memory rate limiter

---

## Database (Supabase)

**Tables:**
- **`rooms`**: `{ id, host, created_at }`
- **`players`**: `{ id, room_id, username, created_at }`
- **`room_game_state`**: `{ room_id, seq, state (JSON), updated_at }`

**State Schema (room_game_state.state):**
```typescript
{
	started: boolean;
	card: CardDescriptor | null;
	activeRules: Rule[];
}
```

---

## Data Files

**Card Question Decks:** [src/data/](src/data/)
- `truthOrDare.ts`: Truth & Dare questions (bilingual en/no)
- `neverHaveIEver.ts`: Never Have I Ever statements
- `pointAtSomeone.ts`: "Who in this room...?" prompts
- `drinkingBuddy.ts`: Buddy card flavor text
- `wildcard.ts`: One-player and all-players wildcards

**Game Rules:** [src/data/newRule.ts](src/data/newRule.ts)
- Expandable rule list with repeal messages

**Game Modes:** [src/data/gameModes.ts](src/data/gameModes.ts)
- (Currently unused; potential for future game variants)

**Translations:** [src/locales/translations.ts](src/locales/translations.ts)
- Bilingual UI strings (English & Norwegian)
- Game rules explanations
- Error messages

---

## Component Structure

**UI Components:** [src/components/](src/components/)

| Component | Purpose |
|-----------|---------|
| `Button.tsx` | Reusable styled button |
| `Card.tsx` | Card display component |
| `AddPlayer.tsx` | Player name input field |
| `AddPlayersManually.tsx` | Manual friend add form |
| `LanguageSelector.tsx` | Language toggle (en / no) |
| `Topbar.tsx` | Header with back button + language selector |
| `GameRules.tsx` | Displays rules modal |
| `CheerzsRulesPopup.tsx` | Game rules popup |
| `LateJoinPopup.tsx` | Notification when joining late game |
| `LeaveRoomPopup.tsx` | Confirmation dialog for leaving |
| `Room.tsx` | (Deprecated?) Displays room info |
| `CreateRoom.tsx` | Room creation form |
| `JoinRoom.tsx` | Room join form |

---

## Testing

**Test Files:** [src/](src/)
- `src/utils/gameUtils.test.ts`: Random utility functions
- `src/utils/randomAmountOfZips.test.ts`: Sip quantity generation
- `api/_lib/security.test.ts`: Validation & rate limiting
- `src/components/LanguageSelector.test.tsx`: Language toggle
- `src/pages/HomePage.test.tsx`: Home page logic

**Test Framework:** Vitest + React Testing Library
**Setup:** [src/test/setup.ts](src/test/setup.ts)
- Imports jest-dom matchers
- Runs Testing Library cleanup after each test

**Run Tests:** `npm test` or `npm run test:run`

---

## Build & Deployment

**Build Tool:** Vite
- **Config:** [vite.config.js](vite.config.js)
- **Output:** [dist/](dist/) folder
- **Command:** `npm run build`

**Deployment:** Vercel
- **Config:** [vercel.json](vercel.json)
- **Cron Job:** `/api/cleanup-stale-rooms` runs daily at 04:00 UTC

**TypeScript Config:** [tsconfig.json](tsconfig.json)
- Includes `src/` and `api/`
- Module resolution: "Bundler"
- Strict mode: disabled (allowing legacy code patterns where needed)

---

## Data Flow Diagram

### Single-Player (Local Mode)
```
HomePage
	↓ (enter name, choose "Add Players")
AddPlayersManuallyPage
	↓ (add friends, start)
GamePage ← useGameLogic (generate prompts locally)
```

### Multiplayer (Room Mode)
```
HomePage
	↓
CreateRoomPage → POST /api/create-room (store playerId)
	↓
WaitingRoomPage ← Ably (listen "player-joined")
	↓ (host clicks "Start Game")
	→ POST /api/start-game
	↓
GamePage ← Ably (listen card updates via draw-card broadcast)
	← useGameLogic.applyRoomBroadcastState (remote sync)
```

---

## Key Constants & Distributions

**Card Category Distribution** [src/utils/gameUtils.ts](src/utils/gameUtils.ts)
```typescript
const random = Math.random() * 100;
if (random < 2) return "drinkingbuddy";  // 2%
if (random < 4) return "wildcard";       // 2%
if (random < 8) return "rule";           // 4%
if (random < 34) return "point";         // 26%
if (random < 60) return "never";         // 26%
if (random < 80) return "truth";         // 20%
return "dare";                           // 20%
```

**Rule Duration:** 3 rounds (lines decremented each turn)

**Rate Limits:**
- create-room: 6 per minute per IP
- start-game: 30 per minute per IP
- draw-card: 30 per minute per IP

---

## Common Tasks

### Add a New Card Category
1. Create deck in [src/data/](src/data/)
2. Add to `CardDescriptor` type in [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)
3. Handle in `generatePrompt()` and `applyRoomBroadcastState()`
4. Add category color to `categoryColors` in [src/utils/gameUtils.ts](src/utils/gameUtils.ts)
5. Update translations

### Add a New Page
1. Create [src/pages/YourPage.tsx](src/pages/)
2. Add route to [src/App.tsx](src/App.tsx)
3. Add navigation link from existing pages

### Add/Modify Questions
1. Edit corresponding file in [src/data/](src/data/)
2. Follow format: `{ id: number, en: string, no: string }`

### Extend Translations
1. Add key to `translations.en.ui` and `translations.no.ui` in [src/locales/translations.ts](src/locales/translations.ts)
2. Use `i18n.ui.yourKey` in components

---

## Performance Notes

- **Question Decks:** Lazy-loaded from imports; no API calls
- **Ably:** Real-time sync via subscription-only channels (reduces bandwidth)
- **Broadcast State:** Serialized as `CardDescriptor` (small JSON payload)
- **Rate Limiting:** In-memory; scales with concurrent players per IP

---

This overview should give you a complete picture of how Cheerzs! is structured and how the pieces fit together. For implementation details, refer to the specific files mentioned.

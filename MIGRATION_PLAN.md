# Migration Plan: Ably + Supabase → Convex

## Overview
This document outlines the step-by-step plan to migrate from Ably (real-time) + Supabase (database) to Convex (unified platform).

## Timeline: 2-3 weeks

### Week 1: Setup & Parallel Implementation

#### Phase 1: Setup (Days 1-2)
- [x] Install Convex (`npm install convex`)
- [x] Initialize Convex project (`npx convex dev`)
- [x] Create Convex schema (rooms, songs, questions, wildcards)
- [x] Set up Convex functions (mutations, queries)
- [ ] Configure environment variables

#### Phase 2: Data Migration (Days 3-4)
- [x] Create seed scripts for existing data
- [ ] Run migration script to populate Convex database
- [ ] Verify data integrity
- [ ] Test queries and mutations in Convex dashboard

#### Phase 3: Authentication (Day 5)
- [ ] Set up Convex Auth (or continue using existing auth)
- [ ] Map user IDs between systems
- [ ] Test authentication flow

### Week 2: Feature Migration

#### Phase 4: Room Management (Days 6-8)
**Current Ably Implementation:**
- `api/create-room.ts` - Creates room via Vercel function
- `api/join-room.ts` - Joins room via Vercel function
- Ably channel for real-time updates

**New Convex Implementation:**
- `convex/rooms.ts` - createRoom, joinRoom, leaveRoom mutations
- Real-time updates automatic via Convex subscriptions
- Remove Vercel API routes (no longer needed!)

**Migration Steps:**
1. Create new React hooks using Convex
   ```typescript
   // src/hooks/useConvexRoom.ts
   import { useQuery, useMutation } from "convex/react";
   import { api } from "../convex/_generated/api";
   
   export function useRoom(roomId) {
     return useQuery(api.rooms.getRoom, { roomId });
   }
   
   export function useRoomActions() {
     return {
       createRoom: useMutation(api.rooms.createRoom),
       joinRoom: useMutation(api.rooms.joinRoom),
       leaveRoom: useMutation(api.rooms.leaveRoom),
     };
   }
   ```

2. Update components to use Convex hooks
3. Feature flag to test both systems in parallel
4. Compare behavior and fix discrepancies

#### Phase 5: Game Logic (Days 9-11)
**Current Implementation:**
- `api/draw-card.ts` - Draws card via Vercel function
- `api/game-state.ts` - Manages game state
- Ably publishes card to channel
- Frontend subscribes to Ably channel

**New Convex Implementation:**
- `convex/game.ts` - drawCard, endGame, restartGame mutations
- Automatic real-time updates (no manual pub/sub!)
- State persisted in database

**Migration Steps:**
1. Create game hooks
   ```typescript
   // src/hooks/useConvexGame.ts
   import { useQuery, useMutation } from "convex/react";
   import { api } from "../convex/_generated/api";
   
   export function useGame(roomId) {
     const room = useQuery(api.rooms.getRoom, { roomId });
     const drawCard = useMutation(api.game.drawCard);
     const endGame = useMutation(api.game.endGame);
     
     return { room, drawCard, endGame };
   }
   ```

2. Update GamePage.tsx to use Convex
3. Remove Ably channel subscriptions
4. Test card drawing and state updates

#### Phase 6: Player Presence (Days 12-13)
**Current Implementation:**
- `api/heartbeat.ts` - Updates player status
- Ably presence channel
- Manual heartbeat every 30 seconds

**New Convex Implementation:**
- `convex/rooms.ts` - updatePlayerStatus mutation
- Automatic presence via Convex
- Simpler heartbeat logic

### Week 3: Testing & Cleanup

#### Phase 7: Testing (Days 14-16)
- [ ] Unit tests for Convex functions
- [ ] Integration tests for room flow
- [ ] E2E tests for complete game flow
- [ ] Load testing (simulate multiple rooms)
- [ ] Cross-browser testing
- [ ] Mobile testing

#### Phase 8: Performance Optimization (Days 17-18)
- [ ] Add caching where needed
- [ ] Optimize database indexes
- [ ] Implement pagination if needed
- [ ] Monitor query performance in Convex dashboard

#### Phase 9: Cleanup & Deploy (Days 19-21)
- [ ] Remove Ably dependencies (`npm uninstall ably`)
- [ ] Remove Supabase client (if not using for auth)
- [ ] Delete unused Vercel API routes
- [ ] Remove old hooks and utilities
- [ ] Update environment variables
- [ ] Deploy to production
- [ ] Monitor for issues

## Code Changes Breakdown

### Files to Create
- ✅ `convex/schema.ts` - Database schema
- ✅ `convex/rooms.ts` - Room management
- ✅ `convex/game.ts` - Game logic
- ✅ `convex/songs.ts` - Song queries
- ✅ `convex/questions.ts` - Question queries
- ✅ `convex/seed.ts` - Data seeding
- ✅ `convex/crons.ts` - Scheduled jobs
- ✅ `scripts/migrateToConvex.js` - Migration script
- [ ] `src/hooks/useConvexRoom.ts` - Room hooks
- [ ] `src/hooks/useConvexGame.ts` - Game hooks
- [ ] `src/lib/convex.ts` - Convex client setup

### Files to Update
- [ ] `src/main.tsx` - Add ConvexProvider
- [ ] `src/pages/CreateRoomPage.tsx` - Use Convex
- [ ] `src/pages/JoinRoomPage.tsx` - Use Convex
- [ ] `src/pages/WaitingRoomPage.tsx` - Use Convex
- [ ] `src/pages/GamePage.tsx` - Use Convex
- [ ] `src/components/Room.tsx` - Use Convex
- [ ] `.env` - Add VITE_CONVEX_URL

### Files to Delete
- [ ] `api/ably-auth.ts`
- [ ] `api/create-room.ts`
- [ ] `api/join-room.ts`
- [ ] `api/leave-room.ts`
- [ ] `api/draw-card.ts`
- [ ] `api/game-state.ts`
- [ ] `api/heartbeat.ts`
- [ ] `api/room-state.ts`
- [ ] `api/start-game.ts`
- [ ] `api/_lib/ably.ts`
- [ ] `src/hooks/useAblyRoom.ts` (if exists)

## Rollback Plan

If issues arise, we can quickly rollback:

1. Keep Ably code in place during testing phase
2. Use feature flags to toggle between systems
3. If needed, revert to Ably by:
   - Restore deleted API routes from git
   - Switch feature flag
   - Redeploy

## Success Metrics

- ✅ All features working identically
- ✅ Real-time updates < 100ms latency
- ✅ No data loss during migration
- ✅ Room creation/joining works flawlessly
- ✅ Card drawing is smooth
- ✅ Player presence accurate
- ✅ Mobile performance improved
- ✅ Bundle size reduced (by ~100KB)
- ✅ Code reduced by ~50% (fewer files)

## Risk Mitigation

1. **Data Loss Risk**: LOW
   - Keep original data files
   - Test migration script thoroughly
   - Verify data after migration

2. **Real-time Performance Risk**: LOW
   - Convex is optimized for real-time
   - Test with multiple concurrent rooms
   - Monitor latency in dashboard

3. **Breaking Changes Risk**: MEDIUM
   - Gradual migration with feature flags
   - Extensive testing before switching
   - Quick rollback plan

4. **Learning Curve Risk**: LOW
   - Convex has excellent docs
   - TypeScript-first reduces errors
   - API is simpler than Ably + Supabase

## Post-Migration Benefits

1. **Simpler Codebase**
   - One service instead of two
   - Fewer API routes
   - Less configuration

2. **Better Developer Experience**
   - Type-safe queries/mutations
   - Hot reload in development
   - Integrated dashboard

3. **Cost Savings**
   - Convex free tier: 25 GB bandwidth/month
   - Ably free tier: 6M messages/month
   - Estimated savings: $50-100/month at scale

4. **Better Performance**
   - Automatic caching
   - Optimized real-time
   - Built-in presence

5. **Easier Maintenance**
   - One dashboard to monitor
   - Simpler debugging
   - Automatic backups

## Next Steps

1. Run `npx convex dev` to start development server
2. Execute migration script: `node scripts/migrateToConvex.js`
3. Verify data in Convex dashboard
4. Start implementing new hooks
5. Update one page at a time
6. Test thoroughly before deploying

## Questions/Concerns?

- Convex Discord: https://discord.gg/convex
- Convex Docs: https://docs.convex.dev
- Migration Guide: https://docs.convex.dev/migration

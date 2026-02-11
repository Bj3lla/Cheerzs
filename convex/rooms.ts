import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Generate a unique 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoiding ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new room
export const createRoom = mutation({
  args: {
    hostId: v.string(),
    hostName: v.string(),
    gameMode: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = generateRoomCode();
    const now = Date.now();

    // Check if code already exists (unlikely but possible)
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (existing) {
      // Try again with a new code by generating another one
      const newCode = generateRoomCode();
      const roomId = await ctx.db.insert("rooms", {
        code: newCode,
        hostId: args.hostId,
        gameMode: args.gameMode,
        status: "waiting",
        players: [
          {
            id: args.hostId,
            name: args.hostName,
            isOnline: true,
            lastSeen: now,
          },
        ],
        settings: {
          language: args.language || "en",
          questionTypes: [],
        },
        createdAt: now,
        lastActivity: now,
      });
      return { roomId, code: newCode };
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.hostId,
      gameMode: args.gameMode,
      status: "waiting",
      players: [
        {
          id: args.hostId,
          name: args.hostName,
          isOnline: true,
          lastSeen: now,
        },
      ],
      settings: {
        language: args.language || "en",
        questionTypes: [], // Will be set when game starts
      },
      createdAt: now,
      lastActivity: now,
    });

    return { roomId, code };
  },
});

// Join an existing room
export const joinRoom = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status === "finished") {
      throw new Error("Game has already finished");
    }

    // Check if player already in room
    const playerExists = room.players.some((p) => p.id === args.playerId);

    if (playerExists) {
      // Player reconnecting - just update online status
      await ctx.db.patch(room._id, {
        players: room.players.map((p) =>
          p.id === args.playerId
            ? { ...p, isOnline: true, lastSeen: Date.now() }
            : p
        ),
        lastActivity: Date.now(),
      });
    } else {
      // New player joining
      await ctx.db.patch(room._id, {
        players: [
          ...room.players,
          {
            id: args.playerId,
            name: args.playerName,
            isOnline: true,
            lastSeen: Date.now(),
          },
        ],
        lastActivity: Date.now(),
      });
    }

    return { roomId: room._id, room };
  },
});

// Leave a room
export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    // Remove player from room
    const updatedPlayers = room.players.filter((p) => p.id !== args.playerId);

    if (updatedPlayers.length === 0) {
      // No players left, delete the room
      await ctx.db.delete(args.roomId);
      return { deleted: true };
    }

    // If host left, assign new host
    let newHostId = room.hostId;
    if (room.hostId === args.playerId) {
      newHostId = updatedPlayers[0].id;
    }

    await ctx.db.patch(args.roomId, {
      players: updatedPlayers,
      hostId: newHostId,
      lastActivity: Date.now(),
    });

    return { deleted: false };
  },
});

// Update player online status (heartbeat)
export const updatePlayerStatus = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      return;
    }

    await ctx.db.patch(args.roomId, {
      players: room.players.map((p) =>
        p.id === args.playerId
          ? { ...p, isOnline: args.isOnline, lastSeen: Date.now() }
          : p
      ),
      lastActivity: Date.now(),
    });
  },
});

// Start the game
export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    questionTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      settings: {
        ...room.settings!,
        questionTypes: args.questionTypes,
      },
      lastActivity: Date.now(),
    });

    return { success: true };
  },
});

// Get room by ID (real-time updates!)
export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

// Get room by code
export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
  },
});

export const getRoomById = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

// Clean up stale rooms (can be called by a cron job)
export const cleanupStaleRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twoHoursAgo = now - 2 * 60 * 60 * 1000; // 2 hours

    const staleRooms = await ctx.db
      .query("rooms")
      .withIndex("by_lastActivity", (q) => q.lt("lastActivity", twoHoursAgo))
      .collect();

    for (const room of staleRooms) {
      await ctx.db.delete(room._id);
    }

    return { deletedCount: staleRooms.length };
  },
});

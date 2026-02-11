import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Create a new room
export const createRoom = mutation({
  args: {
    code: v.string(),
    hostId: v.string(),
    hostName: v.string(),
    gameMode: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase().trim();
    const now = Date.now();

    // Check if code already exists
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (existing) {
      throw new Error("Room code already exists. Please choose a different name.");
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.hostId,
      gameMode: args.gameMode,
      status: "waiting",
      playerIds: [args.hostId],
      settings: {
        language: args.language || "en",
        questionTypes: [], // Will be set when game starts
      },
      createdAt: now,
      lastActivity: now,
    });

    // Create player entry
    await ctx.db.insert("players", {
      playerId: args.hostId,
      name: args.hostName,
      roomId,
      isOnline: true,
      lastSeen: now,
      createdAt: now,
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
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_room_and_playerId", (q) => 
        q.eq("roomId", room._id).eq("playerId", args.playerId)
      )
      .first();

    if (existingPlayer) {
      // Player reconnecting - just update online status
      await ctx.db.patch(existingPlayer._id, {
        isOnline: true,
        lastSeen: Date.now(),
      });
      await ctx.db.patch(room._id, {
        lastActivity: Date.now(),
      });
    } else {
      // New player joining
      await ctx.db.insert("players", {
        playerId: args.playerId,
        name: args.playerName,
        roomId: room._id,
        isOnline: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });
      
      await ctx.db.patch(room._id, {
        playerIds: [...room.playerIds, args.playerId],
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

    // Find and delete player from players table
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_playerId", (q) => 
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (player) {
      await ctx.db.delete(player._id);
    }

    // Remove player from room
    const updatedPlayerIds = room.playerIds.filter((id) => id !== args.playerId);

    if (updatedPlayerIds.length === 0) {
      // No players left, delete the room and all associated players
      const allPlayers = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();
      
      for (const p of allPlayers) {
        await ctx.db.delete(p._id);
      }
      
      await ctx.db.delete(args.roomId);
      return { deleted: true };
    }

    // If host left, assign new host
    let newHostId = room.hostId;
    if (room.hostId === args.playerId) {
      newHostId = updatedPlayerIds[0];
    }

    await ctx.db.patch(args.roomId, {
      playerIds: updatedPlayerIds,
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

    // Find and update player
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_playerId", (q) => 
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();

    if (player) {
      await ctx.db.patch(player._id, {
        isOnline: args.isOnline,
        lastSeen: Date.now(),
      });
    }

    await ctx.db.patch(args.roomId, {
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

    if (room.playerIds.length < 2) {
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

// Get players for a room
export const getRoomPlayers = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    
    return players;
  },
});

// Get a specific player
export const getPlayer = query({
  args: { 
    roomId: v.id("rooms"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room_and_playerId", (q) => 
        q.eq("roomId", args.roomId).eq("playerId", args.playerId)
      )
      .first();
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
      // Delete all players in this room
      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      
      for (const player of players) {
        await ctx.db.delete(player._id);
      }
      
      await ctx.db.delete(room._id);
    }

    return { deletedCount: staleRooms.length };
  },
});

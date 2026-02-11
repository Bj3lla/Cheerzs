import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Update game state (for client-driven game logic)
export const updateGameState = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    state: v.any(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "playing") {
      throw new Error("Game is not in progress");
    }

    // Verify caller is the host
    if (room.hostId !== args.playerId) {
      throw new Error("Only the host can update game state");
    }

    const nextSeq = (room.seq ?? 0) + 1;

    // Merge with existing state
    const prevState = room.gameState || {};
    const mergedState = {
      ...prevState,
      ...args.state,
      started: true,
    };

    await ctx.db.patch(args.roomId, {
      gameState: mergedState,
      seq: nextSeq,
      lastActivity: Date.now(),
    });

    return {
      success: true,
      seq: nextSeq,
    };
  },
});

// Draw a random card (song, question, or wildcard)
export const drawCard = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "playing") {
      throw new Error("Game is not in progress");
    }

    // Determine card type randomly
    // 60% songs, 30% questions, 10% wildcards
    const rand = Math.random();
    let cardType: string;
    let card: any;

    if (rand < 0.6) {
      // Draw a song
      cardType = "song";
      const songs = await ctx.db
        .query("songs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (songs.length === 0) {
        throw new Error("No songs available");
      }

      card = songs[Math.floor(Math.random() * songs.length)];
    } else if (rand < 0.9) {
      // Draw a question
      cardType = "question";
      const questionTypes = room.settings?.questionTypes || [];

      if (questionTypes.length === 0) {
        throw new Error("No question types selected");
      }

      // Pick a random category from selected types
      const category =
        questionTypes[Math.floor(Math.random() * questionTypes.length)];

      const questions = await ctx.db
        .query("questions")
        .withIndex("by_category", (q) => q.eq("category", category))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      if (questions.length === 0) {
        throw new Error("No questions available for selected categories");
      }

      card = questions[Math.floor(Math.random() * questions.length)];
    } else {
      // Draw a wildcard
      cardType = "wildcard";
      const wildcards = await ctx.db
        .query("wildcards")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (wildcards.length === 0) {
        throw new Error("No wildcards available");
      }

      card = wildcards[Math.floor(Math.random() * wildcards.length)];
    }

    // Update room with current card
    await ctx.db.patch(args.roomId, {
      currentCard: {
        type: cardType,
        content: card,
        cardId: card._id,
      },
      lastActivity: Date.now(),
    });

    // Log analytics
    await ctx.db.insert("gameStats", {
      roomId: args.roomId,
      eventType: "card_drawn",
      metadata: {
        cardType,
        cardId: card._id,
      },
      timestamp: Date.now(),
    });

    return {
      type: cardType,
      card,
    };
  },
});

// End the game
export const endGame = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    await ctx.db.patch(args.roomId, {
      status: "finished",
      lastActivity: Date.now(),
    });

    return { success: true };
  },
});

// Restart the game
export const restartGame = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    await ctx.db.patch(args.roomId, {
      status: "waiting",
      currentCard: undefined,
      lastActivity: Date.now(),
    });

    return { success: true };
  },
});

// Get current card
export const getCurrentCard = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    return room?.currentCard;
  },
});

// Get game statistics (for analytics)
export const getGameStats = query({
  args: {
    roomId: v.id("rooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("gameStats")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(args.limit || 50);

    return stats;
  },
});

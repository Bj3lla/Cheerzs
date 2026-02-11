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
    // 50% songs, 40% questions, 10% wildcards/rules
    const rand = Math.random();
    let cardType: string;
    let card: any;

    if (rand < 0.5) {
      // Draw a song
      cardType = "song";
      const songs = await ctx.db
        .query("songs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (songs.length === 0) {
        throw new Error("No songs available");
      }

      // Get played songs for this room
      const playedSongs = await ctx.db
        .query("playedCards")
        .withIndex("by_room_and_type", (q) => 
          q.eq("roomId", args.roomId).eq("cardType", "song")
        )
        .collect();

      const playedSongIds = new Set(playedSongs.map(p => p.cardId));
      const unplayedSongs = songs.filter(s => !playedSongIds.has(s._id as any));

      // If all songs have been played, reset
      if (unplayedSongs.length === 0) {
        await resetPlayedCards(ctx, args.roomId, "song");
        card = songs[Math.floor(Math.random() * songs.length)];
      } else {
        card = unplayedSongs[Math.floor(Math.random() * unplayedSongs.length)];
      }

      // Track this card as played
      await ctx.db.insert("playedCards", {
        roomId: args.roomId,
        cardType: "song",
        cardId: card._id as any,
        playedAt: Date.now(),
      });

    } else if (rand < 0.9) {
      // Draw a question from available question types
      const questionCategories = ["truth", "dare", "neverHaveIEver", "pointingGame", "drinkingBuddy"];
      const selectedCategory = questionCategories[Math.floor(Math.random() * questionCategories.length)];
      
      cardType = selectedCategory;
      const questions = await ctx.db
        .query(selectedCategory as any)
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (questions.length === 0) {
        throw new Error(`No ${selectedCategory} questions available`);
      }

      // Get played questions for this room and category
      const playedQuestions = await ctx.db
        .query("playedCards")
        .withIndex("by_room_and_type", (q) => 
          q.eq("roomId", args.roomId).eq("cardType", selectedCategory)
        )
        .collect();

      const playedQuestionIds = new Set(playedQuestions.map(p => p.cardId));
      const unplayedQuestions = questions.filter(q => !playedQuestionIds.has(q._id as any));

      // If all questions have been played, reset
      if (unplayedQuestions.length === 0) {
        await resetPlayedCards(ctx, args.roomId, selectedCategory);
        card = questions[Math.floor(Math.random() * questions.length)];
      } else {
        card = unplayedQuestions[Math.floor(Math.random() * unplayedQuestions.length)];
      }

      // Track this card as played
      await ctx.db.insert("playedCards", {
        roomId: args.roomId,
        cardType: selectedCategory,
        cardId: card._id as any,
        playedAt: Date.now(),
      });

    } else {
      // Draw a wildcard or new rule (50/50 split)
      const isNewRule = Math.random() < 0.5;
      cardType = isNewRule ? "newRule" : "wildcard";

      const cards = await ctx.db
        .query(cardType as any)
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (cards.length === 0) {
        throw new Error(`No ${cardType} cards available`);
      }

      // Get played cards for this room and type
      const playedWildcards = await ctx.db
        .query("playedCards")
        .withIndex("by_room_and_type", (q) => 
          q.eq("roomId", args.roomId).eq("cardType", cardType)
        )
        .collect();

      const playedWildcardIds = new Set(playedWildcards.map(p => p.cardId));
      const unplayedCards = cards.filter(c => !playedWildcardIds.has(c._id as any));

      // If all cards have been played, reset
      if (unplayedCards.length === 0) {
        await resetPlayedCards(ctx, args.roomId, cardType);
        card = cards[Math.floor(Math.random() * cards.length)];
      } else {
        card = unplayedCards[Math.floor(Math.random() * unplayedCards.length)];
      }

      // Track this card as played
      await ctx.db.insert("playedCards", {
        roomId: args.roomId,
        cardType,
        cardId: card._id as any,
        playedAt: Date.now(),
      });
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

// Helper function to reset played cards for a specific type in a room
async function resetPlayedCards(ctx: any, roomId: Id<"rooms">, cardType: string) {
  const playedCards = await ctx.db
    .query("playedCards")
    .withIndex("by_room_and_type", (q: any) => 
      q.eq("roomId", roomId).eq("cardType", cardType)
    )
    .collect();

  for (const playedCard of playedCards) {
    await ctx.db.delete(playedCard._id);
  }
}

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

    // Clear all played cards for this room
    const playedCards = await ctx.db
      .query("playedCards")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const playedCard of playedCards) {
      await ctx.db.delete(playedCard._id);
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

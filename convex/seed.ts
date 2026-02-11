import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// This mutation will be called from a script to seed the database

export const seedSongs = internalMutation({
  args: {
    songs: v.array(
      v.object({
        id: v.number(),
        url: v.string(),
        title: v.optional(v.string()),
        artists: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const song of args.songs) {
      await ctx.db.insert("songs", {
        title: song.title || `Song ${song.id}`,
        artists: song.artists || [],
        spotifyUrl: song.url,
        gameModes: [],
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedTruth = internalMutation({
  args: {
    questions: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("truth", {
        textEn: q.en,
        textNo: q.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedDare = internalMutation({
  args: {
    questions: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("dare", {
        textEn: q.en,
        textNo: q.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedNeverHaveIEver = internalMutation({
  args: {
    questions: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("neverHaveIEver", {
        textEn: q.en,
        textNo: q.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedPointingGame = internalMutation({
  args: {
    questions: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("pointingGame", {
        textEn: q.en,
        textNo: q.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedDrinkingBuddy = internalMutation({
  args: {
    questions: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("drinkingBuddy", {
        textEn: q.en,
        textNo: q.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedWildcard = internalMutation({
  args: {
    wildcards: v.array(
      v.object({
        type: v.string(),
        en: v.string(),
        no: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const wildcard of args.wildcards) {
      await ctx.db.insert("wildcard", {
        type: wildcard.type,
        textEn: wildcard.en,
        textNo: wildcard.no,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedNewRule = internalMutation({
  args: {
    rules: v.array(
      v.object({
        en: v.string(),
        no: v.string(),
        repelEn: v.string(),
        repelNo: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const rule of args.rules) {
      await ctx.db.insert("newRule", {
        textEn: rule.en,
        textNo: rule.no,
        repelEn: rule.repelEn,
        repelNo: rule.repelNo,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

// Clear all data (for testing)
export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all songs
    const songs = await ctx.db.query("songs").collect();
    for (const song of songs) {
      await ctx.db.delete(song._id);
    }

    // Delete all truth questions
    const truths = await ctx.db.query("truth").collect();
    for (const truth of truths) {
      await ctx.db.delete(truth._id);
    }

    // Delete all dare questions
    const dares = await ctx.db.query("dare").collect();
    for (const dare of dares) {
      await ctx.db.delete(dare._id);
    }

    // Delete all neverHaveIEver questions
    const neverHaveIEvers = await ctx.db.query("neverHaveIEver").collect();
    for (const nhi of neverHaveIEvers) {
      await ctx.db.delete(nhi._id);
    }

    // Delete all pointingGame questions
    const pointingGames = await ctx.db.query("pointingGame").collect();
    for (const pg of pointingGames) {
      await ctx.db.delete(pg._id);
    }

    // Delete all drinkingBuddy questions
    const drinkingBuddies = await ctx.db.query("drinkingBuddy").collect();
    for (const db of drinkingBuddies) {
      await ctx.db.delete(db._id);
    }

    // Delete all wildcards
    const wildcards = await ctx.db.query("wildcard").collect();
    for (const wildcard of wildcards) {
      await ctx.db.delete(wildcard._id);
    }

    // Delete all newRules
    const newRules = await ctx.db.query("newRule").collect();
    for (const rule of newRules) {
      await ctx.db.delete(rule._id);
    }

    // Delete all playedCards
    const playedCards = await ctx.db.query("playedCards").collect();
    for (const card of playedCards) {
      await ctx.db.delete(card._id);
    }

    // Delete all rooms
    const rooms = await ctx.db.query("rooms").collect();
    for (const room of rooms) {
      await ctx.db.delete(room._id);
    }

    return { success: true };
  },
});

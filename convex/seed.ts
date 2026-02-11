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

export const seedQuestions = internalMutation({
  args: {
    category: v.string(),
    questions: v.array(
      v.object({
        no: v.string(),
        en: v.string(),
        no_text: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const q of args.questions) {
      await ctx.db.insert("questions", {
        category: args.category,
        questionNo: q.no,
        questionEn: q.en,
        questionNo_norwegian: q.no_text,
        isActive: true,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

export const seedWildcards = internalMutation({
  args: {
    wildcards: v.array(
      v.object({
        type: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const wildcard of args.wildcards) {
      await ctx.db.insert("wildcards", {
        type: wildcard.type,
        content: wildcard.content,
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

    // Delete all questions
    const questions = await ctx.db.query("questions").collect();
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    // Delete all wildcards
    const wildcards = await ctx.db.query("wildcards").collect();
    for (const wildcard of wildcards) {
      await ctx.db.delete(wildcard._id);
    }

    // Delete all rooms
    const rooms = await ctx.db.query("rooms").collect();
    for (const room of rooms) {
      await ctx.db.delete(room._id);
    }

    return { success: true };
  },
});

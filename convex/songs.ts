import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all active songs
export const getAllSongs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("songs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Get songs by game mode
export const getSongsByGameMode = query({
  args: { gameMode: v.string() },
  handler: async (ctx, args) => {
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter by game mode (songs can have multiple game modes)
    return songs.filter(
      (song) =>
        !song.gameModes ||
        song.gameModes.length === 0 ||
        (song.gameModes && song.gameModes.includes(args.gameMode))
    );
  },
});

// Get random song
export const getRandomSong = query({
  args: { gameMode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let songs;

    if (args.gameMode) {
      const allSongs = await ctx.db
        .query("songs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      const gameMode = args.gameMode; // Cache the value
      songs = allSongs.filter(
        (song) =>
          !song.gameModes ||
          song.gameModes.length === 0 ||
          (song.gameModes && song.gameModes.includes(gameMode))
      );
    } else {
      songs = await ctx.db
        .query("songs")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    if (songs.length === 0) {
      return null;
    }

    return songs[Math.floor(Math.random() * songs.length)];
  },
});

// Get song count
export const getSongCount = query({
  args: {},
  handler: async (ctx) => {
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return songs.length;
  },
});

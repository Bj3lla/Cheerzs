import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    playerId: v.string(), // Unique player identifier
    name: v.string(),
    roomId: v.id("rooms"), // Reference to the room they're in
    isOnline: v.boolean(),
    lastSeen: v.number(),
    createdAt: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_room", ["roomId"])
    .index("by_room_and_playerId", ["roomId", "playerId"]),

  rooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    gameMode: v.string(), // 'classic', 'skitur', etc.
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    currentCard: v.optional(
      v.object({
        type: v.string(), // 'song', 'question', 'wildcard'
        content: v.any(), // Song or question object
        cardId: v.optional(v.string()),
      })
    ),
    gameState: v.optional(v.any()), // Client-side game state (rules, repels, etc.)
    seq: v.optional(v.number()), // Sequence number for state versioning
    playerIds: v.array(v.string()), // Array of player IDs
    settings: v.optional(
      v.object({
        language: v.string(),
        questionTypes: v.array(v.string()),
      })
    ),
    createdAt: v.number(),
    lastActivity: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_lastActivity", ["lastActivity"]),

  songs: defineTable({
    title: v.string(),
    artists: v.array(v.string()),
    spotifyUrl: v.string(),
    gameModes: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_gameMode", ["gameModes"]),

  // Separate tables for each question type
  truth: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  dare: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  neverHaveIEver: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  pointingGame: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  drinkingBuddy: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  wildcard: defineTable({
    type: v.string(), // 'onePlayer' or 'allPlayers'
    textEn: v.string(),
    textNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_type", ["type"]),

  newRule: defineTable({
    textEn: v.string(),
    textNo: v.string(),
    repelEn: v.string(),
    repelNo: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

  // Track which cards have been played in each room
  playedCards: defineTable({
    roomId: v.id("rooms"),
    cardType: v.string(), // 'truth', 'dare', 'neverHaveIEver', etc.
    cardId: v.id("truth" as any), // Will be cast to appropriate table type
    playedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_type", ["roomId", "cardType"]),

  // Analytics (optional but useful)
  gameStats: defineTable({
    roomId: v.id("rooms"),
    eventType: v.string(), // 'card_drawn', 'player_joined', 'game_started'
    metadata: v.any(),
    timestamp: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_timestamp", ["timestamp"]),
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    players: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        isOnline: v.boolean(),
        lastSeen: v.number(),
      })
    ),
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

  questions: defineTable({
    category: v.string(), // 'drinking_buddy', 'never_have_i_ever', 'truth_or_dare', etc.
    questionNo: v.string(),
    questionEn: v.string(),
    questionNo_norwegian: v.optional(v.string()), // Norwegian
    metadata: v.optional(
      v.object({
        difficulty: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  wildcards: defineTable({
    type: v.string(), // 'new_rule', 'wildcard'
    content: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_active", ["isActive"]),

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

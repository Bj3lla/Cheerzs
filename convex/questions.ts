import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all questions from a specific table
export const getQuestionsByTable = query({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const validTables = ["truth", "dare", "neverHaveIEver", "pointingGame", "drinkingBuddy", "wildcard", "newRule"];
    
    if (!validTables.includes(args.tableName)) {
      throw new Error(`Invalid table name: ${args.tableName}`);
    }

    return await ctx.db
      .query(args.tableName as any)
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();
  },
});

// Get random question from a specific table
export const getRandomQuestion = query({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const validTables = ["truth", "dare", "neverHaveIEver", "pointingGame", "drinkingBuddy", "wildcard", "newRule"];
    
    if (!validTables.includes(args.tableName)) {
      throw new Error(`Invalid table name: ${args.tableName}`);
    }

    const questions = await ctx.db
      .query(args.tableName as any)
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();

    if (questions.length === 0) {
      return null;
    }

    return questions[Math.floor(Math.random() * questions.length)];
  },
});

// Get all available question table names
export const getAvailableTables = query({
  args: {},
  handler: async (ctx) => {
    return ["truth", "dare", "neverHaveIEver", "pointingGame", "drinkingBuddy", "wildcard", "newRule"];
  },
});

// Get all questions for all categories in a single call.
// Normalises every row to { id, en, no } (plus `type` for wildcards
// and repel fields for newRule) so the client can consume them directly.
export const getAllQuestions = query({
  args: {},
  handler: async (ctx) => {
    const [truth, dare, neverHaveIEver, pointingGame, drinkingBuddyRows, wildcardRows, newRuleRows] =
      await Promise.all([
        ctx.db.query("truth").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("dare").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("neverHaveIEver").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("pointingGame").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("drinkingBuddy").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("wildcard").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
        ctx.db.query("newRule").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect(),
      ]);

    const norm = (rows: any[]) =>
      rows.map((r) => ({ id: r._id, en: r.textEn, no: r.textNo }));

    const wildcardOne = wildcardRows
      .filter((r) => r.type === "onePlayer")
      .map((r) => ({ id: r._id, en: r.textEn, no: r.textNo }));
    const wildcardAll = wildcardRows
      .filter((r) => r.type === "allPlayers")
      .map((r) => ({ id: r._id, en: r.textEn, no: r.textNo }));

    const newRules = newRuleRows.map((r) => ({
      id: r._id,
      en: r.textEn,
      no: r.textNo,
      repelEn: r.repelEn,
      repelNo: r.repelNo,
    }));

    return {
      truth: norm(truth),
      dare: norm(dare),
      never: norm(neverHaveIEver),
      point: norm(pointingGame),
      drinkingbuddy: norm(drinkingBuddyRows),
      wildcardOne,
      wildcardAll,
      newRules,
    };
  },
});

// Get question count for a specific table
export const getQuestionCount = query({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const validTables = ["truth", "dare", "neverHaveIEver", "pointingGame", "drinkingBuddy", "wildcard", "newRule"];
    
    if (!validTables.includes(args.tableName)) {
      throw new Error(`Invalid table name: ${args.tableName}`);
    }

    const questions = await ctx.db
      .query(args.tableName as any)
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();

    return questions.length;
  },
});

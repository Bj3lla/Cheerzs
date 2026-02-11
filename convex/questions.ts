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

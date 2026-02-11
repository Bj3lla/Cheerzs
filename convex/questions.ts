import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all questions by category
export const getQuestionsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get random question from category
export const getRandomQuestion = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (questions.length === 0) {
      return null;
    }

    return questions[Math.floor(Math.random() * questions.length)];
  },
});

// Get all question categories
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Get unique categories
    const categories = new Set(questions.map((q) => q.category));
    return Array.from(categories);
  },
});

// Get question count by category
export const getQuestionCount = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.category) {
      const questions = await ctx.db
        .query("questions")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      return questions.length;
    } else {
      const questions = await ctx.db
        .query("questions")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      return questions.length;
    }
  },
});

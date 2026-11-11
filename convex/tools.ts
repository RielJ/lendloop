import { v } from "convex/values";
import { query } from "./_generated/server";
import { vCategory } from "./schema";

/**
 * Public, unauthenticated list of available tools.
 * Returns name and category only: no owner, description, or condition.
 * The `returns` validator rejects any extra field at runtime.
 */
export const listPublic = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("tools"), name: v.string(), category: vCategory })),
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").order("desc").take(200);
    return tools
      .filter((tool) => tool.activeLoanId === undefined)
      .slice(0, 100)
      .map(({ _id, name, category }) => ({ _id, name, category }));
  },
});

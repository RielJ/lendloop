import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { canEditTool, canRemoveTool, validateToolInput } from "./lib/rules";
import { vCategory, vCondition } from "./schema";

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

/** What a signed-in neighbor sees for a listing. Owner email is never included. */
const vToolView = v.object({
  _id: v.id("tools"),
  _creationTime: v.number(),
  name: v.string(),
  category: vCategory,
  condition: vCondition,
  description: v.string(),
  available: v.boolean(),
  owner: v.object({ _id: v.id("users"), name: v.string(), trusted: v.boolean() }),
  isMine: v.boolean(),
});

async function toView(ctx: QueryCtx, tool: Doc<"tools">, viewerId: Id<"users">) {
  const owner = await ctx.db.get("users", tool.ownerId);
  return {
    _id: tool._id,
    _creationTime: tool._creationTime,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    available: tool.activeLoanId === undefined,
    owner: {
      _id: tool.ownerId,
      name: owner?.name ?? "Former neighbor",
      trusted: owner?.trusted ?? false,
    },
    isMine: tool.ownerId === viewerId,
  };
}

/** All listings for signed-in users, optionally filtered by category. */
export const list = query({
  args: { category: v.optional(vCategory) },
  returns: v.array(vToolView),
  handler: async (ctx, { category }) => {
    const user = await requireUser(ctx);
    const tools = category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", category))
          .order("desc")
          .take(200)
      : await ctx.db.query("tools").order("desc").take(200);
    return await Promise.all(tools.map((tool) => toView(ctx, tool, user._id)));
  },
});

export const mine = query({
  args: {},
  returns: v.array(vToolView),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(200);
    return await Promise.all(tools.map((tool) => toView(ctx, tool, user._id)));
  },
});

const toolInput = {
  name: v.string(),
  category: vCategory,
  condition: vCondition,
  description: v.string(),
};

export const create = mutation({
  args: toolInput,
  returns: v.id("tools"),
  handler: async (ctx, input) => {
    const user = await requireUser(ctx);
    const error = validateToolInput(input);
    if (error) throw new ConvexError(error);
    return await ctx.db.insert("tools", {
      ownerId: user._id,
      name: input.name.trim(),
      category: input.category,
      condition: input.condition,
      description: input.description.trim(),
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolInput },
  returns: v.null(),
  handler: async (ctx, { toolId, ...input }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (!canEditTool(user, tool)) throw new ConvexError("Only the owner can edit this listing");
    const error = validateToolInput(input);
    if (error) throw new ConvexError(error);
    await ctx.db.patch("tools", toolId, {
      name: input.name.trim(),
      category: input.category,
      condition: input.condition,
      description: input.description.trim(),
    });
    return null;
  },
});

/**
 * Owners remove idle listings; admins remove any listing.
 * Pending requests for the tool are declined. Loan rows keep a name snapshot,
 * so history survives the removal.
 */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  returns: v.null(),
  handler: async (ctx, { toolId }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (!canRemoveTool(user, tool)) {
      throw new ConvexError(
        tool.ownerId === user._id
          ? "This tool is on loan. Mark it returned before removing it"
          : "Only the owner or an admin can remove this listing",
      );
    }
    const pending = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .take(100);
    for (const loan of pending) await ctx.db.patch("loans", loan._id, { status: "declined" });
    await ctx.db.delete("tools", toolId);
    return null;
  },
});

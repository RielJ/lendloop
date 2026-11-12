import { v } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { internalMutation, type QueryCtx } from "@/convex/_generated/server";

export const vEventKind = v.union(v.literal("notification"), v.literal("reminder"));
export const vEventStatus = v.union(v.literal("sent"), v.literal("failed"));

/** Latest automation outcome for a loan, shown as an activity line in the UI. */
export const vActivity = v.union(
  v.null(),
  v.object({ kind: vEventKind, status: vEventStatus, detail: v.string(), at: v.number() }),
);

export async function latestActivity(ctx: QueryCtx, loanId: Id<"loans">) {
  const event = await ctx.db
    .query("automationEvents")
    .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
    .order("desc")
    .first();
  if (!event) return null;
  return { kind: event.kind, status: event.status, detail: event.detail, at: event._creationTime };
}

/**
 * Records one automation outcome, keyed for idempotency. A repeat with the same
 * key updates the existing row (e.g. a later retry succeeded) instead of adding one.
 * Returns true when the key was new.
 */
export const record = internalMutation({
  args: {
    loanId: v.id("loans"),
    kind: vEventKind,
    status: vEventStatus,
    key: v.string(),
    detail: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch("automationEvents", existing._id, {
        status: args.status,
        detail: args.detail,
      });
      return false;
    }
    await ctx.db.insert("automationEvents", args);
    return true;
  },
});

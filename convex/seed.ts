import { v } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { internalMutation, type MutationCtx } from "@/convex/_generated/server";
import { todayUtc } from "@/convex/lib/rules";

/**
 * Demo data: three neighbors, five tools and one loan per state, including an
 * overdue one for the reminder workflow. Re-runnable: rows are matched by the
 * seed token or by name, so a second run changes nothing. Returns loans added.
 * Seed users use `seed|` token identifiers, which no Clerk sign-in can produce.
 *
 *   bunx convex run seed:run
 */
export const run = internalMutation({
  args: {},
  returns: v.object({ added: v.number() }),
  handler: async (ctx) => {
    const day = (offset: number) => todayUtc(Date.now() + offset * 86_400_000);
    const [maya, sam, lee] = await Promise.all([
      seedUser(ctx, "maya", "Maya Patel", true),
      seedUser(ctx, "sam", "Sam Okafor", false),
      seedUser(ctx, "lee", "Lee Chen", false),
    ]);

    const drill = await seedTool(ctx, maya, "Cordless drill", "power_tools", "good");
    const ladder = await seedTool(ctx, maya, "Extension ladder", "hand_tools", "fair");
    const tent = await seedTool(ctx, sam, "Four-person tent", "camping", "good");
    await seedTool(ctx, sam, "Hedge trimmer", "garden", "worn");
    await seedTool(ctx, lee, "Stand mixer", "kitchen", "new");

    let added = 0;
    // Overdue: approved, ended three days ago, tool still out.
    added += await seedLoan(ctx, ladder, lee, day(-10), day(-3), "approved");
    // Pending request waiting on Maya.
    added += await seedLoan(ctx, drill, sam, day(2), day(4), "pending");
    // Past loan, returned.
    added += await seedLoan(ctx, tent, maya, day(-20), day(-15), "returned");
    return { added };
  },
});

async function seedUser(ctx: MutationCtx, slug: string, name: string, trusted: boolean) {
  const tokenIdentifier = `seed|${slug}`;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("users", {
    tokenIdentifier,
    name,
    email: `${slug}@example.com`,
    role: "user",
    trusted,
  });
}

async function seedTool(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  name: string,
  category: "power_tools" | "hand_tools" | "garden" | "kitchen" | "camping",
  condition: "new" | "good" | "fair" | "worn",
) {
  const owned = await ctx.db
    .query("tools")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .take(50);
  const existing = owned.find((tool) => tool.name === name);
  if (existing) return existing._id;
  return await ctx.db.insert("tools", {
    ownerId,
    name,
    category,
    condition,
    description: "Demo listing",
  });
}

/** Inserts directly, bypassing request rules, so past dates are allowed. Returns 1 if added. */
async function seedLoan(
  ctx: MutationCtx,
  toolId: Id<"tools">,
  borrowerId: Id<"users">,
  startDate: string,
  endDate: string,
  status: "pending" | "approved" | "returned",
) {
  const tool = await ctx.db.get("tools", toolId);
  if (!tool) return 0;
  const existing = await ctx.db
    .query("loans")
    .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .take(50);
  if (existing.some((loan) => loan.borrowerId === borrowerId)) return 0;
  const loanId = await ctx.db.insert("loans", {
    toolId,
    toolName: tool.name,
    ownerId: tool.ownerId,
    borrowerId,
    startDate,
    endDate,
    status,
  });
  if (status === "approved") await ctx.db.patch("tools", toolId, { activeLoanId: loanId });
  return 1;
}

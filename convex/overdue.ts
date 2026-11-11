import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { daysBetween } from "./lib/rules";

const vOverdueLoan = v.object({
  loanId: v.id("loans"),
  toolName: v.string(),
  endDate: v.string(),
  daysOverdue: v.number(),
  borrower: v.object({ name: v.string(), email: v.string() }),
  ownerName: v.string(),
});

export const reminderKey = (loanId: string, date: string) => `reminder:${loanId}:${date}`;

/**
 * Approved loans past their end date that have not been reminded on `today`.
 * `today` comes from the HTTP action, so this query stays deterministic.
 */
export const listForReminder = internalQuery({
  args: { today: v.string() },
  returns: v.array(vOverdueLoan),
  handler: async (ctx, { today }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_and_endDate", (q) => q.eq("status", "approved").lt("endDate", today))
      .take(100);
    const result = [];
    for (const loan of loans) {
      const reminded = await ctx.db
        .query("automationEvents")
        .withIndex("by_key", (q) => q.eq("key", reminderKey(loan._id, today)))
        .unique();
      if (reminded?.status === "sent") continue;
      const [borrower, owner] = await Promise.all([
        ctx.db.get("users", loan.borrowerId),
        ctx.db.get("users", loan.ownerId),
      ]);
      if (!borrower) continue;
      result.push({
        loanId: loan._id,
        toolName: loan.toolName,
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, today),
        borrower: { name: borrower.name, email: borrower.email },
        ownerName: owner?.name ?? "A former neighbor",
      });
    }
    return result;
  },
});

/**
 * n8n reports a reminder it sent (or failed to send). Keyed by loan and date:
 * a repeat for the same day is a no-op, unless it upgrades "failed" to "sent".
 */
export const recordReminder = internalMutation({
  args: {
    loanId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.string(),
    today: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), duplicate: v.boolean() }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { loanId: rawId, status, detail, today }) => {
    const loanId = ctx.db.normalizeId("loans", rawId);
    const loan = loanId && (await ctx.db.get("loans", loanId));
    if (!loanId || !loan) return { ok: false as const, error: "Unknown loan" };

    const key = reminderKey(loanId, today);
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      if (existing.status === "failed" && status === "sent") {
        await ctx.db.patch("automationEvents", existing._id, { status, detail });
      }
      return { ok: true as const, duplicate: true };
    }
    await ctx.db.insert("automationEvents", { loanId, kind: "reminder", status, key, detail });
    return { ok: true as const, duplicate: false };
  },
});

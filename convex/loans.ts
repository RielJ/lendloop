import { ConvexError, v } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "@/convex/_generated/server";
import { latestActivity, vActivity } from "@/convex/automation";
import { requireAdmin, requireUser } from "@/convex/lib/auth";
import {
  canDecide,
  canMarkReturned,
  canRequestTool,
  todayUtc,
  validateLoanDates,
} from "@/convex/lib/rules";
import { notifyLoan } from "@/convex/notify";
import { vLoanStatus } from "@/convex/schema";

/**
 * A loan as one party sees it: the other party's display name only, no email.
 * Overdue is derived in the UI from endDate: Convex caches query results, so a
 * Date.now()-based flag computed here would go stale when the date changes.
 */
const vLoanView = v.object({
  _id: v.id("loans"),
  _creationTime: v.number(),
  toolId: v.id("tools"),
  toolName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  status: vLoanStatus,
  otherParty: v.string(),
  activity: vActivity,
});

async function toView(ctx: QueryCtx, loan: Doc<"loans">, side: "owner" | "borrower") {
  const other = await ctx.db.get("users", side === "owner" ? loan.borrowerId : loan.ownerId);
  return {
    _id: loan._id,
    _creationTime: loan._creationTime,
    toolId: loan.toolId,
    toolName: loan.toolName,
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    otherParty: other?.name ?? "Former neighbor",
    activity: await latestActivity(ctx, loan._id),
  };
}

async function getLoan(ctx: MutationCtx, loanId: Doc<"loans">["_id"]) {
  const loan = await ctx.db.get("loans", loanId);
  if (!loan) throw new ConvexError("Request not found");
  return loan;
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  returns: v.id("loans"),
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (!canRequestTool(user, tool)) {
      throw new ConvexError(
        tool.ownerId === user._id ? "You can't borrow your own tool" : "This tool is on loan",
      );
    }
    const error = validateLoanDates(startDate, endDate, todayUtc());
    if (error) throw new ConvexError(error);

    const pending = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .take(100);
    if (pending.some((loan) => loan.borrowerId === user._id)) {
      throw new ConvexError("You already have a pending request for this tool");
    }

    const loanId = await ctx.db.insert("loans", {
      toolId,
      toolName: tool.name,
      ownerId: tool.ownerId,
      borrowerId: user._id,
      startDate,
      endDate,
      status: "pending",
    });
    await notifyLoan(ctx, loanId, "requested");
    return loanId;
  },
});

/** Owner approves. The tool goes on loan and other pending requests for it are declined. */
export const approve = mutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await getLoan(ctx, loanId);
    if (!canDecide(user, loan))
      throw new ConvexError("Only the owner can approve a pending request");
    const tool = await ctx.db.get("tools", loan.toolId);
    if (!tool) throw new ConvexError("This tool was removed");
    if (tool.activeLoanId) throw new ConvexError("This tool is already on loan");

    await ctx.db.patch("loans", loanId, { status: "approved" });
    await ctx.db.patch("tools", tool._id, { activeLoanId: loanId });

    const others = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", tool._id).eq("status", "pending"))
      .take(100);
    for (const other of others) {
      await ctx.db.patch("loans", other._id, { status: "declined" });
      await notifyLoan(ctx, other._id, "declined");
    }
    await notifyLoan(ctx, loanId, "approved");
    return null;
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await getLoan(ctx, loanId);
    if (!canDecide(user, loan))
      throw new ConvexError("Only the owner can decline a pending request");
    await ctx.db.patch("loans", loanId, { status: "declined" });
    await notifyLoan(ctx, loanId, "declined");
    return null;
  },
});

/** Owner confirms the tool is back. The tool becomes available again. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await getLoan(ctx, loanId);
    if (!canMarkReturned(user, loan)) {
      throw new ConvexError("Only the owner can mark an approved loan returned");
    }
    await ctx.db.patch("loans", loanId, { status: "returned" });
    const tool = await ctx.db.get("tools", loan.toolId);
    if (tool?.activeLoanId === loanId) {
      await ctx.db.patch("tools", tool._id, { activeLoanId: undefined });
    }
    await notifyLoan(ctx, loanId, "returned");
    return null;
  },
});

/** Requests the caller made as a borrower. */
export const mine = query({
  args: {},
  returns: v.array(vLoanView),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((loan) => toView(ctx, loan, "borrower")));
  },
});

/** Requests for the caller's tools. */
export const incoming = query({
  args: {},
  returns: v.array(vLoanView),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((loan) => toView(ctx, loan, "owner")));
  },
});

/** Admin only: every loan with both parties' names, newest first. */
export const all = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("loans"),
      _creationTime: v.number(),
      toolName: v.string(),
      owner: v.string(),
      borrower: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      status: vLoanStatus,
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(200);
    return await Promise.all(
      loans.map(async (loan) => {
        const [owner, borrower] = await Promise.all([
          ctx.db.get("users", loan.ownerId),
          ctx.db.get("users", loan.borrowerId),
        ]);
        return {
          _id: loan._id,
          _creationTime: loan._creationTime,
          toolName: loan.toolName,
          owner: owner?.name ?? "Former neighbor",
          borrower: borrower?.name ?? "Former neighbor",
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
        };
      }),
    );
  },
});

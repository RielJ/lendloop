import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Keep in sync with CATEGORIES / CONDITIONS in lib/constants.ts (tests/constants.test.ts checks this).
export const vCategory = v.union(
  v.literal("power_tools"),
  v.literal("hand_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("other"),
);
export const vCondition = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
export const vLoanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);
export const vLoanEvent = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    trusted: v.boolean(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
    /** Set while a loan is approved and not yet returned. Unset means available. */
    activeLoanId: v.optional(v.id("loans")),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_category", ["category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    /** Snapshot so loan history survives the tool being removed. */
    toolName: v.string(),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    /** UTC dates as YYYY-MM-DD; they compare correctly as strings. */
    startDate: v.string(),
    endDate: v.string(),
    status: vLoanStatus,
  })
    .index("by_toolId_and_status", ["toolId", "status"])
    .index("by_ownerId", ["ownerId"])
    .index("by_borrowerId", ["borrowerId"])
    .index("by_status_and_endDate", ["status", "endDate"]),

  /** What n8n did for a loan. `key` makes writes idempotent. */
  automationEvents: defineTable({
    loanId: v.id("loans"),
    kind: v.union(v.literal("notification"), v.literal("reminder")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    key: v.string(),
    detail: v.string(),
  })
    .index("by_key", ["key"])
    .index("by_loanId", ["loanId"]),
});

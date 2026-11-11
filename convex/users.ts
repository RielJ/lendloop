import { ConvexError, v } from "convex/values";
import { env, mutation, query } from "./_generated/server";
import { getUser, requireAdmin } from "./lib/auth";

const vRole = v.union(v.literal("admin"), v.literal("user"));

function adminEmails(): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Create or refresh the caller's user row from their Clerk identity.
 * The role comes only from the server-side ADMIN_EMAILS allowlist, never from the client.
 */
export const store = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Please sign in");

    const email = (identity.email ?? "").toLowerCase();
    const name = identity.name ?? identity.nickname ?? email.split("@")[0] ?? "Neighbor";
    const role = email && adminEmails().has(email) ? "admin" : "user";

    const existing = await getUser(ctx);
    if (existing) {
      if (existing.name !== name || existing.email !== email || existing.role !== role) {
        await ctx.db.patch("users", existing._id, { name, email, role });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      role,
      trusted: false,
    });
  },
});

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("users"), name: v.string(), role: vRole, trusted: v.boolean() }),
  ),
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return null;
    return { _id: user._id, name: user.name, role: user.role, trusted: user.trusted };
  },
});

/** Admin only. Includes emails so an admin can tell neighbors apart. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: vRole,
      trusted: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(200);
    return users.map(({ _id, name, email, role, trusted }) => ({
      _id,
      name,
      email,
      role,
      trusted,
    }));
  },
});

/** Admin only: mark or unmark a lender as a Trusted Lender. */
export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("User not found");
    await ctx.db.patch("users", userId, { trusted });
    return null;
  },
});

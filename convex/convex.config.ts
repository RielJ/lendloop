import { defineApp } from "convex/server";
import { v } from "convex/values";

/** Server-side environment for this deployment. Set with `bunx convex env set NAME value`. */
const app = defineApp({
  env: {
    /** Comma-separated emails that get the admin role on sign-in. */
    ADMIN_EMAILS: v.optional(v.string()),
    /** n8n Webhook node URL for loan events. */
    N8N_WEBHOOK_URL: v.optional(v.string()),
    /** Shared HMAC secret for both directions of the n8n integration. */
    LENDLOOP_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

export default app;

import type { AuthConfig } from "convex/server";

// Clerk issues the JWTs. CLERK_JWT_ISSUER_DOMAIN is the Clerk Frontend API URL
// (e.g. https://your-app.clerk.accounts.dev); set it with `bunx convex env set`.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

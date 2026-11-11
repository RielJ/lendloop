"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** Creates or refreshes the caller's Convex user row once Clerk auth reaches Convex. */
export function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);

  useEffect(() => {
    if (isAuthenticated) void store();
  }, [isAuthenticated, store]);

  return null;
}

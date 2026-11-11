"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";

/** Creates or refreshes the caller's Convex user row once Clerk auth reaches Convex. */
export function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);

  useEffect(() => {
    if (!isAuthenticated) return;
    // A setup problem (e.g. no email claim) would otherwise leave the dashboard loading forever.
    store().catch((error: unknown) =>
      toast.error(errorMessage(error), { id: "ensure-user", duration: Infinity }),
    );
  }, [isAuthenticated, store]);

  return null;
}

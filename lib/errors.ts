import { ConvexError } from "convex/values";

/** User-facing message for a failed Convex call. Server rule messages pass through. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Please try again.";
}

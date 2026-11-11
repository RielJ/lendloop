import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction, internalQuery, type MutationCtx } from "./_generated/server";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from "./lib/hmac";

export const vLoanEvent = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);
type LoanEvent = typeof vLoanEvent.type;

/** Delay before retry 1, 2 and 3. After the last one the event is recorded as failed. */
const BACKOFF_SECONDS = [30, 60, 120];
const TIMEOUT_MS = 10_000;

/** Call from a mutation after a loan changes state. Runs after the mutation commits. */
export async function notifyLoan(ctx: MutationCtx, loanId: Id<"loans">, event: LoanEvent) {
  await ctx.scheduler.runAfter(0, internal.notify.sendLoanEvent, { loanId, event, attempt: 0 });
}

const vPayload = v.object({
  event: vLoanEvent,
  loanId: v.id("loans"),
  toolName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  status: v.string(),
  recipient: v.object({ name: v.string(), email: v.string() }),
  otherPartyName: v.string(),
});

/**
 * The minimum n8n needs to write one message: who gets it, the tool, the dates
 * and the status. The owner hears about new requests; the borrower hears the rest.
 */
export const payload = internalQuery({
  args: { loanId: v.id("loans"), event: vLoanEvent },
  returns: v.union(v.null(), vPayload),
  handler: async (ctx, { loanId, event }) => {
    const loan = await ctx.db.get("loans", loanId);
    if (!loan) return null;
    const toOwner = event === "requested";
    const [recipient, other] = await Promise.all([
      ctx.db.get("users", toOwner ? loan.ownerId : loan.borrowerId),
      ctx.db.get("users", toOwner ? loan.borrowerId : loan.ownerId),
    ]);
    if (!recipient) return null;
    return {
      event,
      loanId,
      toolName: loan.toolName,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      recipient: { name: recipient.name, email: recipient.email },
      otherPartyName: other?.name ?? "A former neighbor",
    };
  },
});

/** Signed POST to the n8n webhook, retried with backoff, outcome recorded per loan. */
export const sendLoanEvent = internalAction({
  args: { loanId: v.id("loans"), event: vLoanEvent, attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, { loanId, event, attempt }) => {
    const key = `notification:${loanId}:${event}`;
    const record = (status: "sent" | "failed", detail: string) =>
      ctx.runMutation(internal.automation.record, {
        loanId,
        kind: "notification",
        status,
        key,
        detail,
      });

    const data = await ctx.runQuery(internal.notify.payload, { loanId, event });
    if (!data) return null;
    const url = env.N8N_WEBHOOK_URL;
    const secret = env.LENDLOOP_WEBHOOK_SECRET;
    if (!url || !secret) {
      await record("failed", "Notifications are not configured");
      return null;
    }

    // n8n verifies the signature over these exact bytes, so sign and send the same string.
    const body = JSON.stringify({ key, ...data });
    const timestamp = String(Math.floor(Date.now() / 1000));
    let detail: string;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: await sign(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) {
        await record("sent", `Notified ${data.recipient.name} (${event})`);
        return null;
      }
      detail = `n8n responded ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : "Network error";
    }

    const delay = BACKOFF_SECONDS[attempt];
    if (delay === undefined) {
      await record("failed", `Gave up after ${attempt + 1} attempts: ${detail}`);
      return null;
    }
    await ctx.scheduler.runAfter(delay * 1000, internal.notify.sendLoanEvent, {
      loanId,
      event,
      attempt: attempt + 1,
    });
    return null;
  },
});

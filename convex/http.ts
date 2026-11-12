import { httpRouter } from "convex/server";
import { internal } from "@/convex/_generated/api";
import { env, httpAction } from "@/convex/_generated/server";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "@/convex/lib/hmac";
import { todayUtc } from "@/convex/lib/rules";

/**
 * Endpoints n8n calls. Every request must carry an HMAC signature over
 * `${timestamp}.${rawBody}` (empty body for GET) made with LENDLOOP_WEBHOOK_SECRET.
 */
const http = httpRouter();

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const isSigned = (req: Request, body: string) =>
  verify({
    secret: env.LENDLOOP_WEBHOOK_SECRET,
    timestamp: req.headers.get(TIMESTAMP_HEADER),
    signature: req.headers.get(SIGNATURE_HEADER),
    body,
  });

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!(await isSigned(req, ""))) return json(401, { error: "Invalid signature" });
    const today = todayUtc();
    const loans = await ctx.runQuery(internal.overdue.listForReminder, { today });
    return json(200, { date: today, loans });
  }),
});

http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    if (!(await isSigned(req, body))) return json(401, { error: "Invalid signature" });

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return json(400, { error: "Body must be JSON" });
    }
    if (typeof data !== "object" || data === null) {
      return json(400, { error: "Body must be an object" });
    }
    const fields = new Map(Object.entries(data));
    const loanId = fields.get("loanId");
    const status = fields.get("status");
    const detail = fields.get("detail");
    if (typeof loanId !== "string" || (status !== "sent" && status !== "failed")) {
      return json(400, { error: 'Expected { loanId: string, status: "sent" | "failed" }' });
    }

    const result = await ctx.runMutation(internal.overdue.recordReminder, {
      loanId,
      status,
      detail: typeof detail === "string" ? detail.slice(0, 500) : `Reminder ${status}`,
      today: todayUtc(),
    });
    return result.ok ? json(200, result) : json(404, result);
  }),
});

export default http;

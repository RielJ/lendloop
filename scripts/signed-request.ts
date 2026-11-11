/**
 * Calls a LendLoop n8n endpoint with a valid HMAC signature, the way n8n does.
 *
 *   bun scripts/signed-request.ts GET /n8n/overdue-loans
 *   bun scripts/signed-request.ts POST /n8n/reminders '{"loanId":"...","status":"sent"}'
 *
 * Reads NEXT_PUBLIC_CONVEX_SITE_URL and LENDLOOP_WEBHOOK_SECRET from .env.local (Bun loads it).
 * Pass --unsigned to check that the endpoint rejects the request.
 */
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from "../convex/lib/hmac";

const args = process.argv.slice(2);
const unsigned = args.includes("--unsigned");
const [method = "GET", path = "/n8n/overdue-loans", body = ""] = args.filter(
  (arg) => arg !== "--unsigned",
);
const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const secret = process.env.LENDLOOP_WEBHOOK_SECRET;
if (!site || !secret) {
  console.error("Set NEXT_PUBLIC_CONVEX_SITE_URL and LENDLOOP_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

const timestamp = String(Math.floor(Date.now() / 1000));
const headers: Record<string, string> = { "content-type": "application/json" };
if (!unsigned) {
  headers[TIMESTAMP_HEADER] = timestamp;
  headers[SIGNATURE_HEADER] = await sign(secret, timestamp, body);
}
const response = await fetch(new URL(path, site), {
  method,
  headers,
  body: method === "GET" ? undefined : body,
});
console.log(response.status, await response.text());

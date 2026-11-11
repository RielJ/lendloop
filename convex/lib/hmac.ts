/**
 * HMAC-SHA256 signing shared by both directions of the Convex <-> n8n integration.
 *
 *   message   = `${timestamp}.${rawBody}`   (rawBody is "" for GET requests)
 *   signature = "sha256=" + hex(HMAC_SHA256(secret, message))
 *
 * Uses Web Crypto only, so it runs in the Convex runtime and in Bun tests.
 * The n8n Code nodes compute the same value with node:crypto (see tests/hmac.test.ts).
 */

export const SIGNATURE_HEADER = "x-lendloop-signature";
export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
const MAX_SKEW_SECONDS = 300;

const encoder = new TextEncoder();

export async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verify(args: {
  secret: string | undefined;
  timestamp: string | null;
  body: string;
  signature: string | null;
  nowMs?: number;
}): Promise<boolean> {
  const { secret, timestamp, body, signature, nowMs = Date.now() } = args;
  if (!secret || !timestamp || !signature) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  return constantTimeEqual(signature, await sign(secret, timestamp, body));
}

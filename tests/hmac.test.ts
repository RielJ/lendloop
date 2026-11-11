import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { sign, verify } from "@/convex/lib/hmac";

const SECRET = "test-secret";
const NOW_MS = 1_800_000_000_000;
const TS = String(NOW_MS / 1000);
const BODY = '{"loanId":"abc","date":"2026-11-12"}';

describe("hmac", () => {
  test("round trip verifies", async () => {
    const sig = await sign(SECRET, TS, BODY);
    expect(
      await verify({ secret: SECRET, timestamp: TS, body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(true);
  });

  test("matches node:crypto, which the n8n Code nodes use", async () => {
    const expected = "sha256=" + createHmac("sha256", SECRET).update(`${TS}.${BODY}`).digest("hex");
    expect(await sign(SECRET, TS, BODY)).toBe(expected);
  });

  test("rejects a tampered body", async () => {
    const sig = await sign(SECRET, TS, BODY);
    expect(
      await verify({
        secret: SECRET,
        timestamp: TS,
        body: BODY + " ",
        signature: sig,
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  test("rejects a different secret", async () => {
    const sig = await sign("other", TS, BODY);
    expect(
      await verify({ secret: SECRET, timestamp: TS, body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(false);
  });

  test("rejects a timestamp outside the 5 minute window", async () => {
    const old = String(NOW_MS / 1000 - 301);
    const sig = await sign(SECRET, old, BODY);
    expect(
      await verify({ secret: SECRET, timestamp: old, body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(false);
  });

  test("rejects missing headers, bad timestamps and an empty secret", async () => {
    const sig = await sign(SECRET, TS, BODY);
    expect(
      await verify({ secret: SECRET, timestamp: null, body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(false);
    expect(
      await verify({ secret: SECRET, timestamp: TS, body: BODY, signature: null, nowMs: NOW_MS }),
    ).toBe(false);
    expect(
      await verify({ secret: SECRET, timestamp: "abc", body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(false);
    expect(
      await verify({
        secret: "",
        timestamp: TS,
        body: BODY,
        signature: "sha256=00",
        nowMs: NOW_MS,
      }),
    ).toBe(false);
    expect(
      await verify({ secret: undefined, timestamp: TS, body: BODY, signature: sig, nowMs: NOW_MS }),
    ).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { timeAgo } from "@/lib/time";

const now = Date.parse("2026-11-12T12:00:00Z");
const ago = (ms: number) => timeAgo(now - ms, now);

describe("timeAgo", () => {
  test("rounds down to the largest whole unit", () => {
    expect(ago(10_000)).toBe("just now");
    expect(ago(5 * 60_000)).toBe("5 minutes ago");
    expect(ago(60 * 60_000)).toBe("1 hour ago");
    expect(ago(2 * 86_400_000 + 3_600_000)).toBe("2 days ago");
    expect(ago(86_400_000)).toBe("yesterday");
  });

  test("treats a timestamp slightly in the future as now", () => {
    expect(ago(-5_000)).toBe("just now");
  });
});

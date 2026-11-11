import { describe, expect, test } from "bun:test";
import { profileFromIdentity as check } from "@/convex/lib/rules";

/** Unwraps the profile, failing the test if the identity was rejected. */
function profileFromIdentity(...args: Parameters<typeof check>) {
  const result = check(...args);
  if (!result.ok) throw new Error(result.error);
  return result.profile;
}

const admins = "Admin@Example.com, other@example.com";

describe("profileFromIdentity", () => {
  test("grants admin only for an allowlisted email, case-insensitively", () => {
    expect(profileFromIdentity({ email: "admin@example.com", name: "Ada" }, admins)).toEqual({
      email: "admin@example.com",
      name: "Ada",
      role: "admin",
    });
    expect(profileFromIdentity({ email: "bob@example.com", name: "Bob" }, admins).role).toBe(
      "user",
    );
    expect(profileFromIdentity({ email: "bob@example.com" }, undefined).role).toBe("user");
  });

  test("falls back to nickname, then the email's local part, for the name", () => {
    expect(profileFromIdentity({ email: "cy@example.com", nickname: "cyc" }, "").name).toBe("cyc");
    expect(profileFromIdentity({ email: "cy@example.com", name: "" }, "").name).toBe("cy");
  });

  test("rejects a token without an email, so admin and notifications never break silently", () => {
    for (const identity of [{ name: "Ada" }, { email: "" }]) {
      const result = check(identity, admins);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/email claim/);
    }
  });
});

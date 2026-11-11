import { describe, expect, test } from "bun:test";
import {
  canDecide,
  canEditTool,
  canMarkReturned,
  canRemoveTool,
  canRequestTool,
  daysBetween,
  isOverdue,
  validateLoanDates,
  validateToolInput,
} from "@/convex/lib/rules";

const owner = { _id: "u1", role: "user" as const };
const stranger = { _id: "u2", role: "user" as const };
const admin = { _id: "u3", role: "admin" as const };
const tool = { ownerId: "u1" };
const toolOnLoan = { ownerId: "u1", activeLoanId: "l1" };

describe("tool rules", () => {
  test("only the owner edits a tool, not even an admin", () => {
    expect(canEditTool(owner, tool)).toBe(true);
    expect(canEditTool(stranger, tool)).toBe(false);
    expect(canEditTool(admin, tool)).toBe(false);
  });

  test("owner removes an idle tool; admin removes any tool", () => {
    expect(canRemoveTool(owner, tool)).toBe(true);
    expect(canRemoveTool(owner, toolOnLoan)).toBe(false);
    expect(canRemoveTool(stranger, tool)).toBe(false);
    expect(canRemoveTool(admin, toolOnLoan)).toBe(true);
  });

  test("nobody requests their own tool or one already on loan", () => {
    expect(canRequestTool(stranger, tool)).toBe(true);
    expect(canRequestTool(owner, tool)).toBe(false);
    expect(canRequestTool(stranger, toolOnLoan)).toBe(false);
  });
});

describe("loan rules", () => {
  const pending = { ownerId: "u1", status: "pending" as const };
  const approved = { ownerId: "u1", status: "approved" as const };

  test("only the owner decides, and only while pending", () => {
    expect(canDecide(owner, pending)).toBe(true);
    expect(canDecide(stranger, pending)).toBe(false);
    expect(canDecide(admin, pending)).toBe(false);
    expect(canDecide(owner, approved)).toBe(false);
  });

  test("only the owner marks an approved loan returned", () => {
    expect(canMarkReturned(owner, approved)).toBe(true);
    expect(canMarkReturned(owner, pending)).toBe(false);
    expect(canMarkReturned(stranger, approved)).toBe(false);
  });
});

describe("validation", () => {
  const today = "2026-11-12";

  test("loan dates", () => {
    expect(validateLoanDates("2026-11-12", "2026-11-14", today)).toBeNull();
    expect(validateLoanDates("2026-11-11", "2026-11-14", today)).toMatch(/past/);
    expect(validateLoanDates("2026-11-14", "2026-11-12", today)).toMatch(/after/);
    expect(validateLoanDates("2026-11-12", "2026-12-31", today)).toMatch(/30 days/);
    expect(validateLoanDates("12/11/2026", "2026-11-14", today)).toMatch(/format/);
    expect(validateLoanDates("2026-02-30", "2026-03-01", today)).toMatch(/format/);
  });

  test("tool input", () => {
    expect(validateToolInput({ name: "Drill", description: "18V" })).toBeNull();
    expect(validateToolInput({ name: "   ", description: "" })).toMatch(/name/i);
    expect(validateToolInput({ name: "x".repeat(81), description: "" })).toMatch(/name/i);
    expect(validateToolInput({ name: "Drill", description: "x".repeat(281) })).toMatch(
      /description/i,
    );
  });

  test("overdue only when approved and past the end date", () => {
    expect(isOverdue({ status: "approved", endDate: "2026-11-11" }, "2026-11-12")).toBe(true);
    expect(isOverdue({ status: "approved", endDate: "2026-11-12" }, "2026-11-12")).toBe(false);
    expect(isOverdue({ status: "returned", endDate: "2026-11-01" }, "2026-11-12")).toBe(false);
    expect(isOverdue({ status: "pending", endDate: "2026-11-01" }, "2026-11-12")).toBe(false);
  });

  test("daysBetween", () => {
    expect(daysBetween("2026-11-09", "2026-11-12")).toBe(3);
  });
});

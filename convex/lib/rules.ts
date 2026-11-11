/**
 * Pure authorization and validation rules. Every Convex mutation calls these;
 * the UI only mirrors them for convenience. No Convex imports, so `bun test`
 * covers them without a deployment.
 */

type Actor = { _id: string; role: "admin" | "user" };
type LoanStatus = "pending" | "approved" | "declined" | "returned";

export const isAdmin = (actor: Actor) => actor.role === "admin";

/** Editing a listing is the owner's call only. Admins remove, they don't rewrite. */
export const canEditTool = (actor: Actor, tool: { ownerId: string }) => tool.ownerId === actor._id;

/** Owners remove idle tools. Admins remove any listing, even one on loan. */
export const canRemoveTool = (actor: Actor, tool: { ownerId: string; activeLoanId?: string }) =>
  isAdmin(actor) || (tool.ownerId === actor._id && !tool.activeLoanId);

export const canRequestTool = (actor: Actor, tool: { ownerId: string; activeLoanId?: string }) =>
  tool.ownerId !== actor._id && !tool.activeLoanId;

export const canDecide = (actor: Actor, loan: { ownerId: string; status: LoanStatus }) =>
  loan.ownerId === actor._id && loan.status === "pending";

export const canMarkReturned = (actor: Actor, loan: { ownerId: string; status: LoanStatus }) =>
  loan.ownerId === actor._id && loan.status === "approved";

export const isOverdue = (loan: { status: LoanStatus; endDate: string }, today: string) =>
  loan.status === "approved" && loan.endDate < today;

const DAY_MS = 86_400_000;
const MAX_LOAN_DAYS = 30;

/** Today as a UTC `YYYY-MM-DD` string. Dates compare correctly as strings. */
export const todayUtc = (nowMs = Date.now()) => new Date(nowMs).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Returns an error message, or null when the range is valid. */
export function validateLoanDates(start: string, end: string, today: string): string | null {
  if (!isIsoDate(start) || !isIsoDate(end)) return "Dates must use the YYYY-MM-DD format";
  if (start < today) return "The start date is in the past";
  if (end < start) return "The end date must be on or after the start date";
  if (daysBetween(start, end) > MAX_LOAN_DAYS)
    return `Loans can last at most ${MAX_LOAN_DAYS} days`;
  return null;
}

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 280;

/** Returns an error message, or null when the input is valid. */
export function validateToolInput(input: { name: string; description: string }): string | null {
  const name = input.name.trim();
  if (name.length === 0 || name.length > NAME_MAX)
    return `Name must be 1 to ${NAME_MAX} characters`;
  if (input.description.trim().length > DESCRIPTION_MAX)
    return `Description must be at most ${DESCRIPTION_MAX} characters`;
  return null;
}

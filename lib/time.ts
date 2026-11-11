const UNITS = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
] as const;

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "5 minutes ago", "yesterday", "2 days ago". Anything under a minute is "just now". */
export function timeAgo(at: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - at);
  for (const [unit, ms] of UNITS) {
    const count = Math.floor(elapsed / ms);
    if (count >= 1) return format.format(-count, unit);
  }
  return "just now";
}

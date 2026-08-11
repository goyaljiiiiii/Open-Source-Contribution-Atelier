import { format, formatDistanceToNow } from "date-fns";

export { format, formatDistanceToNow };

/**
 * Safely parses a date input and returns a valid Date object or null.
 */
function safeParseDate(date: Date | number | string | null | undefined): Date | null {
  if (date == null) return null;
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return d;
}

export function formatTimeAgo(date: Date | number | string): string {
  const d = safeParseDate(date);
  if (!d) return "N/A";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatInTimeZone(
  date: Date | number | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  }
): string {
  const d = safeParseDate(date);
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(d);
}

import { format, formatDistanceToNow } from "date-fns";

export { format, formatDistanceToNow };

export function formatTimeAgo(date: Date | number | string): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
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
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(d);
}

import { format, formatDistanceToNow } from "date-fns";

export function formatDate(
  date: Date | number | string,
  formatStr: string = "PPP"
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return format(d, formatStr);
}

export function formatDateTime(
  date: Date | number | string,
  timeZone?: string
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (timeZone) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(d);
  }
  return format(d, "PPpp");
}

export function formatRelativeTime(date: Date | number | string): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Dates as a person in a given time zone sees them. */

export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const safeTimeZone = (value: unknown) =>
  isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;

/** The clock on the wall in that zone, as YYYY-MM-DDTHH:mm:ss. */
export function wallClockInZone(moment: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(moment);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

/** The calendar date in that zone, which can differ from the date in UTC. */
export const dateInZone = (moment: Date, timeZone: string) =>
  wallClockInZone(moment, timeZone).slice(0, 10);

/** Hours from one wall-clock time to another. Both are read the same way, so zones cancel out. */
export function hoursBetween(from: string, to: string): number {
  return (Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 3_600_000;
}

export type CalendarEventKind = "interview" | "reminder" | "deadline" | "applied";

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  kind: CalendarEventKind;
  title: string;
  href: string;
};

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
};

export type CalendarMonth = {
  month: string;
  label: string;
  previous: string;
  next: string;
  weeks: CalendarDay[][];
};

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Falls back to the current month for anything unrecognised in the address. */
export function parseMonth(value: unknown, today: string): string {
  return typeof value === "string" && MONTH.test(value) ? value : today.slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  return iso(new Date(Date.UTC(year, index - 1 + by, 1))).slice(0, 7);
}

/** The first and last dates shown, which run into the months either side. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const last = new Date(Date.UTC(year, index, 0));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  return { start: iso(start), end: iso(end) };
}

/** Weeks start on Monday. */
export function buildMonth(month: string, events: CalendarEvent[], today: string): CalendarMonth {
  const { start, end } = monthRange(month);

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date);
    if (list) list.push(event);
    else byDate.set(event.date, [event]);
  }

  const days: CalendarDay[] = [];
  for (
    const date = new Date(`${start}T00:00:00Z`);
    iso(date) <= end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = iso(date);
    days.push({
      date: day,
      inMonth: day.startsWith(month),
      isToday: day === today,
      events: (byDate.get(day) ?? []).toSorted((a, b) =>
        (a.time || "99").localeCompare(b.time || "99"),
      ),
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return {
    month,
    label: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`)),
    previous: shiftMonth(month, -1),
    next: shiftMonth(month, 1),
    weeks,
  };
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export type ReminderState = "overdue" | "today" | "upcoming";

export function reminderState(dueOn: string, today: string): ReminderState {
  if (dueOn < today) return "overdue";
  return dueOn === today ? "today" : "upcoming";
}

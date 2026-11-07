import type { ApplicationStatus } from "@/lib/applications/status";

type StatsApplication = {
  id: string;
  status: ApplicationStatus;
  applied_at: string | null;
};

type StatsEvent = {
  application_id: string;
  kind: string;
  to_status: ApplicationStatus | null;
  created_at: string;
};

export type WeekCount = { week: string; count: number };

export type ApplicationStats = {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  /** Everything that was sent, including what has since moved on. */
  applied: number;
  responded: number;
  interviewed: number;
  offers: number;
  rejected: number;
  /** Null when nothing has been sent, which is different from a rate of zero. */
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  /** Middle value of the days between applying and the first reply. */
  medianDaysToResponse: number | null;
  weekly: WeekCount[];
};

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 100);

const DAY = 24 * 60 * 60 * 1000;
const WEEKS_SHOWN = 8;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The Monday of the week holding this date. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const fromMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - fromMonday * DAY).toISOString().slice(0, 10);
}

/**
 * Counts each application once per stage it ever reached, using its history, so a
 * rejection after an interview still counts as an interview. A reply means the
 * employer did something: any stage after Applied, including a rejection.
 */
export function applicationStats(
  applications: StatsApplication[],
  events: StatsEvent[],
  today: string,
): ApplicationStats {
  const byStatus: Record<ApplicationStatus, number> = {
    saved: 0,
    applied: 0,
    assessment: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };

  const history = new Map<string, StatsEvent[]>();
  for (const event of events) {
    const list = history.get(event.application_id);
    if (list) list.push(event);
    else history.set(event.application_id, [event]);
  }

  let applied = 0;
  let responded = 0;
  let interviewed = 0;
  let offers = 0;
  let rejected = 0;
  const responseDays: number[] = [];
  const weeks = new Map<string, number>();

  for (const application of applications) {
    byStatus[application.status] += 1;
    if (application.status === "saved" || !application.applied_at) continue;

    applied += 1;
    const week = weekStart(application.applied_at);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);

    const own = (history.get(application.id) ?? []).toSorted((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const reached = new Set<ApplicationStatus>([application.status]);
    for (const event of own) if (event.to_status) reached.add(event.to_status);

    const replied = ["assessment", "interview", "offer", "rejected"] as const;
    if (replied.some((status) => reached.has(status))) responded += 1;
    if (reached.has("interview")) interviewed += 1;
    if (reached.has("offer")) offers += 1;
    if (application.status === "rejected") rejected += 1;

    // Only a real move counts. An application added at a later stage has a
    // "created" record, which says nothing about when the employer replied.
    const reply = own.find(
      (event) =>
        event.kind === "status_changed" &&
        event.to_status &&
        (replied as readonly string[]).includes(event.to_status),
    );
    if (reply) {
      const sent = new Date(`${application.applied_at}T00:00:00Z`).getTime();
      const days = Math.floor((new Date(reply.created_at).getTime() - sent) / DAY);
      // Logged after the fact, an application can show a reply before its date.
      if (days >= 0) responseDays.push(days);
    }
  }

  const thisWeek = new Date(`${weekStart(today)}T00:00:00Z`).getTime();
  const weekly = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const offset = WEEKS_SHOWN - 1 - index;
    const week = new Date(thisWeek - offset * 7 * DAY).toISOString().slice(0, 10);
    return { week, count: weeks.get(week) ?? 0 };
  });

  return {
    total: applications.length,
    byStatus,
    applied,
    responded,
    interviewed,
    offers,
    rejected,
    responseRate: percent(responded, applied),
    interviewRate: percent(interviewed, applied),
    offerRate: percent(offers, applied),
    medianDaysToResponse: median(responseDays),
    weekly,
  };
}

import { describe, expect, it } from "vitest";

import {
  addDays,
  buildMonth,
  monthRange,
  parseMonth,
  reminderState,
  type CalendarEvent,
} from "@/lib/applications/calendar";
import {
  filterApplications,
  hasActiveFilters,
  parseApplicationFilters,
  type FilterableApplication,
} from "@/lib/applications/filters";
import {
  applicationDetailsSchema,
  formatDayAndTime,
  interviewSchema,
  isDuplicateApplication,
  isRealDate,
  newApplicationSchema,
  reminderSchema,
} from "@/lib/applications/schema";
import { applicationStats } from "@/lib/applications/stats";
import {
  allowedMoves,
  appliedDateAfterMove,
  applicationStatuses,
  canMove,
} from "@/lib/applications/status";

describe("status moves", () => {
  it("never lists a move to the same status", () => {
    for (const status of applicationStatuses) expect(canMove(status, status)).toBe(false);
  });

  it("allows skipping ahead and undoing mistakes", () => {
    expect(canMove("saved", "interview")).toBe(true);
    expect(canMove("interview", "applied")).toBe(true);
    expect(canMove("rejected", "interview")).toBe(true);
  });

  it("does not allow rejection of something never sent", () => {
    expect(canMove("saved", "rejected")).toBe(false);
  });

  it("only lets an application go back to Saved from Applied", () => {
    const into = applicationStatuses.filter((status) => allowedMoves[status].includes("saved"));
    expect(into).toEqual(["applied"]);
  });

  it("lets every stage be reached and left", () => {
    for (const status of applicationStatuses) {
      expect(allowedMoves[status].length).toBeGreaterThan(0);
      expect(applicationStatuses.some((other) => canMove(other, status))).toBe(true);
    }
  });
});

describe("appliedDateAfterMove", () => {
  it("records today when leaving Saved", () => {
    expect(appliedDateAfterMove("applied", null, "2026-11-07")).toBe("2026-11-07");
  });

  it("prefers a date the user chose", () => {
    expect(appliedDateAfterMove("applied", null, "2026-11-07", "2026-11-01")).toBe("2026-11-01");
  });

  it("keeps the existing date on later moves", () => {
    expect(appliedDateAfterMove("offer", "2026-10-01", "2026-11-07")).toBe("2026-10-01");
  });

  it("clears the date when going back to Saved", () => {
    expect(appliedDateAfterMove("saved", "2026-10-01", "2026-11-07")).toBeNull();
  });
});

describe("form validation", () => {
  const application = {
    company: "Acme",
    role_title: "Analyst",
    status: "applied",
    applied_at: "2026-11-01",
    job_url: "",
    notes: "",
  };

  it("accepts a valid application and trims it", () => {
    const result = newApplicationSchema.parse({ ...application, company: "  Acme " });
    expect(result.company).toBe("Acme");
  });

  it.each([
    ["company", { company: " " }],
    ["position", { role_title: "" }],
    ["status", { status: "screening" }],
    ["date", { applied_at: "2026-02-30" }],
    ["long company", { company: "x".repeat(201) }],
  ])("rejects a bad %s", (_, change) => {
    expect(newApplicationSchema.safeParse({ ...application, ...change }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "not a link", "ftp://example.com"])(
    "rejects %s as a job link, because it is shown as a link",
    (job_url) => {
      expect(newApplicationSchema.safeParse({ ...application, job_url }).success).toBe(false);
    },
  );

  it("accepts a web link", () => {
    const job_url = "https://example.com/jobs/1";
    expect(newApplicationSchema.safeParse({ ...application, job_url }).success).toBe(true);
  });

  it("checks the recruiter's email only when given", () => {
    const details = {
      company: "Acme",
      role_title: "Analyst",
      applied_at: "",
      job_url: "",
      notes: "",
      recruiter_name: "",
      recruiter_email: "",
      recruiter_phone: "",
      offer_details: "",
      offer_deadline: "",
      rejection_reason: "",
      resume_id: "",
      cover_letter_id: "",
    };
    expect(applicationDetailsSchema.safeParse(details).success).toBe(true);
    expect(
      applicationDetailsSchema.safeParse({ ...details, recruiter_email: "nope" }).success,
    ).toBe(false);
  });

  it("needs a real date and time for an interview", () => {
    const interview = { kind: "video", location: "", interviewer: "", notes: "" };
    expect(
      interviewSchema.safeParse({ ...interview, scheduled_at: "2026-11-20T10:30" }).success,
    ).toBe(true);
    expect(interviewSchema.safeParse({ ...interview, scheduled_at: "2026-11-20" }).success).toBe(false);
    expect(
      interviewSchema.safeParse({ ...interview, scheduled_at: "2026-13-20T10:30" }).success,
    ).toBe(false);
  });

  it("needs a title and date for a reminder", () => {
    expect(reminderSchema.safeParse({ title: " ", due_on: "2026-11-20" }).success).toBe(false);
    expect(reminderSchema.safeParse({ title: "Call", due_on: "soon" }).success).toBe(false);
  });

  it("spots the same company and position, ignoring case and spaces", () => {
    const existing = [{ company: "Acme", role_title: "Data Analyst" }];
    expect(isDuplicateApplication(existing, " ACME ", "data analyst")).toBe(true);
    expect(isDuplicateApplication(existing, "Acme", "Engineer")).toBe(false);
    expect(isDuplicateApplication([], "Acme", "Data Analyst")).toBe(false);
  });

  it("knows real dates", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2026-02-29")).toBe(false);
  });

  it("shows an interview at the time entered, with no time zone shift", () => {
    expect(formatDayAndTime("2026-11-20T10:30:00")).toBe("20 Nov 2026, 10:30");
  });
});

const row = (overrides: Partial<FilterableApplication>): FilterableApplication => ({
  company: "Acme",
  role_title: "Analyst",
  notes: "",
  recruiter_name: "",
  status: "applied",
  applied_at: "2026-10-10",
  updated_at: "2026-10-10T00:00:00Z",
  ...overrides,
});

describe("filters", () => {
  const filters = parseApplicationFilters({});

  it("ignores anything unrecognised in the address", () => {
    const parsed = parseApplicationFilters({ status: "x", sort: "y", from: "soon", to: ["2026-13-01"] });
    expect(parsed).toEqual({ q: "", status: "", from: "", to: "", sort: "updated" });
    expect(hasActiveFilters(parsed)).toBe(false);
  });

  it("searches company, position, notes and recruiter, ignoring case", () => {
    const list = [
      row({ company: "Acme" }),
      row({ company: "Beta", role_title: "Engineer", notes: "met ACME people" }),
      row({ company: "Gamma", recruiter_name: "Acme Recruiting" }),
      row({ company: "Delta" }),
    ];
    expect(filterApplications(list, { ...filters, q: "acme" })).toHaveLength(3);
  });

  it("needs every search word to match", () => {
    const list = [row({ company: "Acme", role_title: "Engineer" })];
    expect(filterApplications(list, { ...filters, q: "acme analyst" })).toEqual([]);
  });

  it("treats search text literally", () => {
    const list = [row({ company: "A,B" }), row({ company: "C" })];
    expect(filterApplications(list, { ...filters, q: "a,b" })).toHaveLength(1);
    expect(filterApplications(list, { ...filters, q: "%" })).toEqual([]);
  });

  it("filters by status and date range, leaving out undated items", () => {
    const list = [
      row({ applied_at: "2026-10-01" }),
      row({ applied_at: "2026-10-15" }),
      row({ applied_at: null, status: "saved" }),
    ];
    expect(filterApplications(list, { ...filters, status: "saved" })).toHaveLength(1);
    expect(filterApplications(list, { ...filters, from: "2026-10-10" })).toHaveLength(1);
    expect(filterApplications(list, { ...filters, to: "2026-10-01" })).toHaveLength(1);
  });

  it("sorts by date with unsent applications last, and by company", () => {
    const list = [
      row({ company: "B", applied_at: null }),
      row({ company: "C", applied_at: "2026-10-15" }),
      row({ company: "A", applied_at: "2026-10-01" }),
    ];
    const order = (sort: "applied" | "company") =>
      filterApplications(list, { ...filters, sort }).map((item) => item.company);
    expect(order("applied")).toEqual(["C", "A", "B"]);
    expect(order("company")).toEqual(["A", "B", "C"]);
  });
});

describe("calendar", () => {
  const event = (date: string, time = ""): CalendarEvent => ({
    id: `${date}${time}`,
    date,
    time,
    kind: "interview",
    title: "Interview",
    href: "/applications/1",
  });

  it("covers whole weeks starting on Monday", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    expect(monthRange("2026-11")).toEqual({ start: "2026-10-26", end: "2026-12-06" });
    const month = buildMonth("2026-11", [], "2026-11-07");
    expect(month.weeks).toHaveLength(6);
    expect(month.weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("handles a leap February and the turn of the year", () => {
    expect(buildMonth("2028-02", [], "2028-02-29").weeks.flat().filter((d) => d.inMonth)).toHaveLength(29);
    const december = buildMonth("2026-12", [], "2026-12-01");
    expect(december.next).toBe("2027-01");
    expect(buildMonth("2027-01", [], "2027-01-01").previous).toBe("2026-12");
  });

  it("places events on their day, timed ones first in time order", () => {
    const month = buildMonth(
      "2026-11",
      [event("2026-11-10"), event("2026-11-10", "15:00"), event("2026-11-10", "09:00")],
      "2026-11-07",
    );
    const day = month.weeks.flat().find((d) => d.date === "2026-11-10");
    expect(day?.events.map((e) => e.time)).toEqual(["09:00", "15:00", ""]);
  });

  it("marks today only", () => {
    const today = buildMonth("2026-11", [], "2026-11-07").weeks.flat().filter((d) => d.isToday);
    expect(today.map((d) => d.date)).toEqual(["2026-11-07"]);
  });

  it("falls back to this month for a bad address", () => {
    expect(parseMonth("2026-13", "2026-11-07")).toBe("2026-11");
    expect(parseMonth(undefined, "2026-11-07")).toBe("2026-11");
    expect(parseMonth("2027-03", "2026-11-07")).toBe("2027-03");
  });

  it("classifies reminders", () => {
    expect(reminderState("2026-11-06", "2026-11-07")).toBe("overdue");
    expect(reminderState("2026-11-07", "2026-11-07")).toBe("today");
    expect(reminderState("2026-11-08", "2026-11-07")).toBe("upcoming");
  });

  it("adds days across a month end", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
  });
});

describe("applicationStats", () => {
  const today = "2026-11-07";
  const app = (id: string, status: FilterableApplication["status"], applied_at: string | null) => ({
    id,
    status,
    applied_at,
  });
  const moved = (application_id: string, to_status: FilterableApplication["status"], created_at: string) => ({
    application_id,
    kind: "status_changed",
    to_status,
    created_at,
  });

  it("reports no rate at all, rather than zero, with nothing sent", () => {
    const stats = applicationStats([app("1", "saved", null)], [], today);
    expect(stats.total).toBe(1);
    expect(stats.applied).toBe(0);
    expect(stats.responseRate).toBeNull();
    expect(stats.medianDaysToResponse).toBeNull();
  });

  it("counts a rejection after an interview as an interview", () => {
    const stats = applicationStats(
      [app("1", "rejected", "2026-10-01")],
      [moved("1", "interview", "2026-10-05T00:00:00Z"), moved("1", "rejected", "2026-10-09T00:00:00Z")],
      today,
    );
    expect(stats.interviewed).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.responded).toBe(1);
  });

  it("does not count Saved in rates, or silence as a reply", () => {
    const stats = applicationStats(
      [
        app("1", "saved", null),
        app("2", "applied", "2026-10-01"),
        app("3", "applied", "2026-10-01"),
        app("4", "interview", "2026-10-01"),
        app("5", "offer", "2026-10-01"),
      ],
      [],
      today,
    );
    expect(stats.applied).toBe(4);
    expect(stats.responseRate).toBe(50);
    expect(stats.interviewRate).toBe(25);
    expect(stats.offerRate).toBe(25);
    expect(stats.byStatus.applied).toBe(2);
  });

  it("uses the first reply for the median reply time", () => {
    const stats = applicationStats(
      [app("1", "offer", "2026-10-01"), app("2", "rejected", "2026-10-01"), app("3", "rejected", "2026-10-01")],
      [
        moved("1", "assessment", "2026-10-03T12:00:00Z"),
        moved("1", "offer", "2026-10-30T00:00:00Z"),
        moved("2", "rejected", "2026-10-11T00:00:00Z"),
        moved("3", "rejected", "2026-10-21T00:00:00Z"),
      ],
      today,
    );
    expect(stats.medianDaysToResponse).toBe(10);
  });

  it("has no reply time for an application added at a later stage", () => {
    const stats = applicationStats(
      [app("1", "interview", "2026-10-01")],
      [
        {
          application_id: "1",
          kind: "created",
          to_status: "interview",
          created_at: "2026-10-01T09:00:00Z",
        },
      ],
      today,
    );
    expect(stats.interviewed).toBe(1);
    expect(stats.medianDaysToResponse).toBeNull();
  });

  it("ignores a reply logged before the application date", () => {
    const stats = applicationStats(
      [app("1", "rejected", "2026-10-10")],
      [moved("1", "rejected", "2026-10-01T00:00:00Z")],
      today,
    );
    expect(stats.medianDaysToResponse).toBeNull();
  });

  it("groups applications by week, ending with this week", () => {
    const stats = applicationStats(
      [app("1", "applied", "2026-11-02"), app("2", "applied", "2026-11-07"), app("3", "applied", "2026-10-26")],
      [],
      today,
    );
    expect(stats.weekly).toHaveLength(8);
    expect(stats.weekly.at(-1)).toEqual({ week: "2026-11-02", count: 2 });
    expect(stats.weekly.at(-2)).toEqual({ week: "2026-10-26", count: 1 });
  });
});

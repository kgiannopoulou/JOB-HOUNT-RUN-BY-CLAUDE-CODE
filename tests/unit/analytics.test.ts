import { describe, expect, it } from "vitest";

import { buildAnalytics, WEEKS_SHOWN } from "@/lib/analytics/summary";
import type { ApplicationStatus } from "@/lib/applications/status";
import {
  dateInZone,
  hoursBetween,
  isValidTimeZone,
  safeTimeZone,
  wallClockInZone,
} from "@/lib/time";

type Input = Parameters<typeof buildAnalytics>[0];

const input = (overrides: Partial<Input> = {}): Input => ({
  jobsDiscovered: 0,
  savedJobs: [],
  applications: [],
  events: [],
  interviews: [],
  practiceSessions: [],
  now: new Date("2026-11-07T10:00:00Z"),
  timeZone: "UTC",
  ...overrides,
});

const app = (id: string, status: ApplicationStatus, applied_at: string | null = "2026-11-03") => ({
  id,
  status,
  applied_at,
});

const moved = (application_id: string, to_status: ApplicationStatus) => ({
  application_id,
  kind: "status_changed",
  to_status,
  created_at: "2026-11-04T10:00:00Z",
});

describe("buildAnalytics", () => {
  it("shows zeros and no rate for an empty account, never an invented figure", () => {
    const summary = buildAnalytics(input());
    expect(summary).toMatchObject({
      jobsDiscovered: 0,
      savedJobs: 0,
      applicationsSubmitted: 0,
      interviewsReceived: 0,
      offersReceived: 0,
      rejections: 0,
      responseRate: null,
      hasActivity: false,
    });
    expect(summary.weekly.every((week) => week.applied + week.saved === 0)).toBe(true);
  });

  it("passes through the number of jobs it was given", () => {
    expect(buildAnalytics(input({ jobsDiscovered: 37 })).jobsDiscovered).toBe(37);
  });

  it("counts Saved as tracked but not submitted", () => {
    const summary = buildAnalytics(
      input({ applications: [app("1", "saved", null), app("2", "applied")] }),
    );
    expect(summary.applicationsSubmitted).toBe(1);
    expect(summary.byStatus.saved).toBe(1);
    expect(summary.hasActivity).toBe(true);
  });

  it("counts offers and rejections, and rejection counts as a reply", () => {
    const summary = buildAnalytics(
      input({
        applications: [
          app("1", "offer"),
          app("2", "rejected"),
          app("3", "applied"),
          app("4", "applied"),
        ],
      }),
    );
    expect(summary.offersReceived).toBe(1);
    expect(summary.rejections).toBe(1);
    expect(summary.responded).toBe(2);
    expect(summary.responseRate).toBe(50);
  });

  it("counts an application once, however many interview rounds it had", () => {
    const summary = buildAnalytics(
      input({
        applications: [app("1", "interview")],
        interviews: [
          { application_id: "1", scheduled_at: "2026-11-05T10:00:00" },
          { application_id: "1", scheduled_at: "2026-11-06T10:00:00" },
        ],
      }),
    );
    expect(summary.interviewsReceived).toBe(1);
    expect(summary.weekly.at(-1)?.interviews).toBe(2);
  });

  it("still counts an interview after a later rejection", () => {
    const summary = buildAnalytics(
      input({
        applications: [app("1", "rejected")],
        events: [moved("1", "interview"), moved("1", "rejected")],
      }),
    );
    expect(summary.interviewsReceived).toBe(1);
    expect(summary.rejections).toBe(1);
  });

  it("counts a recorded interview even if the card never moved to Interview", () => {
    const summary = buildAnalytics(
      input({
        applications: [app("1", "applied")],
        interviews: [{ application_id: "1", scheduled_at: "2026-11-05T10:00:00" }],
      }),
    );
    expect(summary.interviewsReceived).toBe(1);
  });

  it("does not count an interview on something never sent", () => {
    const summary = buildAnalytics(
      input({
        applications: [app("1", "saved", null)],
        interviews: [{ application_id: "1", scheduled_at: "2026-11-05T10:00:00" }],
      }),
    );
    expect(summary.interviewsReceived).toBe(0);
  });
});

describe("weekly activity", () => {
  it("covers eight weeks ending with this one, starting on Mondays", () => {
    const { weekly } = buildAnalytics(input());
    expect(weekly).toHaveLength(WEEKS_SHOWN);
    expect(weekly.at(-1)?.week).toBe("2026-11-02");
    expect(weekly[0].week).toBe("2026-09-14");
  });

  it("places each kind of activity in its week", () => {
    const { weekly } = buildAnalytics(
      input({
        savedJobs: [{ created_at: "2026-11-03T10:00:00Z" }],
        applications: [app("1", "applied", "2026-10-28")],
        practiceSessions: [{ created_at: "2026-11-05T10:00:00Z" }],
      }),
    );
    expect(weekly.at(-1)).toMatchObject({ saved: 1, applied: 0, practice: 1 });
    expect(weekly.at(-2)).toMatchObject({ saved: 0, applied: 1 });
  });

  it("leaves out anything older than the window", () => {
    const { weekly } = buildAnalytics(input({ applications: [app("1", "applied", "2026-01-01")] }));
    expect(weekly.every((week) => week.applied === 0)).toBe(true);
  });

  it("uses the user's week: late Sunday in UTC is Monday in Athens", () => {
    const savedJobs = [{ created_at: "2026-11-01T23:00:00Z" }];
    const now = new Date("2026-11-03T10:00:00Z");
    const utc = buildAnalytics(input({ savedJobs, now, timeZone: "UTC" }));
    const athens = buildAnalytics(input({ savedJobs, now, timeZone: "Europe/Athens" }));
    expect(utc.weekly.at(-1)?.saved).toBe(0);
    expect(athens.weekly.at(-1)?.saved).toBe(1);
  });

  it("does not shift a date the user entered", () => {
    const { weekly } = buildAnalytics(
      input({ applications: [app("1", "applied", "2026-11-02")], timeZone: "America/Los_Angeles" }),
    );
    expect(weekly.at(-1)?.applied).toBe(1);
  });
});

describe("time zones", () => {
  it("knows real zones", () => {
    expect(isValidTimeZone("Europe/Athens")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("falls back to UTC", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
    expect(safeTimeZone("Europe/Athens")).toBe("Europe/Athens");
  });

  it("gives the local date, which can differ from UTC", () => {
    const moment = new Date("2026-11-07T23:30:00Z");
    expect(dateInZone(moment, "UTC")).toBe("2026-11-07");
    expect(dateInZone(moment, "Europe/Athens")).toBe("2026-11-08");
    expect(dateInZone(new Date("2026-11-08T03:00:00Z"), "America/New_York")).toBe("2026-11-07");
  });

  it("handles daylight saving", () => {
    expect(wallClockInZone(new Date("2026-07-01T10:00:00Z"), "Europe/Athens")).toBe("2026-07-01T13:00:00");
    expect(wallClockInZone(new Date("2026-12-01T10:00:00Z"), "Europe/Athens")).toBe("2026-12-01T12:00:00");
  });

  it("uses 00 for midnight, not 24", () => {
    expect(wallClockInZone(new Date("2026-11-07T00:00:00Z"), "UTC")).toBe("2026-11-07T00:00:00");
  });

  it("measures hours between wall-clock times", () => {
    expect(hoursBetween("2026-11-07T10:00:00", "2026-11-08T09:00:00")).toBe(23);
    expect(hoursBetween("2026-11-07T10:00:00", "2026-11-07T09:00:00")).toBe(-1);
  });
});

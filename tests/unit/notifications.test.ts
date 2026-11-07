import { describe, expect, it } from "vitest";

import {
  FOLLOW_UP_AFTER_DAYS,
  MAX_JOB_MATCHES_PER_RUN,
  passwordChangedNotification,
  planNotifications,
} from "@/lib/notifications/rules";

type Input = Parameters<typeof planNotifications>[0];

const now = new Date("2026-11-07T10:00:00Z");

const input = (overrides: Partial<Input> = {}): Input => ({
  now,
  timeZone: "UTC",
  preferences: {
    notify_follow_ups: true,
    notify_interviews: true,
    notify_saved_jobs: true,
    notify_job_matches: true,
  },
  desiredTitles: [],
  desiredLocations: [],
  reminders: [],
  applications: [],
  interviews: [],
  savedJobs: [],
  newJobs: [],
  ...overrides,
});

const reminder = (overrides = {}) => ({
  id: "r1",
  application_id: "a1",
  title: "Call the recruiter",
  due_on: "2026-11-07",
  company: "Acme",
  ...overrides,
});

const application = (overrides = {}) => ({
  id: "a1",
  company: "Acme",
  role_title: "Analyst",
  status: "applied",
  applied_at: "2026-10-01",
  job_id: null,
  ...overrides,
});

const interview = (overrides = {}) => ({
  id: "i1",
  application_id: "a1",
  scheduled_at: "2026-11-08T09:00:00",
  company: "Acme",
  role_title: "Analyst",
  ...overrides,
});

const newJob = (overrides = {}) => ({
  id: "j1",
  title: "Senior Data Analyst",
  company: "Acme",
  location_raw: "Athens, Greece",
  remote_policy: "onsite",
  first_seen_at: "2026-11-06T00:00:00Z",
  ...overrides,
});

const keys = (overrides: Partial<Input>) =>
  planNotifications(input(overrides)).map((draft) => draft.dedupe_key);

describe("nothing to report", () => {
  it("creates nothing from no records, so nothing is ever made up", () => {
    expect(planNotifications(input())).toEqual([]);
  });
});

describe("reminders", () => {
  it("fires on the due date and for overdue reminders, not before", () => {
    expect(keys({ reminders: [reminder()] })).toEqual(["reminder:r1:2026-11-07"]);
    expect(keys({ reminders: [reminder({ due_on: "2026-11-01" })] })).toHaveLength(1);
    expect(keys({ reminders: [reminder({ due_on: "2026-11-08" })] })).toEqual([]);
  });

  it("uses the user's day, not the server's", () => {
    const lateEvening = new Date("2026-11-07T22:30:00Z");
    const due = { reminders: [reminder({ due_on: "2026-11-08" })], now: lateEvening };
    expect(keys({ ...due, timeZone: "UTC" })).toEqual([]);
    expect(keys({ ...due, timeZone: "Europe/Athens" })).toHaveLength(1);
    const behind = { reminders: [reminder({ due_on: "2026-11-08" })], now: new Date("2026-11-08T03:00:00Z") };
    expect(keys({ ...behind, timeZone: "America/New_York" })).toEqual([]);
  });

  it("can fire again after being moved to a new date", () => {
    const first = keys({ reminders: [reminder({ due_on: "2026-11-01" })] });
    const moved = keys({ reminders: [reminder({ due_on: "2026-11-05" })] });
    expect(first).not.toEqual(moved);
  });
});

describe("application follow-ups", () => {
  it("nudges after the waiting period, not before", () => {
    const cutoff = "2026-10-24";
    expect(FOLLOW_UP_AFTER_DAYS).toBe(14);
    expect(keys({ applications: [application({ applied_at: cutoff })] })).toHaveLength(1);
    expect(keys({ applications: [application({ applied_at: "2026-10-25" })] })).toEqual([]);
  });

  it.each(["saved", "assessment", "interview", "offer", "rejected"])(
    "does not nudge an application at %s",
    (status) => {
      expect(keys({ applications: [application({ status })] })).toEqual([]);
    },
  );

  it("does not nudge when a reminder or interview already covers it", () => {
    const applications = [application()];
    expect(keys({ applications, reminders: [reminder({ due_on: "2027-01-01" })] })).toEqual([]);
    expect(keys({ applications, interviews: [interview({ scheduled_at: "2027-01-01T09:00:00" })] })).toEqual([]);
  });
});

describe("interviews", () => {
  it("gives notice inside the window only", () => {
    expect(keys({ interviews: [interview()] })).toHaveLength(1);
    expect(keys({ interviews: [interview({ scheduled_at: "2026-11-09T10:00:00" })] })).toHaveLength(1);
    expect(keys({ interviews: [interview({ scheduled_at: "2026-11-09T10:01:00" })] })).toEqual([]);
  });

  it("does not announce an interview that has passed", () => {
    expect(keys({ interviews: [interview({ scheduled_at: "2026-11-07T09:59:00" })] })).toEqual([]);
  });

  it("compares in the user's time zone, because interview times have none", () => {
    // 09:30 UTC is 11:30 in Athens, so an interview at 11:00 there has already passed.
    const moment = { now: new Date("2026-11-07T09:30:00Z"), interviews: [interview({ scheduled_at: "2026-11-07T11:00:00" })] };
    expect(keys({ ...moment, timeZone: "UTC" })).toHaveLength(1);
    expect(keys({ ...moment, timeZone: "Europe/Athens" })).toEqual([]);
  });

  it("notifies again if rescheduled", () => {
    const first = keys({ interviews: [interview()] });
    const moved = keys({ interviews: [interview({ scheduled_at: "2026-11-08T15:00:00" })] });
    expect(first).not.toEqual(moved);
  });

  it("shows the time as entered", () => {
    const [draft] = planNotifications(input({ interviews: [interview()] }));
    expect(draft.body).toContain("8 Nov 2026, 09:00");
  });
});

describe("saved job updates", () => {
  const closed = { job_id: "j1", title: "Analyst", company: "Acme", is_active: false };

  it("reports a saved job that has closed", () => {
    expect(keys({ savedJobs: [closed] })).toEqual(["job-closed:j1"]);
  });

  it("stays quiet about a job that is still listed", () => {
    expect(keys({ savedJobs: [{ ...closed, is_active: true }] })).toEqual([]);
  });

  it("stays quiet once the user has applied", () => {
    const applications = [application({ job_id: "j1", status: "interview" })];
    expect(keys({ savedJobs: [closed], applications })).toEqual([]);
  });

  it("links to the board card when there is one", () => {
    const applications = [application({ job_id: "j1", status: "saved", applied_at: null })];
    const [draft] = planNotifications(input({ savedJobs: [closed], applications }));
    expect(draft.link).toBe("/applications/a1");
  });
});

describe("new job matches", () => {
  const titles = { desiredTitles: ["Data Analyst"] };

  it("needs target titles, so it never guesses what someone wants", () => {
    expect(keys({ newJobs: [newJob()] })).toEqual([]);
  });

  it("matches whole phrases in the title", () => {
    expect(keys({ ...titles, newJobs: [newJob()] })).toEqual(["job-match:j1"]);
    expect(keys({ ...titles, newJobs: [newJob({ title: "Data Engineer" })] })).toEqual([]);
    expect(keys({ desiredTitles: ["Java"], newJobs: [newJob({ title: "JavaScript Developer" })] })).toEqual([]);
  });

  it("respects preferred locations, but accepts remote roles", () => {
    const desiredLocations = ["Athens"];
    expect(keys({ ...titles, desiredLocations, newJobs: [newJob()] })).toHaveLength(1);
    const elsewhere = newJob({ location_raw: "Berlin" });
    expect(keys({ ...titles, desiredLocations, newJobs: [elsewhere] })).toEqual([]);
    const remote = newJob({ location_raw: "Berlin", remote_policy: "remote" });
    expect(keys({ ...titles, desiredLocations, newJobs: [remote] })).toHaveLength(1);
  });

  it("skips old listings and jobs the user already has", () => {
    const old = newJob({ first_seen_at: "2026-10-01T00:00:00Z" });
    expect(keys({ ...titles, newJobs: [old] })).toEqual([]);
    const savedJobs = [{ job_id: "j1", title: "x", company: "y", is_active: true }];
    expect(keys({ ...titles, newJobs: [newJob()], savedJobs })).toEqual([]);
    const applications = [application({ job_id: "j1", status: "saved" })];
    expect(keys({ ...titles, newJobs: [newJob()], applications })).toEqual([]);
  });

  it("limits how many arrive at once, newest first", () => {
    const newJobs = Array.from({ length: 12 }, (_, index) =>
      newJob({ id: `j${index}`, first_seen_at: `2026-11-06T${String(index).padStart(2, "0")}:00:00Z` }),
    );
    const result = keys({ ...titles, newJobs });
    expect(result).toHaveLength(MAX_JOB_MATCHES_PER_RUN);
    expect(result[0]).toBe("job-match:j11");
  });

  it("keeps links inside the site", () => {
    const [draft] = planNotifications(input({ ...titles, newJobs: [newJob({ title: "Data Analyst & Co //x" })] }));
    expect(draft.link.startsWith("/jobs?")).toBe(true);
  });
});

describe("preferences", () => {
  const everything = {
    desiredTitles: ["Data Analyst"],
    reminders: [reminder()],
    applications: [application({ id: "a2" })],
    interviews: [interview()],
    savedJobs: [{ job_id: "j9", title: "x", company: "y", is_active: false }],
    newJobs: [newJob()],
  };
  const types = (preferences: Partial<Input["preferences"]>) =>
    new Set(
      planNotifications(
        input({ ...everything, preferences: { ...input().preferences, ...preferences } }),
      ).map((draft) => draft.type),
    );

  it("sends every kind when all are on", () => {
    expect(types({})).toEqual(new Set(["follow_up", "interview", "saved_job", "job_match"]));
  });

  it.each([
    ["notify_follow_ups", "follow_up"],
    ["notify_interviews", "interview"],
    ["notify_saved_jobs", "saved_job"],
    ["notify_job_matches", "job_match"],
  ])("%s turns off only %s", (preference, type) => {
    const result = types({ [preference]: false });
    expect(result.has(type as never)).toBe(false);
    expect(result.size).toBe(3);
  });
});

describe("repeat runs", () => {
  it("produces identical keys, which is what stops duplicates", () => {
    const records = {
      reminders: [reminder()],
      interviews: [interview()],
      applications: [application({ id: "a2" })],
    };
    expect(keys(records)).toEqual(keys({ ...records, now: new Date("2026-11-07T11:00:00Z") }));
  });

  it("never repeats a key within one run", () => {
    const result = keys({
      reminders: [reminder(), reminder({ id: "r2" })],
      interviews: [interview(), interview({ id: "i2" })],
    });
    expect(new Set(result).size).toBe(result.length);
  });
});

describe("account notifications", () => {
  it("are not tied to any preference", () => {
    const draft = passwordChangedNotification(now);
    expect(draft.type).toBe("account");
    expect(draft.dedupe_key).toBe("account:password:2026-11-07T10:00");
  });
});

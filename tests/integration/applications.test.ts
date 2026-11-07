import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applicationStatuses, canMove, type ApplicationStatus } from "@/lib/applications/status";

import { adminClient, anonClient, createUser, deleteUser, insertJob, type TestUser } from "./helpers";

let alice: TestUser;
let bob: TestUser;
let jobId: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createUser("Alice Example"), createUser("Bob Example")]);
  jobId = (await insertJob()).id;
});

afterAll(async () => {
  await Promise.all([deleteUser(alice), deleteUser(bob)]);
  await adminClient().from("jobs").delete().eq("id", jobId);
});

async function newApplication(status: ApplicationStatus = "applied") {
  const { data, error } = await alice.client
    .from("applications")
    .insert({
      user_id: alice.id,
      company: "Acme",
      role_title: "Analyst",
      status,
      applied_at: status === "saved" ? null : "2026-10-01",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("application CRUD", () => {
  it("creates, reads, updates and deletes", async () => {
    const id = await newApplication();

    const update = await alice.client
      .from("applications")
      .update({
        notes: "Spoke to the team",
        recruiter_name: "Sam Recruiter",
        recruiter_email: "sam@example.com",
        offer_details: "Base salary to be confirmed",
        offer_deadline: "2026-12-01",
        rejection_reason: "",
      })
      .eq("id", id);
    expect(update.error).toBeNull();

    const { data } = await alice.client.from("applications").select("*").eq("id", id).single();
    expect(data).toMatchObject({
      notes: "Spoke to the team",
      recruiter_name: "Sam Recruiter",
      offer_deadline: "2026-12-01",
      applied_at: "2026-10-01",
    });

    expect((await alice.client.from("applications").delete().eq("id", id)).error).toBeNull();
    const gone = await alice.client.from("applications").select("id").eq("id", id);
    expect(gone.data).toEqual([]);
  });

  it("only accepts the six board stages", async () => {
    const { error } = await alice.client.from("applications").insert({
      user_id: alice.id,
      company: "Acme",
      role_title: "Analyst",
      status: "screening" as ApplicationStatus,
    });
    expect(error).not.toBeNull();
  });

  it("requires an application date past Saved", async () => {
    const { error } = await alice.client.from("applications").insert({
      user_id: alice.id,
      company: "Acme",
      role_title: "Analyst",
      status: "applied",
    });
    expect(error?.code).toBe("23514");
  });

  it("refuses a job link that is not a web address", async () => {
    const { error } = await alice.client.from("applications").insert({
      user_id: alice.id,
      company: "Acme",
      role_title: "Analyst",
      job_url: "javascript:alert(1)",
    });
    expect(error?.code).toBe("23514");
  });

  it("allows one application per job", async () => {
    const row = { user_id: alice.id, company: "Acme", role_title: "Analyst", job_id: jobId };
    expect((await alice.client.from("applications").insert(row)).error).toBeNull();
    expect((await alice.client.from("applications").insert(row)).error?.code).toBe("23505");
  });
});

describe("status transitions", () => {
  it("the database and the app agree on all 36 pairs", async () => {
    const admin = adminClient();
    for (const from of applicationStatuses) {
      for (const to of applicationStatuses) {
        const { data, error } = await admin.rpc("application_move_allowed", {
          p_from: from,
          p_to: to,
        });
        expect(error).toBeNull();
        expect([from, to, data]).toEqual([from, to, canMove(from, to)]);
      }
    }
  });

  it("applies an allowed move", async () => {
    const id = await newApplication("applied");
    const { error } = await alice.client
      .from("applications")
      .update({ status: "interview" })
      .eq("id", id);
    expect(error).toBeNull();
  });

  it("refuses a forbidden move, even straight through the API", async () => {
    const id = await newApplication("saved");
    const { error } = await alice.client
      .from("applications")
      .update({ status: "rejected", applied_at: "2026-10-01" })
      .eq("id", id);
    expect(error?.code).toBe("23514");

    const { data } = await alice.client.from("applications").select("status").eq("id", id).single();
    expect(data?.status).toBe("saved");
  });

  it("a stale update changes nothing", async () => {
    const id = await newApplication("applied");
    await alice.client.from("applications").update({ status: "interview" }).eq("id", id);
    const { data } = await alice.client
      .from("applications")
      .update({ status: "offer" })
      .eq("id", id)
      .eq("status", "applied")
      .select("id");
    expect(data).toEqual([]);
  });
});

describe("history", () => {
  it("records creation, every move and interviews, in order", async () => {
    const id = await newApplication("saved");
    await alice.client
      .from("applications")
      .update({ status: "applied", applied_at: "2026-10-01" })
      .eq("id", id);
    await alice.client.from("applications").update({ status: "interview" }).eq("id", id);
    await alice.client.from("application_interviews").insert({
      user_id: alice.id,
      application_id: id,
      scheduled_at: "2026-11-20T10:30:00",
    });

    const { data } = await alice.client
      .from("application_events")
      .select("kind, from_status, to_status")
      .eq("application_id", id)
      .order("created_at");
    expect(data).toEqual([
      { kind: "created", from_status: null, to_status: "saved" },
      { kind: "status_changed", from_status: "saved", to_status: "applied" },
      { kind: "status_changed", from_status: "applied", to_status: "interview" },
      { kind: "interview_added", from_status: null, to_status: null },
    ]);
  });

  it("does not record an edit that leaves the status alone", async () => {
    const id = await newApplication();
    await alice.client.from("applications").update({ notes: "x" }).eq("id", id);
    await alice.client.from("applications").update({ status: "applied" }).eq("id", id);
    const { data } = await alice.client
      .from("application_events")
      .select("id")
      .eq("application_id", id);
    expect(data).toHaveLength(1);
  });

  it("cannot be written, changed or removed by a user", async () => {
    const id = await newApplication();
    const client = alice.client.from("application_events");
    const insert = await client.insert({ user_id: alice.id, application_id: id, kind: "created" });
    expect(insert.error?.code).toBe("42501");
    const update = await alice.client
      .from("application_events")
      .update({ kind: "created" })
      .eq("application_id", id);
    expect(update.error?.code).toBe("42501");
    const remove = await alice.client.from("application_events").delete().eq("application_id", id);
    expect(remove.error?.code).toBe("42501");
  });

  it("is removed with its application", async () => {
    const id = await newApplication();
    await alice.client.from("applications").delete().eq("id", id);
    const { data } = await adminClient()
      .from("application_events")
      .select("id")
      .eq("application_id", id);
    expect(data).toEqual([]);
  });
});

describe("interviews and reminders", () => {
  it("keeps the interview time exactly as entered", async () => {
    const id = await newApplication();
    const { data } = await alice.client
      .from("application_interviews")
      .insert({ user_id: alice.id, application_id: id, scheduled_at: "2026-11-20T10:30:00" })
      .select("scheduled_at")
      .single();
    expect(data?.scheduled_at).toBe("2026-11-20T10:30:00");
  });

  it("completes, reopens and removes a reminder", async () => {
    const id = await newApplication();
    const { data } = await alice.client
      .from("application_reminders")
      .insert({ user_id: alice.id, application_id: id, title: "Follow up", due_on: "2026-11-10" })
      .select("id")
      .single();
    const reminder = data!.id;

    const set = (completed_at: string | null) =>
      alice.client.from("application_reminders").update({ completed_at }).eq("id", reminder);
    expect((await set(new Date().toISOString())).error).toBeNull();
    expect((await set(null)).error).toBeNull();
    const removed = await alice.client.from("application_reminders").delete().eq("id", reminder);
    expect(removed.error).toBeNull();
  });
});

describe("isolation between users", () => {
  let aliceApplication: string;

  beforeAll(async () => {
    aliceApplication = await newApplication();
    await alice.client.from("application_reminders").insert({
      user_id: alice.id,
      application_id: aliceApplication,
      title: "Private",
      due_on: "2026-11-10",
    });
    await alice.client.from("application_interviews").insert({
      user_id: alice.id,
      application_id: aliceApplication,
      scheduled_at: "2026-11-20T10:30:00",
    });
  });

  it.each(["application_interviews", "application_reminders", "application_events"] as const)(
    "another user cannot read %s",
    async (table) => {
      const { data, error } = await bob.client
        .from(table)
        .select("id")
        .eq("application_id", aliceApplication);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("another user cannot read, change or delete an application", async () => {
    const read = await bob.client.from("applications").select("id").eq("id", aliceApplication);
    expect(read.data).toEqual([]);
    const update = await bob.client
      .from("applications")
      .update({ notes: "Bob was here" })
      .eq("id", aliceApplication)
      .select("id");
    expect(update.data).toEqual([]);
    const remove = await bob.client
      .from("applications")
      .delete()
      .eq("id", aliceApplication)
      .select("id");
    expect(remove.data).toEqual([]);
  });

  it("a user cannot attach items to someone else's application", async () => {
    const reminder = await bob.client.from("application_reminders").insert({
      user_id: bob.id,
      application_id: aliceApplication,
      title: "Sneaky",
      due_on: "2026-11-10",
    });
    expect(reminder.error).not.toBeNull();
    const interview = await bob.client.from("application_interviews").insert({
      user_id: bob.id,
      application_id: aliceApplication,
      scheduled_at: "2026-11-20T10:30:00",
    });
    expect(interview.error).not.toBeNull();
  });

  it("an application cannot point at someone else's CV", async () => {
    const { data: resume } = await bob.client
      .from("resumes")
      .insert({ user_id: bob.id, title: "Bob CV" })
      .select("id")
      .single();
    const { error } = await alice.client
      .from("applications")
      .update({ resume_id: resume!.id })
      .eq("id", aliceApplication);
    expect(error).not.toBeNull();
  });

  it.each([
    "applications",
    "application_interviews",
    "application_reminders",
    "application_events",
  ] as const)("a signed-out visitor cannot read %s", async (table) => {
    const { error } = await anonClient().from(table).select("id");
    expect(error?.code).toBe("42501");
  });

  it("users cannot run the history functions themselves", async () => {
    const { error } = await alice.client.rpc(
      "record_application_event" as never,
    );
    expect(error).not.toBeNull();
  });
});

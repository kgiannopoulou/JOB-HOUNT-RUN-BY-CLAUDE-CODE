import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deliverNotifications, storeNotifications } from "@/server/notifications/deliver";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  insertJob,
  type Client,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let admin: Client;
let applicationId: string;
let sessionId: string;
let questionId: string;
const jobIds: string[] = [];

const today = () => new Date().toISOString().slice(0, 10);

async function session(owner: TestUser) {
  const { data, error } = await admin
    .from("interview_sessions")
    .insert({
      user_id: owner.id,
      company: "Acme",
      role_title: "Analyst",
      prompt_version: "v1",
      model: "test",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function question(owner: TestUser, session_id: string, position = 0) {
  const { data, error } = await admin
    .from("interview_questions")
    .insert({
      user_id: owner.id,
      session_id,
      position,
      question: "Why?",
      category: "technical",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const answerRow = (owner: TestUser, session_id: string, question_id: string) => ({
  user_id: owner.id,
  session_id,
  question_id,
  answer: "Because.",
  answer_hash: randomUUID(),
});

beforeAll(async () => {
  admin = adminClient();
  [alice, bob] = await Promise.all([createUser("Alice Example"), createUser("Bob Example")]);
  const { data, error } = await alice.client
    .from("applications")
    .insert({
      user_id: alice.id,
      company: "Acme",
      role_title: "Analyst",
      status: "applied",
      applied_at: "2026-01-01",
    })
    .select("id")
    .single();
  if (error) throw error;
  applicationId = data.id;
  sessionId = await session(alice);
  questionId = await question(alice, sessionId);
});

afterAll(async () => {
  await Promise.all([deleteUser(alice), deleteUser(bob)]);
  await admin.from("jobs").delete().in("id", jobIds);
});

describe("interview sessions", () => {
  it("keeps every attempt at a question", async () => {
    await admin.from("interview_answers").insert(answerRow(alice, sessionId, questionId));
    await admin.from("interview_answers").insert(answerRow(alice, sessionId, questionId));
    const { data } = await alice.client
      .from("interview_answers")
      .select("id")
      .eq("question_id", questionId);
    expect(data).toHaveLength(2);
  });

  it("only accepts known categories and ratings", async () => {
    const category = await admin.from("interview_questions").insert({
      user_id: alice.id,
      session_id: sessionId,
      position: 9,
      question: "x",
      category: "trivia",
    });
    expect(category.error?.code).toBe("23514");
    const rating = await admin
      .from("interview_answers")
      .insert({ ...answerRow(alice, sessionId, questionId), rating: "perfect" });
    expect(rating.error?.code).toBe("23514");
  });

  it("users cannot write a question, an answer or a rating themselves", async () => {
    const asked = await alice.client.from("interview_questions").insert({
      user_id: alice.id,
      session_id: sessionId,
      position: 5,
      question: "Fake",
      category: "technical",
    });
    expect(asked.error?.code).toBe("42501");
    const answered = await alice.client
      .from("interview_answers")
      .insert(answerRow(alice, sessionId, questionId));
    expect(answered.error?.code).toBe("42501");
    const rated = await alice.client
      .from("interview_answers")
      .update({ rating: "strong" })
      .eq("question_id", questionId);
    expect(rated.error?.code).toBe("42501");
  });

  it("an answer cannot be attached to another user's question", async () => {
    const bobSession = await session(bob);
    const { error } = await admin
      .from("interview_answers")
      .insert(answerRow(bob, bobSession, questionId));
    expect(error?.code).toBe("23503");
  });

  it("are private", async () => {
    for (const table of ["interview_sessions", "interview_questions", "interview_answers"] as const) {
      const { data } = await bob.client.from(table).select("id");
      expect(data?.map((row) => row.id)).not.toContain(sessionId);
      expect((await anonClient().from(table).select("id")).error?.code).toBe("42501");
    }
    const { data } = await bob.client
      .from("interview_answers")
      .select("id")
      .eq("session_id", sessionId);
    expect(data).toEqual([]);
  });

  it("stay readable if the application is deleted", async () => {
    const { data: temporary } = await alice.client
      .from("applications")
      .insert({ user_id: alice.id, company: "Gone", role_title: "Role" })
      .select("id")
      .single();
    const { data } = await admin
      .from("interview_sessions")
      .insert({
        user_id: alice.id,
        application_id: temporary!.id,
        company: "Gone",
        role_title: "Role",
        prompt_version: "v1",
        model: "test",
      })
      .select("id")
      .single();
    await alice.client.from("applications").delete().eq("id", temporary!.id);
    const { data: kept } = await alice.client
      .from("interview_sessions")
      .select("application_id, company")
      .eq("id", data!.id)
      .single();
    expect(kept).toEqual({ application_id: null, company: "Gone" });
  });

  it("deleting a session removes its questions and answers", async () => {
    const id = await session(alice);
    const q = await question(alice, id);
    await admin.from("interview_answers").insert(answerRow(alice, id, q));
    expect((await alice.client.from("interview_sessions").delete().eq("id", id)).error).toBeNull();
    const { data } = await admin.from("interview_answers").select("id").eq("session_id", id);
    expect(data).toEqual([]);
  });

  it.each(["interview_questions", "interview_feedback"])(
    "the AI budget accepts %s",
    async (feature) => {
      const { error } = await admin.rpc("reserve_ai_call", {
        p_user_id: alice.id,
        p_feature: feature,
        p_model: "test",
        p_daily_limit: 100,
      });
      expect(error).toBeNull();
    },
  );
});

describe("notification delivery", () => {
  const mine = async (owner: TestUser) => {
    const { data } = await owner.client.from("notifications").select("*");
    return data ?? [];
  };

  beforeAll(async () => {
    await alice.client.from("application_reminders").insert({
      user_id: alice.id,
      application_id: applicationId,
      title: "Call back",
      due_on: today(),
    });
  });

  it("creates notifications from real records", async () => {
    const created = await deliverNotifications(alice.id);
    expect(created).toBe(1);
    const [notification] = await mine(alice);
    expect(notification).toMatchObject({ type: "follow_up", title: "Call back" });
    expect(notification.link).toBe(`/applications/${applicationId}`);
  });

  it("does not repeat itself on the next run", async () => {
    expect(await deliverNotifications(alice.id)).toBe(0);
    expect(await mine(alice)).toHaveLength(1);
  });

  it("is safe when runs overlap", async () => {
    await alice.client.from("application_reminders").insert({
      user_id: alice.id,
      application_id: applicationId,
      title: "Overlap",
      due_on: today(),
    });
    const results = await Promise.all([
      deliverNotifications(alice.id),
      deliverNotifications(alice.id),
      deliverNotifications(alice.id),
    ]);
    expect(results.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect((await mine(alice)).filter((n) => n.title === "Overlap")).toHaveLength(1);
  });

  it("does not bring back a dismissed notification", async () => {
    const [notification] = await mine(alice);
    await alice.client
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", notification.id);
    expect(await deliverNotifications(alice.id)).toBe(0);
  });

  it("honours a preference that is turned off", async () => {
    await bob.client.from("user_preferences").update({ notify_follow_ups: false }).eq("user_id", bob.id);
    const { data } = await bob.client
      .from("applications")
      .insert({ user_id: bob.id, company: "B", role_title: "R", status: "applied", applied_at: "2026-01-01" })
      .select("id")
      .single();
    await bob.client.from("application_reminders").insert({
      user_id: bob.id,
      application_id: data!.id,
      title: "Muted",
      due_on: today(),
    });
    expect(await deliverNotifications(bob.id)).toBe(0);
    await bob.client.from("user_preferences").update({ notify_follow_ups: true }).eq("user_id", bob.id);
    expect(await deliverNotifications(bob.id)).toBeGreaterThan(0);
  });

  it("tells a user when a saved job closes", async () => {
    const job = await insertJob({ is_active: false, title: "Closed Role" });
    jobIds.push(job.id);
    await alice.client.from("saved_jobs").insert({ user_id: alice.id, job_id: job.id });
    await deliverNotifications(alice.id);
    expect((await mine(alice)).some((n) => n.dedupe_key === `job-closed:${job.id}`)).toBe(true);
  });

  it("finds new jobs for a target title", async () => {
    const title = `Specialist ${randomUUID().slice(0, 8)}`;
    await alice.client.from("user_preferences").update({ desired_titles: [title] }).eq("user_id", alice.id);
    const job = await insertJob({ title });
    jobIds.push(job.id);
    await deliverNotifications(alice.id);
    expect((await mine(alice)).some((n) => n.dedupe_key === `job-match:${job.id}`)).toBe(true);
  });

  it("records when it last checked", async () => {
    const { data } = await alice.client
      .from("user_preferences")
      .select("notifications_checked_at")
      .single();
    expect(data?.notifications_checked_at).not.toBeNull();
  });

  it("the same event is separate for each user", async () => {
    const draft = { type: "account" as const, dedupe_key: "same-key", title: "T", body: "", link: "/settings" };
    expect(await storeNotifications(alice.id, [draft])).toBe(1);
    expect(await storeNotifications(bob.id, [draft])).toBe(1);
    expect(await storeNotifications(bob.id, [draft])).toBe(0);
  });

  it("refuses a link that leaves the site", async () => {
    const stored = storeNotifications(alice.id, [
      { type: "account", dedupe_key: "bad-link", title: "T", body: "", link: "https://evil.example" },
    ]);
    await expect(stored).rejects.toThrow();
    const relative = storeNotifications(alice.id, [
      { type: "account", dedupe_key: "bad-link-2", title: "T", body: "", link: "//evil.example" },
    ]);
    await expect(relative).rejects.toThrow();
  });

  it("users can mark read and dismiss, but cannot forge, rewrite or delete", async () => {
    const [notification] = await mine(alice);
    const read = await alice.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id);
    expect(read.error).toBeNull();

    const forged = await alice.client.from("notifications").insert({
      user_id: alice.id,
      type: "account",
      title: "Fake",
      dedupe_key: "fake",
    });
    expect(forged.error?.code).toBe("42501");

    const rewritten = await alice.client
      .from("notifications")
      .update({ title: "Changed" })
      .eq("id", notification.id);
    expect(rewritten.error?.code).toBe("42501");

    const deleted = await alice.client.from("notifications").delete().eq("id", notification.id);
    expect(deleted.error?.code).toBe("42501");
  });

  it("are private", async () => {
    const [notification] = await mine(alice);
    const { data } = await bob.client.from("notifications").select("id").eq("id", notification.id);
    expect(data).toEqual([]);
    const update = await bob.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id)
      .select("id");
    expect(update.data).toEqual([]);
  });
});

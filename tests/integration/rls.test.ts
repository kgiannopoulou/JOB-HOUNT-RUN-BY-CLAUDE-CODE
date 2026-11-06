import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  insertJob,
  jobRow,
  testPassword,
  type Client,
  type TestUser,
} from "./helpers";

type Table = keyof Database["public"]["Tables"];

let alice: TestUser;
let bob: TestUser;
let admin: Client;
let jobId: string;
let privateJobId: string;
const ids: Record<string, string> = {};

/** The column that identifies each table's owner, and one of Alice's rows. */
const privateTables: { table: Table; owner: string; key: () => [string, string] }[] = [
  { table: "profiles", owner: "id", key: () => ["id", alice.id] },
  { table: "user_preferences", owner: "user_id", key: () => ["user_id", alice.id] },
  { table: "resumes", owner: "user_id", key: () => ["id", ids.resume] },
  { table: "job_matches", owner: "user_id", key: () => ["id", ids.match] },
  { table: "cover_letters", owner: "user_id", key: () => ["id", ids.letter] },
  { table: "applications", owner: "user_id", key: () => ["id", ids.application] },
  { table: "interview_sessions", owner: "user_id", key: () => ["id", ids.session] },
  { table: "interview_questions", owner: "user_id", key: () => ["id", ids.question] },
  { table: "notifications", owner: "user_id", key: () => ["id", ids.notification] },
  { table: "saved_jobs", owner: "user_id", key: () => ["user_id", alice.id] },
];

async function must<T>(query: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return data as NonNullable<T>;
}

beforeAll(async () => {
  admin = adminClient();
  [alice, bob] = await Promise.all([createUser("Alice Example"), createUser("Bob Example")]);
  jobId = (await insertJob()).id;
  privateJobId = (await insertJob({ created_by: alice.id })).id;

  const user_id = alice.id;
  const resume = await must(
    admin.from("resumes").insert({ user_id, title: "Alice CV" }).select().single(),
  );
  ids.resume = resume.id;
  const match = await must(
    admin
      .from("job_matches")
      .insert({
        user_id,
        job_id: jobId,
        resume_id: resume.id,
        score: 80,
        prompt_version: "v1",
        model: "test",
      })
      .select()
      .single(),
  );
  ids.match = match.id;
  const letter = await must(
    admin.from("cover_letters").insert({ user_id, content: "Dear team" }).select().single(),
  );
  ids.letter = letter.id;
  const application = await must(
    admin
      .from("applications")
      .insert({ user_id, company: "Acme", role_title: "Analyst" })
      .select()
      .single(),
  );
  ids.application = application.id;
  const session = await must(
    admin.from("interview_sessions").insert({ user_id }).select().single(),
  );
  ids.session = session.id;
  const question = await must(
    admin
      .from("interview_questions")
      .insert({ user_id, session_id: session.id, position: 0, question: "Why us?" })
      .select()
      .single(),
  );
  ids.question = question.id;
  const notification = await must(
    admin
      .from("notifications")
      .insert({ user_id, type: "info", title: "Hello" })
      .select()
      .single(),
  );
  ids.notification = notification.id;
  await must(admin.from("saved_jobs").insert({ user_id, job_id: jobId }).select());
});

afterAll(async () => {
  await Promise.all([deleteUser(alice), deleteUser(bob)]);
  await admin.from("jobs").delete().eq("provider", "test");
});

describe.each(privateTables)("$table", ({ table, key }) => {
  const rows = (client: Client) => {
    const [column, value] = key();
    return client.from(table).select("*").eq(column, value);
  };

  it("lets the owner read their row", async () => {
    const { data, error } = await rows(alice.client);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides the row from another user", async () => {
    const { data, error } = await rows(bob.client);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses signed-out visitors", async () => {
    const { data, error } = await rows(anonClient());
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("stops another user deleting the row", async () => {
    const [column, value] = key();
    await bob.client.from(table).delete().eq(column, value);
    expect((await rows(admin)).data).toHaveLength(1);
  });
});

describe("writing to another user's data", () => {
  it("stops another user changing a profile", async () => {
    await bob.client.from("profiles").update({ full_name: "Hacked" }).eq("id", alice.id);
    const { data } = await admin.from("profiles").select("full_name").eq("id", alice.id).single();
    expect(data?.full_name).toBe("Alice Example");
  });

  it("stops another user changing an application", async () => {
    await bob.client.from("applications").update({ notes: "Hacked" }).eq("id", ids.application);
    const { data } = await admin
      .from("applications")
      .select("notes")
      .eq("id", ids.application)
      .single();
    expect(data?.notes).toBe("");
  });

  it("stops a user creating rows in someone else's name", async () => {
    const attempts = await Promise.all([
      bob.client.from("resumes").insert({ user_id: alice.id, title: "Fake" }),
      bob.client.from("applications").insert({ user_id: alice.id, company: "X", role_title: "Y" }),
      bob.client.from("cover_letters").insert({ user_id: alice.id }),
      bob.client.from("interview_sessions").insert({ user_id: alice.id }),
      bob.client.from("saved_jobs").insert({ user_id: alice.id, job_id: privateJobId }),
    ]);
    for (const { error } of attempts) expect(error?.code).toBe("42501");
  });

  it("stops a user moving their own row to someone else", async () => {
    const { data: resume } = await bob.client
      .from("resumes")
      .insert({ user_id: bob.id, title: "Bob CV" })
      .select()
      .single();
    const { error } = await bob.client
      .from("resumes")
      .update({ user_id: alice.id })
      .eq("id", resume!.id);
    expect(error?.code).toBe("42501");
  });
});

describe("links between records", () => {
  it("stops an application pointing at another user's resume", async () => {
    const { error } = await bob.client.from("applications").insert({
      user_id: bob.id,
      company: "Acme",
      role_title: "Analyst",
      resume_id: ids.resume,
    });
    expect(error?.code).toBe("23503");
  });

  it("stops an application pointing at another user's cover letter", async () => {
    const { error } = await bob.client.from("applications").insert({
      user_id: bob.id,
      company: "Acme",
      role_title: "Analyst",
      cover_letter_id: ids.letter,
    });
    expect(error?.code).toBe("23503");
  });

  it("stops a question being added to another user's session", async () => {
    const { error } = await bob.client.from("interview_questions").insert({
      user_id: bob.id,
      session_id: ids.session,
      position: 9,
      question: "Injected",
    });
    expect(error?.code).toBe("23503");
  });

  it("allows only one application per job", async () => {
    const row = { user_id: bob.id, job_id: jobId, company: "A", role_title: "B" };
    expect((await bob.client.from("applications").insert(row)).error).toBeNull();
    expect((await bob.client.from("applications").insert(row)).error?.code).toBe("23505");
  });
});

describe("rows only the server may write", () => {
  it("stops users writing match scores", async () => {
    const { error } = await alice.client.from("job_matches").insert({
      user_id: alice.id,
      job_id: jobId,
      resume_id: ids.resume,
      score: 100,
      prompt_version: "fake",
      model: "fake",
    });
    expect(error?.code).toBe("42501");
  });

  it("stops users creating notifications", async () => {
    const { error } = await alice.client
      .from("notifications")
      .insert({ user_id: alice.id, type: "x", title: "Fake" });
    expect(error?.code).toBe("42501");
  });

  it("lets users mark a notification read, and change nothing else", async () => {
    const read = await alice.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", ids.notification);
    expect(read.error).toBeNull();

    const edit = await alice.client
      .from("notifications")
      .update({ title: "Changed" })
      .eq("id", ids.notification);
    expect(edit.error?.code).toBe("42501");
  });

  it("stops users creating or removing their own profile row", async () => {
    const insert = await bob.client.from("profiles").insert({ id: bob.id });
    expect(insert.error?.code).toBe("42501");
    const remove = await bob.client.from("profiles").delete().eq("id", bob.id);
    expect(remove.error?.code).toBe("42501");
  });

  it("hides sync history from everyone but the server", async () => {
    for (const client of [anonClient(), alice.client]) {
      const { error } = await client.from("job_sync_runs").select("*");
      expect(error?.code).toBe("42501");
    }
  });
});

describe("jobs", () => {
  it("lets anyone read public jobs", async () => {
    const { data } = await anonClient().from("jobs").select("id").eq("id", jobId);
    expect(data).toHaveLength(1);
  });

  it("shows a private job only to its creator", async () => {
    const read = (client: Client) =>
      client.from("jobs").select("id").eq("id", privateJobId);
    expect((await read(alice.client)).data).toHaveLength(1);
    expect((await read(bob.client)).data).toEqual([]);
    expect((await read(anonClient())).data).toEqual([]);
  });

  it("keeps private jobs out of search", async () => {
    const { data } = await bob.client.rpc("search_jobs", { p_limit: 50 });
    expect(data?.map((job) => job.id)).not.toContain(privateJobId);
  });

  it("stops users and visitors changing jobs", async () => {
    for (const client of [anonClient(), alice.client]) {
      const insert = await client.from("jobs").insert(jobRow());
      expect(insert.error?.code).toBe("42501");
      const update = await client.from("jobs").update({ title: "Fake" }).eq("id", jobId);
      expect(update.error?.code).toBe("42501");
      const remove = await client.from("jobs").delete().eq("id", jobId);
      expect(remove.error?.code).toBe("42501");
    }
  });
});

describe("accounts", () => {
  it("creates a profile and preferences at signup", async () => {
    const user = await createUser("Carol Example");
    const profile = await user.client.from("profiles").select("*").single();
    const preferences = await user.client.from("user_preferences").select("*").single();
    expect(profile.data?.full_name).toBe("Carol Example");
    expect(preferences.data?.user_id).toBe(user.id);
    await deleteUser(user);
  });

  it("lets a user update their own profile", async () => {
    const { error } = await bob.client
      .from("profiles")
      .update({ headline: "Analyst" })
      .eq("id", bob.id);
    expect(error).toBeNull();
    const { data } = await bob.client.from("profiles").select("headline").single();
    expect(data?.headline).toBe("Analyst");
  });

  it("removes all of a user's data with the account", async () => {
    const user = await createUser();
    await user.client.from("resumes").insert({ user_id: user.id, title: "CV" });
    await user.client.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
    await deleteUser(user);

    for (const table of ["resumes", "saved_jobs", "user_preferences"] as const) {
      const { data } = await admin.from(table).select("*").eq("user_id", user.id);
      expect(data).toEqual([]);
    }
    const { data } = await admin.from("profiles").select("*").eq("id", user.id);
    expect(data).toEqual([]);
  });
});

describe("authentication", () => {
  it("rejects a wrong password", async () => {
    const { error } = await anonClient().auth.signInWithPassword({
      email: alice.email,
      password: "wrong-password",
    });
    expect(error?.code).toBe("invalid_credentials");
  });

  it("accepts the right password", async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: alice.email,
      password: testPassword,
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBe(alice.id);
  });

  it("requires email confirmation before sign-in", async () => {
    const email = `unconfirmed-${Date.now()}@example.com`;
    const client = anonClient();
    const signUp = await client.auth.signUp({ email, password: testPassword });
    expect(signUp.data.session).toBeNull();

    const { error } = await client.auth.signInWithPassword({
      email,
      password: testPassword,
    });
    expect(error?.code).toBe("email_not_confirmed");
    await admin.auth.admin.deleteUser(signUp.data.user!.id);
  });

  it("enforces the minimum password length", async () => {
    const { error } = await anonClient().auth.signUp({
      email: `short-${Date.now()}@example.com`,
      password: "short",
    });
    expect(error?.code).toBe("weak_password");
  });

  it("loses access after signing out", async () => {
    const user = await createUser();
    await user.client.auth.signOut();
    const { error } = await user.client.from("profiles").select("*");
    expect(error?.code).toBe("42501");
    await deleteUser(user);
  });
});

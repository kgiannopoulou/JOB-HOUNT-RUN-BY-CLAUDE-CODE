import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { defaultLayout } from "@/lib/cv/document";
import { COVER_LETTER_PROMPT_VERSION } from "@/lib/letters/letter";
import type { Json } from "@/types/database";

import { sampleProfile } from "../fixtures/profile";
import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  insertJob,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let jobId: string;
let originalId: string;

const content = sampleProfile as unknown as NonNullable<Json>;

async function newVersion(owner: TestUser, parent: string | null) {
  const { data, error } = await owner.client
    .from("resumes")
    .insert({
      user_id: owner.id,
      title: "Tailored",
      kind: "version",
      parent_resume_id: parent,
      content,
      layout: defaultLayout() as unknown as NonNullable<Json>,
      parse_status: "needs_review",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const letterRow = (owner: TestUser) => ({
  user_id: owner.id,
  job_id: jobId,
  company: "Acme",
  role_title: "Analyst",
  tone: "warm",
  content: "Generated text",
  generated_content: "Generated text",
  prompt_version: COVER_LETTER_PROMPT_VERSION,
  model: "test-model",
});

async function newLetter(owner: TestUser) {
  const { data, error } = await owner.client
    .from("cover_letters")
    .insert(letterRow(owner))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([createUser("Alice Example"), createUser("Bob Example")]);
  jobId = (await insertJob()).id;
  const { data, error } = await alice.client
    .from("resumes")
    .insert({
      user_id: alice.id,
      title: "Original",
      content,
      parse_status: "ready",
      verified_at: new Date().toISOString(),
      extracted_text: "Original text",
    })
    .select("id")
    .single();
  if (error) throw error;
  originalId = data.id;
});

afterAll(async () => {
  await Promise.all([deleteUser(alice), deleteUser(bob)]);
  await adminClient().from("jobs").delete().eq("id", jobId);
});

describe("CV versions", () => {
  it("are separate rows, so editing one leaves the original alone", async () => {
    const id = await newVersion(alice, originalId);
    await alice.client
      .from("resumes")
      .update({ content: { ...sampleProfile, summary: "Changed" } })
      .eq("id", id);

    const { data } = await alice.client
      .from("resumes")
      .select("content")
      .eq("id", originalId)
      .single();
    expect(data?.content).toEqual(sampleProfile);
  });

  it("each saves independently", async () => {
    const [first, second] = [await newVersion(alice, originalId), await newVersion(alice, originalId)];
    expect(first).not.toBe(second);
  });

  it("can change template and layout, but only valid templates", async () => {
    const id = await newVersion(alice, originalId);
    const good = await alice.client.from("resumes").update({ template: "modern" }).eq("id", id);
    expect(good.error).toBeNull();
    const bad = await alice.client.from("resumes").update({ template: "neon" }).eq("id", id);
    expect(bad.error?.code).toBe("23514");
  });

  it("cannot be the main CV or hold a file", async () => {
    const id = await newVersion(alice, originalId);
    const primary = await alice.client.from("resumes").update({ is_primary: true }).eq("id", id);
    expect(primary.error?.code).toBe("23514");

    const file = await alice.client.from("resumes").insert({
      user_id: alice.id,
      title: "Bad",
      kind: "version",
      storage_path: "x/y.pdf",
    });
    expect(file.error?.code).toBe("23514");
  });

  it("keep the record of what the AI changed fixed", async () => {
    const id = await newVersion(alice, originalId);
    const { error } = await alice.client.from("resumes").update({ tailoring: {} }).eq("id", id);
    expect(error?.code).toBe("42501");
  });

  it("cannot change kind after creation", async () => {
    const { error } = await alice.client
      .from("resumes")
      .update({ kind: "version" })
      .eq("id", originalId);
    expect(error?.code).toBe("42501");
  });

  it("survive the deletion of their source and stay versions", async () => {
    const { data: source } = await alice.client
      .from("resumes")
      .insert({ user_id: alice.id, title: "Temporary" })
      .select("id")
      .single();
    const id = await newVersion(alice, source!.id);
    await alice.client.from("resumes").delete().eq("id", source!.id);

    const { data } = await alice.client
      .from("resumes")
      .select("kind, parent_resume_id")
      .eq("id", id)
      .single();
    expect(data).toEqual({ kind: "version", parent_resume_id: null });
  });

  it("are private, and cannot be built on someone else's CV", async () => {
    const id = await newVersion(alice, originalId);
    const read = await bob.client.from("resumes").select("id").eq("id", id);
    expect(read.data).toEqual([]);
    await expect(newVersion(bob, originalId)).rejects.toBeTruthy();
  });
});

describe("cover letters", () => {
  it("each generation is its own row", async () => {
    const [first, second] = [await newLetter(alice), await newLetter(alice)];
    expect(first).not.toBe(second);
  });

  it("can be edited and reviewed", async () => {
    const id = await newLetter(alice);
    const { error } = await alice.client
      .from("cover_letters")
      .update({ content: "Edited", is_edited: true, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    expect(error).toBeNull();
  });

  it.each([
    ["the generated text", { generated_content: "Rewritten" }],
    ["the company", { company: "Other" }],
    ["the removed sentences", { removed_sentences: [] }],
    ["the model", { model: "other" }],
  ])("keep %s fixed", async (_, change) => {
    const id = await newLetter(alice);
    const { error } = await alice.client.from("cover_letters").update(change).eq("id", id);
    expect(error?.code).toBe("42501");
  });

  it("accept only the known tones", async () => {
    const { error } = await alice.client
      .from("cover_letters")
      .insert({ ...letterRow(alice), tone: "aggressive" });
    expect(error?.code).toBe("23514");
  });

  it("have a length limit", async () => {
    const id = await newLetter(alice);
    const { error } = await alice.client
      .from("cover_letters")
      .update({ content: "x".repeat(8001) })
      .eq("id", id);
    expect(error?.code).toBe("23514");
  });

  it("stay readable if the job is removed", async () => {
    const job = await insertJob();
    const { data } = await alice.client
      .from("cover_letters")
      .insert({ ...letterRow(alice), job_id: job.id })
      .select("id")
      .single();
    await adminClient().from("jobs").delete().eq("id", job.id);

    const { data: letter } = await alice.client
      .from("cover_letters")
      .select("job_id, company, role_title")
      .eq("id", data!.id)
      .single();
    expect(letter).toEqual({ job_id: null, company: "Acme", role_title: "Analyst" });
  });

  it("are private to their owner", async () => {
    const id = await newLetter(alice);
    expect((await bob.client.from("cover_letters").select("id").eq("id", id)).data).toEqual([]);
    const remove = await bob.client.from("cover_letters").delete().eq("id", id).select("id");
    expect(remove.data).toEqual([]);
    expect((await anonClient().from("cover_letters").select("id")).error?.code).toBe("42501");
  });
});

describe("AI budget", () => {
  it.each(["cv_tailor", "cover_letter"])("accepts %s as a feature", async (feature) => {
    const { error } = await adminClient().rpc("reserve_ai_call", {
      p_user_id: alice.id,
      p_feature: feature,
      p_model: "test",
      p_daily_limit: 100,
    });
    expect(error).toBeNull();
  });
});

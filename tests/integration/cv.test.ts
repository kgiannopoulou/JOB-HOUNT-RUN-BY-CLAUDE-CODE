import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cvMimeTypes } from "@/lib/cv/upload";

import { makeDocx, makePdf, sampleCvLines } from "../fixtures/documents";
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
let resumeId: string;
let path: string;
let jobId: string;

const pdf = makePdf(sampleCvLines);
const upload = (client: Client, target: string, body: Uint8Array = pdf, contentType: string = cvMimeTypes.pdf) =>
  client.storage.from("cvs").upload(target, body, { contentType });

beforeAll(async () => {
  admin = adminClient();
  [alice, bob] = await Promise.all([createUser("Alice Example"), createUser("Bob Example")]);
  jobId = (await insertJob()).id;
  resumeId = randomUUID();
  path = `${alice.id}/${resumeId}/cv.pdf`;

  const stored = await upload(alice.client, path);
  if (stored.error) throw stored.error;
  const { error } = await alice.client.from("resumes").insert({
    id: resumeId,
    user_id: alice.id,
    title: "Alice CV",
    storage_path: path,
    file_name: "cv.pdf",
    file_type: "pdf",
    file_size: pdf.length,
    extracted_text: "Original text",
  });
  if (error) throw error;
});

afterAll(async () => {
  await admin.storage.from("cvs").remove([path]);
  await Promise.all([deleteUser(alice), deleteUser(bob)]);
  await admin.from("jobs").delete().eq("id", jobId);
});

describe("CV file storage", () => {
  it("is a private bucket with limits on size and type", async () => {
    const { data, error } = await admin.storage.getBucket("cvs");
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(4 * 1024 * 1024);
    expect(data?.allowed_mime_types).toEqual([cvMimeTypes.pdf, cvMimeTypes.docx]);
  });

  it("lets a user read their own file", async () => {
    const { data, error } = await alice.client.storage.from("cvs").download(path);
    expect(error).toBeNull();
    expect(data?.size).toBe(pdf.length);
  });

  it("accepts a DOCX", async () => {
    const target = `${alice.id}/${randomUUID()}/cv.docx`;
    const { error } = await upload(alice.client, target, makeDocx(sampleCvLines), cvMimeTypes.docx);
    expect(error).toBeNull();
    await admin.storage.from("cvs").remove([target]);
  });

  it("hides a file from other users", async () => {
    const download = await bob.client.storage.from("cvs").download(path);
    expect(download.data).toBeNull();
    const signed = await bob.client.storage.from("cvs").createSignedUrl(path, 60);
    expect(signed.data).toBeNull();
  });

  it("hides a file from signed-out visitors", async () => {
    const { data } = await anonClient().storage.from("cvs").download(path);
    expect(data).toBeNull();
  });

  it("gives no public address that works", async () => {
    const { data } = anonClient().storage.from("cvs").getPublicUrl(path);
    const response = await fetch(data.publicUrl);
    expect(response.ok).toBe(false);
  });

  it("stops a user writing into someone else's folder", async () => {
    const { error } = await upload(bob.client, `${alice.id}/${randomUUID()}/evil.pdf`);
    expect(error).not.toBeNull();
  });

  it("stops a user writing outside any user folder", async () => {
    const { error } = await upload(bob.client, "shared.pdf");
    expect(error).not.toBeNull();
  });

  it("stops a signed-out visitor uploading", async () => {
    const { error } = await upload(anonClient(), `${alice.id}/${randomUUID()}/evil.pdf`);
    expect(error).not.toBeNull();
  });

  it("keeps the original: a stored file cannot be overwritten", async () => {
    const replaced = await alice.client.storage
      .from("cvs")
      .upload(path, makePdf(["Replaced"]), { contentType: cvMimeTypes.pdf, upsert: true });
    expect(replaced.error).not.toBeNull();
    const { data } = await alice.client.storage.from("cvs").download(path);
    expect(data?.size).toBe(pdf.length);
  });

  it("stops another user deleting a file", async () => {
    await bob.client.storage.from("cvs").remove([path]);
    const { data } = await alice.client.storage.from("cvs").download(path);
    expect(data).not.toBeNull();
  });

  it("rejects other file types", async () => {
    const { error } = await upload(
      alice.client,
      `${alice.id}/${randomUUID()}/page.html`,
      new TextEncoder().encode("<script></script>"),
      "text/html",
    );
    expect(error).not.toBeNull();
  });

  it("rejects a file over the limit", async () => {
    const { error } = await upload(
      alice.client,
      `${alice.id}/${randomUUID()}/big.pdf`,
      new Uint8Array(4 * 1024 * 1024 + 1),
    );
    expect(error).not.toBeNull();
  });
});

describe("resumes", () => {
  it("lets a user correct the structured copy", async () => {
    const { error } = await alice.client
      .from("resumes")
      .update({ title: "Renamed", content: { skills: ["SQL"] } })
      .eq("id", resumeId);
    expect(error).toBeNull();
  });

  it.each([
    ["extracted_text", { extracted_text: "Changed" }],
    ["storage_path", { storage_path: "elsewhere" }],
    ["file_name", { file_name: "other.pdf" }],
    ["user_id", { user_id: randomUUID() }],
  ])("protects %s from being changed", async (_, change) => {
    const { error } = await alice.client.from("resumes").update(change).eq("id", resumeId);
    expect(error?.code).toBe("42501");
  });

  it("hides a CV from other users", async () => {
    const { data } = await bob.client.from("resumes").select("id").eq("id", resumeId);
    expect(data).toEqual([]);
  });
});

describe("server-written records", () => {
  const analysis = () => ({
    user_id: alice.id,
    resume_id: resumeId,
    profile_hash: randomUUID(),
    result: {},
    prompt_version: "v1",
    model: "test",
  });

  it("stops a user writing their own analysis", async () => {
    const { error } = await alice.client.from("cv_analyses").insert(analysis());
    expect(error?.code).toBe("42501");
  });

  it("stops a user writing their own match score", async () => {
    const { error } = await alice.client.from("job_matches").insert({
      user_id: alice.id,
      job_id: jobId,
      resume_id: resumeId,
      score: 100,
      prompt_version: "v1",
      model: "test",
    });
    expect(error?.code).toBe("42501");
  });

  it("rejects an analysis linked to another user's CV", async () => {
    const { error } = await admin.from("cv_analyses").insert({ ...analysis(), user_id: bob.id });
    expect(error?.code).toBe("23503");
  });

  it("rejects a score linked to another user's CV", async () => {
    const { error } = await admin.from("job_matches").insert({
      user_id: bob.id,
      job_id: jobId,
      resume_id: resumeId,
      score: 50,
      prompt_version: "v1",
      model: "test",
    });
    expect(error?.code).toBe("23503");
  });

  it("shows an analysis only to its owner, who can delete it", async () => {
    const { data, error } = await admin.from("cv_analyses").insert(analysis()).select().single();
    expect(error).toBeNull();

    const seen = await bob.client.from("cv_analyses").select("id").eq("id", data!.id);
    expect(seen.data).toEqual([]);
    const anon = await anonClient().from("cv_analyses").select("id");
    expect(anon.error?.code).toBe("42501");

    await alice.client.from("cv_analyses").delete().eq("id", data!.id);
    const left = await admin.from("cv_analyses").select("id").eq("id", data!.id);
    expect(left.data).toEqual([]);
  });

  it("replaces a match for the same job, CV and prompt version", async () => {
    const row = {
      user_id: alice.id,
      job_id: jobId,
      resume_id: resumeId,
      prompt_version: "upsert-test",
      model: "test",
    };
    const conflict = { onConflict: "job_id,resume_id,prompt_version" };
    await admin.from("job_matches").upsert({ ...row, score: 40 }, conflict);
    await admin.from("job_matches").upsert({ ...row, score: 60 }, conflict);

    const { data } = await admin
      .from("job_matches")
      .select("score")
      .eq("prompt_version", "upsert-test");
    expect(data).toEqual([{ score: 60 }]);
  });

  it("removes analyses and matches with their CV", async () => {
    const id = randomUUID();
    await admin.from("resumes").insert({ id, user_id: alice.id, title: "Temporary" });
    await admin.from("cv_analyses").insert({ ...analysis(), resume_id: id });
    await admin.from("job_matches").insert({
      user_id: alice.id,
      job_id: jobId,
      resume_id: id,
      score: 50,
      prompt_version: "v1",
      model: "test",
    });

    await alice.client.from("resumes").delete().eq("id", id);

    const analyses = await admin.from("cv_analyses").select("id").eq("resume_id", id);
    const matches = await admin.from("job_matches").select("id").eq("resume_id", id);
    expect(analyses.data).toEqual([]);
    expect(matches.data).toEqual([]);
  });
});

describe("AI budget", () => {
  const reserve = (client: Client, userId: string, limit: number) =>
    client.rpc("reserve_ai_call", {
      p_user_id: userId,
      p_feature: "job_match",
      p_model: "test",
      p_daily_limit: limit,
    });

  it("cannot be called by users, so they cannot spend or reset it", async () => {
    const { error } = await alice.client.rpc("reserve_ai_call", {
      p_user_id: alice.id,
      p_feature: "job_match",
      p_model: "test",
      p_daily_limit: 1000,
    });
    expect(error?.code).toBe("42501");
  });

  it("cannot be edited by users", async () => {
    const insert = await alice.client
      .from("ai_usage")
      .insert({ user_id: alice.id, feature: "job_match", model: "test" });
    expect(insert.error?.code).toBe("42501");
    const remove = await alice.client.from("ai_usage").delete().eq("user_id", alice.id);
    expect(remove.error?.code).toBe("42501");
  });

  it("refuses calls past the limit", async () => {
    const user = await createUser();
    const first = await reserve(admin, user.id, 2);
    const second = await reserve(admin, user.id, 2);
    const third = await reserve(admin, user.id, 2);
    expect(first.data).toBeTruthy();
    expect(second.data).toBeTruthy();
    expect(third.data).toBeNull();
    await deleteUser(user);
  });

  it("holds under parallel requests", async () => {
    const user = await createUser();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserve(admin, user.id, 3)),
    );
    expect(results.filter((result) => result.data).length).toBe(3);
    await deleteUser(user);
  });

  it("counts failed calls, because they can still be billed", async () => {
    const user = await createUser();
    const { data } = await reserve(admin, user.id, 1);
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", data!);
    expect((await reserve(admin, user.id, 1)).data).toBeNull();
    await deleteUser(user);
  });

  it("ignores calls older than 24 hours", async () => {
    const user = await createUser();
    const { data } = await reserve(admin, user.id, 1);
    await admin
      .from("ai_usage")
      .update({ created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() })
      .eq("id", data!);
    expect((await reserve(admin, user.id, 1)).data).toBeTruthy();
    await deleteUser(user);
  });

  it("shows users their own usage only", async () => {
    const user = await createUser();
    await reserve(admin, user.id, 5);
    const own = await user.client.from("ai_usage").select("id");
    const other = await bob.client.from("ai_usage").select("id").eq("user_id", user.id);
    expect(own.data).toHaveLength(1);
    expect(other.data).toEqual([]);
    await deleteUser(user);
  });
});

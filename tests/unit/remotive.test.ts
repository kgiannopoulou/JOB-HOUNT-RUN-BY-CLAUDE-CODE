import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeRemotiveListing,
  remotiveProvider,
} from "@/server/jobs/providers/remotive";
import { ProviderError } from "@/server/jobs/types";

// The shape documented by Remotive. The content is made up for the test.
const listing = {
  id: 1749306,
  url: "https://remotive.com/remote-jobs/writing/freelance-copywriter-1749306",
  title: "Senior Copywriter",
  company_name: "Example Company ",
  company_logo: "https://remotive.com/job/1749306/logo",
  category: "Writing",
  tags: ["research", "excel"],
  job_type: "freelance",
  publication_date: "2026-11-02T20:01:00",
  candidate_required_location: "Europe, USA",
  salary: "$20k -$35k",
  description: "<p>Write &amp; edit.</p><script>alert(1)</script>",
};

function respondWith(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn(async () =>
    typeof body === "string"
      ? new Response(body, init)
      : Response.json(body, init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("normalizeRemotiveListing", () => {
  it("converts a listing to the common shape", () => {
    expect(normalizeRemotiveListing(listing)).toMatchObject({
      provider: "remotive",
      providerJobId: "1749306",
      title: "Senior Copywriter",
      company: "Example Company",
      sourceUrl: listing.url,
      description: "Write & edit.",
      locationRaw: "Europe, USA",
      locations: ["Europe", "United States"],
      remotePolicy: "remote",
      employmentType: "freelance",
      experienceLevel: "senior",
      category: "Writing",
      tags: ["research", "excel"],
      salaryText: "$20k -$35k",
      salaryAnnualMin: 20000,
      salaryAnnualMax: 35000,
      salaryCurrency: "USD",
      postedAt: "2026-11-02T20:01:00.000Z",
    });
  });

  it("keeps the original URL exactly", () => {
    expect(normalizeRemotiveListing(listing)?.sourceUrl).toBe(listing.url);
  });

  it("handles optional fields being empty", () => {
    expect(
      normalizeRemotiveListing({
        ...listing,
        job_type: "",
        salary: "",
        publication_date: "not a date",
        candidate_required_location: "",
      }),
    ).toMatchObject({
      employmentType: "unknown",
      salaryText: null,
      salaryAnnualMin: null,
      postedAt: null,
      locations: [],
    });
  });

  it("treats internships as intern level", () => {
    expect(
      normalizeRemotiveListing({
        ...listing,
        title: "Copywriter",
        job_type: "internship",
      })?.experienceLevel,
    ).toBe("intern");
  });

  it.each([
    ["no title", { ...listing, title: "  " }],
    ["no company", { ...listing, company_name: "" }],
    ["a non-web URL", { ...listing, url: "javascript:alert(1)" }],
    ["no ID", { ...listing, id: undefined }],
    ["something that is not a listing", "nonsense"],
  ])("rejects %s", (_name, value) => {
    expect(normalizeRemotiveListing(value)).toBeNull();
  });
});

describe("remotiveProvider.fetchJobs", () => {
  it("allows at most 4 requests a day, as its terms ask", () => {
    const perDay = (24 * 60 * 60 * 1000) / remotiveProvider.minSyncIntervalMs;
    expect(perDay).toBeLessThanOrEqual(4);
  });

  it("returns valid jobs and counts the ones it skipped", async () => {
    respondWith({ jobs: [listing, { id: "broken" }] });
    const result = await remotiveProvider.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("makes one request and never retries on a rate limit", async () => {
    const fetchMock = respondWith("slow down", {
      status: 429,
      headers: { "Retry-After": "120" },
    });
    const error = await remotiveProvider.fetchJobs().catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 120 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a server error", async () => {
    respondWith("down", { status: 503 });
    await expect(remotiveProvider.fetchJobs()).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("failed"))));
    await expect(remotiveProvider.fetchJobs()).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it.each([
    ["not JSON", "<html>"],
    ["JSON without jobs", { message: "moved" }],
  ])("rejects a response that is %s", async (_name, body) => {
    respondWith(body);
    await expect(remotiveProvider.fetchJobs()).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
});

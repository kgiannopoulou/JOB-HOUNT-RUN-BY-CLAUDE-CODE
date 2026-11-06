import { createHash } from "node:crypto";

import { canonicalLocation } from "@/lib/locations";
import type { NormalizedJob } from "@/server/jobs/types";

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Stored descriptions are plain text, so provider HTML never reaches the page. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? match;
      const hex = entity[1].toLowerCase() === "x";
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ParsedSalary = {
  min: number;
  max: number;
  currency: string;
  annualMin: number;
  annualMax: number;
};

const periodsPerYear = { year: 1, month: 12, hour: 2080 } as const;

function readAmount(digits: string, hasK: boolean): number {
  let text = digits;
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    text = text.replace(/[.,]/g, ""); // 120,000 or 120.000
  } else {
    text = text.replace(",", "."); // 35,3k is the European way to write 35.3k
  }
  return Number(text) * (hasK ? 1000 : 1);
}

function readCurrency(text: string, fallback: string): string {
  if (text.includes("€") || /\beur\b/i.test(text)) return "EUR";
  if (text.includes("£") || /\bgbp\b/i.test(text)) return "GBP";
  if (text.includes("$") || /\busd\b/i.test(text)) return "USD";
  return fallback;
}

/**
 * Reads free-text salaries. Anything unclear returns null rather than a guess:
 * the original text is always kept and shown to the user.
 */
export function parseSalary(
  text: string | null | undefined,
  defaultCurrency = "USD",
): ParsedSalary | null {
  if (!text?.trim()) return null;
  if (/\b(task|project|word|article|commission|day|week|equity)\b/i.test(text)) {
    return null;
  }

  let period: keyof typeof periodsPerYear = "year";
  if (/\b(month|monthly|mo)\b/i.test(text)) period = "month";
  else if (/\b(hour|hourly|hr)\b|\/h\b/i.test(text)) period = "hour";

  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)*)\s*(k\b)?/gi)];
  if (matches.length === 0 || matches.length > 2) return null;

  const anyK = matches.some((match) => match[2]);
  const amounts = matches.map((match) => {
    const value = readAmount(match[1], Boolean(match[2]));
    // In "70-80K" the K belongs to both numbers.
    return anyK && !match[2] && value < 1000 ? value * 1000 : value;
  });

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const annualMin = min * periodsPerYear[period];
  const annualMax = max * periodsPerYear[period];
  if (!(annualMin >= 1000 && annualMax <= 5_000_000)) return null;

  return {
    min,
    max,
    currency: readCurrency(text, defaultCurrency),
    annualMin,
    annualMax,
  };
}

/** Most providers give no level, so it is read from the title, or left unknown. */
export function inferExperienceLevel(
  title: string,
): NormalizedJob["experienceLevel"] {
  if (/\b(intern|internship|trainee)\b/i.test(title)) return "intern";
  if (/\b(junior|jr\.?|entry[- ]level|graduate)\b/i.test(title)) return "entry";
  if (/\b(lead|principal|staff|head of|director|vp)\b/i.test(title)) return "lead";
  if (/\b(senior|sr\.?)(?=\s|$|,)/i.test(title)) return "senior";
  if (/\b(mid[- ]level|intermediate)\b/i.test(title)) return "mid";
  return "unknown";
}

export function parseLocations(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[,;/|]|\bor\b|\band\b/i)
    .map((part) => part.trim())
    .filter((part) => part && !/time ?zones?/i.test(part));
  return [...new Set(parts.map(canonicalLocation))];
}

function comparable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\((remote|hybrid|on-?site)\)|[-–|]\s*(remote|hybrid|on-?site)\s*$/g, " ")
    .replace(/\b(inc|llc|ltd|limited|gmbh|corp|corporation|co)\b\.?/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The same job listed twice, by any provider, gets the same fingerprint. */
export function jobFingerprint(
  job: Pick<NormalizedJob, "company" | "title" | "locations">,
): string {
  const key = [
    comparable(job.company),
    comparable(job.title),
    [...job.locations].map(comparable).sort().join(","),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

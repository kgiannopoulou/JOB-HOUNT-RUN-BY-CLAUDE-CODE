import type { CvProfile } from "@/lib/cv/profile";

/**
 * Plain string checks against the source text. A model can claim anything, so
 * these decide what is treated as supported, not the model.
 */

/** Lower case, no accents or punctuation, single spaces. Survives PDF line breaks. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/(^|\s)\.+|\.+(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole-word search, so "Java" is not found inside "JavaScript". */
export function containsPhrase(normalizedSource: string, phrase: string): boolean {
  const target = normalizeForMatch(phrase);
  return target !== "" && ` ${normalizedSource} `.includes(` ${target} `);
}

/** Every piece of text in a profile, including contact details if present. */
export function profileText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(profileText).join("\n");
  if (value && typeof value === "object") {
    return Object.values(value).map(profileText).join("\n");
  }
  return "";
}

export type UngroundedField = { section: string; value: string };

/**
 * Lists extracted values that do not appear in the file's text, so the review
 * screen can ask the user to look at them first. Dates are skipped because they
 * are reformatted on purpose.
 */
export function findUngrounded(profile: CvProfile, sourceText: string): UngroundedField[] {
  const source = normalizeForMatch(sourceText);
  const flagged: UngroundedField[] = [];
  const check = (section: string, value: string) => {
    if (value && !containsPhrase(source, value)) flagged.push({ section, value });
  };

  check("Contact", profile.contact.full_name);
  check("Contact", profile.contact.email);
  check("Contact", profile.contact.phone);
  check("Contact", profile.contact.location);
  profile.contact.links.forEach((link) => check("Contact", link));
  for (const role of profile.experience) {
    check("Experience", role.title);
    check("Experience", role.company);
  }
  for (const entry of profile.education) {
    check("Education", entry.institution);
    check("Education", entry.qualification);
  }
  profile.skills.forEach((skill) => check("Skills", skill));
  for (const certification of profile.certifications) {
    check("Certifications", certification.name);
  }
  for (const language of profile.languages) check("Languages", language.name);
  return flagged;
}

const COMMON_WORDS = new Set(
  "a an and as at by for from he her his i in is it my of on or our she the their they to we with".split(" "),
);

/**
 * Finds numbers and capitalised words in generated text that the profile does
 * not contain. Those are the likely places for an invented employer, date or
 * qualification, so the page asks the user to check them.
 */
export function unsupportedTerms(generated: string, profile: unknown): string[] {
  const source = normalizeForMatch(profileText(profile));
  const sentenceStart = /(^|[.!?:]\s+)$/;
  const terms = new Set<string>();

  for (const match of generated.matchAll(/\p{Lu}[\p{L}\p{N}+#.-]*|\d[\d.,]*\+?/gu)) {
    const word = match[0].replace(/[.,-]+$/, "");
    const isNumber = /^\d/.test(word);
    if (!isNumber && sentenceStart.test(generated.slice(0, match.index))) continue;
    if (COMMON_WORDS.has(word.toLowerCase())) continue;
    if (!containsPhrase(source, word.replace(/\+$/, ""))) terms.add(word);
  }
  return [...terms];
}

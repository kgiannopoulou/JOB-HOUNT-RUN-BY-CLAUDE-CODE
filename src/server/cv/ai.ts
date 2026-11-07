import "server-only";

import {
  buildCvAnalysis,
  cvAnalysisOutputSchema,
  type CvAnalysisResult,
} from "@/lib/cv/analysis";
import {
  cvProfileSchema,
  dropInvalidDates,
  normalizeProfile,
  profileWithoutContact,
  type CvProfile,
} from "@/lib/cv/profile";
import { generateStructured, untrusted } from "@/server/ai/gateway";

const EXTRACT_SYSTEM = `You convert the text of a CV into structured data.

Rules:
- Copy facts exactly as the CV states them. Never add, infer, improve or complete anything.
- If the CV does not state something, use an empty string or an empty list.
- Keep employer names, job titles, qualifications and skills in the CV's own words and language.
- A skill goes in skills only if the CV names it. Do not derive skills from duties.
- The summary field holds the CV's own summary or profile statement, unchanged, or is empty.
- Put each role's duties and achievements in its description, keeping the original wording.
- Write dates as YYYY-MM, or YYYY if the CV gives only a year. Convert month names. Leave a date empty if it is unclear.
- Set is_current to true only if the CV says the role is ongoing, for example "Present".`;

export async function extractProfile(userId: string, text: string) {
  const { output } = await generateStructured({
    feature: "cv_extract",
    userId,
    system: EXTRACT_SYSTEM,
    parts: [{ text: untrusted("cv", text) }],
    schema: cvProfileSchema,
    effort: "low",
  });
  return normalizeProfile(dropInvalidDates(output));
}

const ANALYSIS_SYSTEM = `You review CVs for job seekers. You are honest, specific and practical.

Rules:
- Base every statement only on the profile you are given. It has been checked by its owner.
- Never invent or imply qualifications, employers, dates, numbers, skills or achievements.
- Each strength's evidence must be words copied exactly from the profile.
- improved_summary may only reword facts in the profile. It must add no new facts, numbers, tools or claims. Write it in the profile's language, in 2 to 4 sentences.
- Where a suggestion needs a fact you do not have, such as a metric, tell the user to add their real figure. Never write an example figure that could be copied as true.
- missing_information lists things an employer would expect that the profile lacks.
- keywords are terms an employer in this field would search for. Include some the profile already uses and some it lacks, and say that a missing term should be added only if it is true for the user.
- Give at most 6 items in each list, most useful first.`;

export async function analyseProfile(
  userId: string,
  profile: CvProfile,
  targetRoles: string[],
): Promise<{ result: CvAnalysisResult; model: string }> {
  const roles = targetRoles.length
    ? `The user is looking for these roles: ${targetRoles.join(", ")}.`
    : "The user has not named target roles, so judge the CV for the field it shows.";

  const { output, model } = await generateStructured({
    feature: "cv_analysis",
    userId,
    system: ANALYSIS_SYSTEM,
    parts: [
      { text: roles },
      { text: untrusted("verified-profile", JSON.stringify(profileWithoutContact(profile))) },
    ],
    schema: cvAnalysisOutputSchema,
    effort: "medium",
  });
  return { result: buildCvAnalysis(output, profile, new Date()), model };
}

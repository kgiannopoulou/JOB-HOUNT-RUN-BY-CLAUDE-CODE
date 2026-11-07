import "server-only";

import { profileWithoutContact, type CvProfile } from "@/lib/cv/profile";
import { matchOutputSchema } from "@/lib/matching/schema";
import { generateStructured, untrusted } from "@/server/ai/gateway";

const SYSTEM = `You compare a candidate's verified CV profile with one job description. You report what each text says. You do not give any score, percentage or chance of being hired.

Requirements:
- List every distinct requirement in the job: skills, experience, education, certifications, languages, responsibilities and seniority.
- job_quote must be words copied exactly from the job text, in one unbroken run.
- importance is mandatory if the job says required, must, essential or similar, or lists it under requirements. It is preferred if the job says nice to have, a plus, ideally or similar. Use preferred when unclear.
- For years of experience, set min_years and years_scope. Use total only for general work experience, not experience in one tool or field.

Assessment:
- status is met only if the profile clearly shows it, partial if it shows something related or less than asked, otherwise not_met.
- candidate_evidence must be words copied exactly from the profile, in one unbroken run. If you cannot quote the profile, use not_met and leave it empty.
- Never assume the candidate has something because it is common for their role. Never invent or imply anything about the candidate.
- Each strength's evidence must be words copied exactly from the profile.
- recommendations must be honest ways to present what is true, or real gaps to close. Never suggest claiming something the profile does not show.
- Give at most 5 strengths, 5 concerns and 5 recommendations. Write the summary in 2 or 3 sentences, and do not state a percentage or predict the outcome of an application.`;

export type MatchJob = {
  title: string;
  company: string;
  description: string;
  experience_level: string;
  tags: string[];
};

/** The text that requirement quotes are checked against. */
export function jobSourceText(job: MatchJob) {
  return [job.title, job.description, job.tags.join(", ")].join("\n");
}

export async function compareProfileToJob(userId: string, profile: CvProfile, job: MatchJob) {
  return generateStructured({
    feature: "job_match",
    userId,
    system: SYSTEM,
    // The profile comes first, so comparing it with several jobs reuses the cache.
    parts: [
      {
        text: untrusted("verified-profile", JSON.stringify(profileWithoutContact(profile))),
        cache: true,
      },
      {
        text: untrusted(
          "job-description",
          `Company: ${job.company}\nStated level: ${job.experience_level}\n${jobSourceText(job)}`,
        ),
      },
    ],
    schema: matchOutputSchema,
    effort: "medium",
  });
}

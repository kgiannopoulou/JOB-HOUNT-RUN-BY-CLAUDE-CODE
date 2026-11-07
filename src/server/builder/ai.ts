import "server-only";

import { profileWithoutContact, type CvProfile } from "@/lib/cv/profile";
import { applyTailoring, tailorOutputSchema } from "@/lib/cv/tailor";
import { generateStructured, untrusted } from "@/server/ai/gateway";
import { jobSourceText, type MatchJob } from "@/server/matching/ai";

const SYSTEM = `You help a candidate present their verified CV for one job. You change wording and order only. You never add to what the candidate has done.

Rules:
- Use only facts in the verified profile. Never add a skill, tool, employer, title, date, number, responsibility, result or qualification that it does not state.
- A skill the job asks for and the profile lacks stays out. Do not hint at it, and do not say the candidate is learning it or familiar with it.
- Never make something sound bigger than the profile states. "Helped with" must not become "led".
- Do not move a fact from one role to another. Each description may use only what that role already says.
- Where the job and the profile mean the same thing, prefer the job's wording, but only if it is still accurate.
- summary is the profile's summary reworded for this job, in 2 to 4 sentences. Leave it empty if the profile has none.
- role_descriptions has one item for each role worth rewording. Keep every fact in it. Keep line breaks between points. Write in the same language as the profile.
- skills_first lists skills copied exactly from the profile, most relevant first.
- job_keywords lists at most 15 terms, copied from the job, whether or not the profile has them.`;

export async function tailorProfile(userId: string, profile: CvProfile, job: MatchJob) {
  const { output, model } = await generateStructured({
    feature: "cv_tailor",
    userId,
    system: SYSTEM,
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
    schema: tailorOutputSchema,
    effort: "medium",
  });
  return { result: applyTailoring(profile, output, job.tags), model };
}

import "server-only";

import { profileWithoutContact, type CvProfile } from "@/lib/cv/profile";
import {
  buildLetter,
  letterOutputSchema,
  toneDetails,
  type LetterTone,
} from "@/lib/letters/letter";
import { AiError, generateStructured, untrusted } from "@/server/ai/gateway";
import { jobSourceText, type MatchJob } from "@/server/matching/ai";

const SYSTEM = `You write cover letters for a candidate, from their verified CV profile and one job description.

Rules:
- Use only facts in the verified profile. Never invent or imply a skill, tool, employer, title, date, number, result or qualification.
- A requirement the profile does not show is left out. Do not claim it, hint at it, or say the candidate is learning it.
- Never make something sound bigger than the profile states.
- You may say why the role fits the candidate's stated experience. Do not invent facts about the company, its products or its values, or claim the candidate admires it.
- Name the company and the position in the first paragraph, exactly as given.
- Do not invent the name of a recruiter or hiring manager.
- Do not write the candidate's name, address or a date. They are added separately.
- Write in the language of the job description.
- Write 3 or 4 short paragraphs, under 300 words in all, in plain sentences with no lists.
- job_keywords lists at most 15 terms, copied from the job, whether or not the profile has them.`;

type LetterRequest = {
  userId: string;
  profile: CvProfile;
  job: MatchJob;
  tone: LetterTone;
};

export async function generateLetter({ userId, profile, job, tone }: LetterRequest) {
  const { output, model } = await generateStructured({
    feature: "cover_letter",
    userId,
    system: SYSTEM,
    parts: [
      {
        text: untrusted("verified-profile", JSON.stringify(profileWithoutContact(profile))),
        cache: true,
      },
      {
        text: `${untrusted(
          "job-description",
          `Company: ${job.company}\nPosition: ${job.title}\n${jobSourceText(job)}`,
        )}\n\nTone: ${toneDetails[tone].instruction}`,
      },
    ],
    schema: letterOutputSchema,
    effort: "medium",
  });

  const letter = buildLetter({
    output,
    profile,
    company: job.company,
    roleTitle: job.title,
    tags: job.tags,
  });
  // Every sentence failed the checks, so there is nothing honest to show.
  if (!letter.content) throw new AiError("invalid_output");
  return { letter, model };
}

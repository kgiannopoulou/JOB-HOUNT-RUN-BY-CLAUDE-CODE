import { Info } from "lucide-react";

/** Shown wherever questions appear, so practice is never mistaken for a prediction. */
export function SessionNotice({ hadJobText }: { hadJobText: boolean }) {
  return (
    <p role="note" className="flex gap-2 rounded-lg border p-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        These are practice questions, not a prediction. The real interview may be very
        different.{" "}
        {hadJobText
          ? "Questions about the employer come only from the job posting, the one verified source we hold about them."
          : "There is no job posting for this application, so there are no questions about the employer."}
      </span>
    </p>
  );
}

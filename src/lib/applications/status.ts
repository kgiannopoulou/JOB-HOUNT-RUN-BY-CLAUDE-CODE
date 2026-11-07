export const applicationStatuses = [
  "saved",
  "applied",
  "assessment",
  "interview",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

/**
 * Stages can be skipped and mistakes undone, but a job that was only saved cannot
 * be rejected, and an offer does not go back to the start. The database enforces
 * the same table: keep it in step with public.application_move_allowed.
 */
export const allowedMoves: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  saved: ["applied", "assessment", "interview", "offer"],
  applied: ["saved", "assessment", "interview", "offer", "rejected"],
  assessment: ["applied", "interview", "offer", "rejected"],
  interview: ["applied", "assessment", "offer", "rejected"],
  offer: ["interview", "rejected"],
  rejected: ["applied", "assessment", "interview", "offer"],
};

export const canMove = (from: ApplicationStatus, to: ApplicationStatus) =>
  allowedMoves[from].includes(to);

/**
 * The application date after a move. Leaving Saved records today unless a date
 * was given. Going back to Saved means it was never sent, so the date is cleared.
 */
export function appliedDateAfterMove(
  to: ApplicationStatus,
  current: string | null,
  today: string,
  chosen?: string,
): string | null {
  if (to === "saved") return null;
  return chosen || current || today;
}

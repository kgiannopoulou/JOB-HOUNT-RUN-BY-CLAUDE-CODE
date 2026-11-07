"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { interviewKindLabels, interviewKinds } from "@/lib/applications/schema";
import { allowedMoves, statusLabels, type ApplicationStatus } from "@/lib/applications/status";
import {
  addInterview,
  addReminder,
  moveApplication,
  updateApplication,
} from "@/server/applications/actions";

type StatusFormProps = {
  applicationId: string;
  status: ApplicationStatus;
  today: string;
};

export function StatusForm({ applicationId, status, today }: StatusFormProps) {
  return (
    <ActionForm
      key={status}
      action={moveApplication}
      submitLabel="Update status"
      pendingLabel="Updating…"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="from" value={status} />
      <SelectField
        label="Move to"
        name="to"
        options={allowedMoves[status].map((value) => ({ value, label: statusLabels[value] }))}
      />
      {status === "saved" && (
        <TextField label="Date applied" name="appliedAt" type="date" defaultValue={today} />
      )}
    </ActionForm>
  );
}

type Details = {
  company: string;
  role_title: string;
  applied_at: string | null;
  job_url: string | null;
  notes: string;
  recruiter_name: string;
  recruiter_email: string;
  recruiter_phone: string;
  offer_details: string;
  offer_deadline: string | null;
  rejection_reason: string;
  resume_id: string | null;
  cover_letter_id: string | null;
};

type DetailsFormProps = {
  applicationId: string;
  details: Details;
  resumes: { id: string; title: string; kind: string }[];
  letters: { id: string; company: string; role_title: string; created_at: string }[];
  status: ApplicationStatus;
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

export function DetailsForm({ applicationId, details, resumes, letters, status }: DetailsFormProps) {
  return (
    <ActionForm
      action={updateApplication}
      submitLabel="Save details"
      pendingLabel="Saving…"
      className="space-y-6"
    >
      <input type="hidden" name="applicationId" value={applicationId} />

      <Group title="Job">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company" name="company" defaultValue={details.company} maxLength={200} required />
          <TextField label="Position" name="role_title" defaultValue={details.role_title} maxLength={200} required />
          <TextField label="Date applied" name="applied_at" type="date" defaultValue={details.applied_at ?? ""} required={status !== "saved"} />
          <TextField label="Job link" name="job_url" type="url" defaultValue={details.job_url ?? ""} />
        </div>
        <TextAreaField label="Notes" name="notes" defaultValue={details.notes} rows={5} />
      </Group>

      <Group title="Recruiter">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Recruiter name" name="recruiter_name" defaultValue={details.recruiter_name} maxLength={200} />
          <TextField label="Recruiter email" name="recruiter_email" type="email" defaultValue={details.recruiter_email} maxLength={320} />
          <TextField label="Recruiter phone" name="recruiter_phone" type="tel" defaultValue={details.recruiter_phone} maxLength={50} />
        </div>
      </Group>

      <Group title="Documents sent">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="CV"
            name="resume_id"
            defaultValue={details.resume_id ?? ""}
            options={[
              { value: "", label: "Not recorded" },
              ...resumes.map((resume) => ({
                value: resume.id,
                label: resume.kind === "version" ? `Version: ${resume.title}` : resume.title,
              })),
            ]}
          />
          <SelectField
            label="Cover letter"
            name="cover_letter_id"
            defaultValue={details.cover_letter_id ?? ""}
            options={[
              { value: "", label: "Not recorded" },
              ...letters.map((letter) => ({
                value: letter.id,
                label: `${letter.role_title}, ${letter.company} (${letter.created_at.slice(0, 10)})`,
              })),
            ]}
          />
        </div>
      </Group>

      <Group title="Outcome">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label="Offer details" name="offer_details" defaultValue={details.offer_details} rows={3} maxLength={4000} />
          <TextAreaField label="Rejection reason" name="rejection_reason" defaultValue={details.rejection_reason} rows={3} maxLength={4000} />
          <TextField label="Offer deadline" name="offer_deadline" type="date" defaultValue={details.offer_deadline ?? ""} />
        </div>
      </Group>
    </ActionForm>
  );
}

export function InterviewForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm
      action={addInterview}
      submitLabel="Add interview"
      pendingLabel="Saving…"
      resetOnSuccess
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Date and time" name="scheduled_at" type="datetime-local" required />
        <SelectField
          label="Type"
          name="kind"
          options={interviewKinds.map((value) => ({ value, label: interviewKindLabels[value] }))}
        />
        <TextField label="Place or link" name="location" maxLength={500} />
        <TextField label="Interviewer" name="interviewer" maxLength={200} />
      </div>
      <TextAreaField label="Interview notes" name="notes" rows={2} maxLength={4000} />
    </ActionForm>
  );
}

export function ReminderForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm
      action={addReminder}
      submitLabel="Add reminder"
      pendingLabel="Saving…"
      resetOnSuccess
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Remind me to" name="title" maxLength={200} required />
        <TextField label="Due date" name="due_on" type="date" required />
      </div>
    </ActionForm>
  );
}

"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/form-fields";
import { letterTones, toneDetails } from "@/lib/letters/letter";
import { createCoverLetter } from "@/server/letters/actions";

type NewLetterFormProps = {
  cvs: { id: string; title: string }[];
  jobs: { id: string; title: string; company: string }[];
  selectedJob?: string;
};

export function NewLetterForm({ cvs, jobs, selectedJob }: NewLetterFormProps) {
  return (
    <ActionForm
      action={createCoverLetter}
      submitLabel="Generate letter"
      pendingLabel="Writing your letter…"
    >
      <SelectField
        label="Job"
        name="jobId"
        defaultValue={selectedJob}
        options={jobs.map((job) => ({ value: job.id, label: `${job.title}, ${job.company}` }))}
      />
      <SelectField
        label="CV"
        name="resumeId"
        options={cvs.map((cv) => ({ value: cv.id, label: cv.title }))}
      />
      <SelectField
        label="Tone"
        name="tone"
        options={letterTones.map((value) => ({ value, label: toneDetails[value].label }))}
      />
    </ActionForm>
  );
}

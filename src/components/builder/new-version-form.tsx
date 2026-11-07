"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/form-fields";
import { cvTemplates, templateDetails } from "@/lib/cv/document";
import { createCvVersion } from "@/server/builder/actions";

type NewVersionFormProps = {
  cvs: { id: string; title: string }[];
  jobs: { id: string; title: string; company: string }[];
  selectedJob?: string;
  aiReady: boolean;
};

export function NewVersionForm({ cvs, jobs, selectedJob, aiReady }: NewVersionFormProps) {
  return (
    <ActionForm
      action={createCvVersion}
      submitLabel="Create version"
      pendingLabel="Creating version…"
    >
      <SelectField
        label="Start from"
        name="resumeId"
        options={cvs.map((cv) => ({ value: cv.id, label: cv.title }))}
      />
      <SelectField
        label="Tailor for"
        name="jobId"
        defaultValue={selectedJob ?? ""}
        options={[
          { value: "", label: "No job: plain copy to customise" },
          ...(aiReady
            ? jobs.map((job) => ({ value: job.id, label: `${job.title}, ${job.company}` }))
            : []),
        ]}
      />
      <SelectField
        label="Template"
        name="template"
        options={cvTemplates.map((value) => ({ value, label: templateDetails[value].label }))}
      />
      <p className="text-xs text-muted-foreground">
        {aiReady
          ? "Tailoring sends your confirmed details, without your contact information, and the job to Anthropic. You review the result before it can be exported."
          : "AI features are not set up on this server yet, so you can make plain copies only."}
      </p>
    </ActionForm>
  );
}

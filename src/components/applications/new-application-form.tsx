"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { applicationStatuses, statusLabels } from "@/lib/applications/status";
import { createApplication } from "@/server/applications/actions";

export function NewApplicationForm() {
  return (
    <ActionForm
      action={createApplication}
      submitLabel="Add application"
      pendingLabel="Saving…"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Company" name="company" maxLength={200} required />
        <TextField label="Position" name="role_title" maxLength={200} required />
        <SelectField
          label="Status"
          name="status"
          defaultValue="applied"
          options={applicationStatuses.map((value) => ({ value, label: statusLabels[value] }))}
        />
        <TextField label="Date applied" name="applied_at" type="date" />
      </div>
      <p className="text-xs text-muted-foreground">
        If you leave the date empty, today is used for anything past Saved.
      </p>
      <TextField label="Job link" name="job_url" type="url" placeholder="https://" />
      <TextAreaField label="Notes" name="notes" rows={4} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="allowDuplicate" className="mt-0.5 size-4" />
        Add it anyway, even if I already track this role
      </label>
    </ActionForm>
  );
}

"use client";

import { useState } from "react";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/form-fields";
import {
  focusLabels,
  modeDetails,
  sessionFocuses,
  sessionModes,
  type SessionMode,
} from "@/lib/interview/questions";
import { createInterviewSession } from "@/server/interview/actions";

type NewSessionFormProps = {
  applications: { id: string; company: string; role_title: string }[];
  selected?: string;
};

export function NewSessionForm({ applications, selected }: NewSessionFormProps) {
  const [mode, setMode] = useState<SessionMode>("practice");

  return (
    <ActionForm
      action={createInterviewSession}
      submitLabel="Start session"
      pendingLabel="Writing your questions…"
    >
      <SelectField
        label="Application"
        name="applicationId"
        defaultValue={selected}
        options={applications.map((application) => ({
          value: application.id,
          label: `${application.role_title}, ${application.company}`,
        }))}
      />
      <SelectField
        label="Focus"
        name="focus"
        options={sessionFocuses.map((value) => ({ value, label: focusLabels[value] }))}
      />
      <div className="space-y-1">
        <SelectField
          label="Format"
          name="mode"
          value={mode}
          options={sessionModes.map((value) => ({ value, label: modeDetails[value].label }))}
          onChange={(event) => setMode(event.target.value as SessionMode)}
        />
        <p className="text-xs text-muted-foreground">{modeDetails[mode].hint}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Your confirmed CV details, without contact information, and the job posting are sent
        to Anthropic.
      </p>
    </ActionForm>
  );
}

"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, X } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { CvPreview } from "@/components/builder/cv-preview";
import { submitKeepingFields } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idleState } from "@/lib/action-state";
import {
  buildCvDocument,
  cvTemplates,
  MAX_CUSTOM_SECTIONS,
  templateDetails,
  type CvLayout,
  type CvLayoutSection,
  type CvTemplate,
} from "@/lib/cv/document";
import type { CvProfile } from "@/lib/cv/profile";
import { saveVersionLayout } from "@/server/builder/actions";

const templateOptions = cvTemplates.map((value) => ({
  value,
  label: templateDetails[value].label,
}));

type LayoutEditorProps = {
  resumeId: string;
  title: string;
  template: CvTemplate;
  layout: CvLayout;
  profile: CvProfile;
};

export function LayoutEditor({ resumeId, title, template, layout, profile }: LayoutEditorProps) {
  const [state, action, pending] = useActionState(saveVersionLayout, idleState);
  const [chosen, setChosen] = useState(template);
  const [sections, setSections] = useState(layout.sections);

  const change = (id: string, patch: Partial<CvLayoutSection>) =>
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );

  const move = (index: number, by: number) =>
    setSections((current) => {
      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(index + by, 0, section);
      return next;
    });

  const customCount = sections.filter((section) => section.kind === "custom").length;

  const addSection = () =>
    setSections((current) => [
      ...current,
      {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        kind: "custom",
        heading: "",
        visible: true,
        body: "",
      },
    ]);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <form action={action} onSubmit={submitKeepingFields(action)} className="min-w-0">
        <input type="hidden" name="resumeId" value={resumeId} />
        <input type="hidden" name="layout" value={JSON.stringify({ sections })} />
        <Card>
          <CardHeader>
            <CardTitle>Template and sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField label="Version name" name="title" defaultValue={title} maxLength={200} required />
            <div className="space-y-1">
              <SelectField
                label="Template"
                name="template"
                value={chosen}
                options={templateOptions}
                onChange={(event) => setChosen(event.target.value as CvTemplate)}
              />
              <p className="text-xs text-muted-foreground">{templateDetails[chosen].hint}</p>
            </div>

            <ul className="space-y-3">
              {sections.map((section, index) => {
                const name = section.heading || "New section";
                return (
                  <li key={section.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-end gap-1">
                      <div className="min-w-0 flex-1">
                        <TextField
                          label={section.kind === "custom" ? "Section heading" : `Heading: ${section.kind}`}
                          value={section.heading}
                          maxLength={60}
                          onChange={(event) => change(section.id, { heading: event.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${name} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${name} down`}
                        disabled={index === sections.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`${section.visible ? "Hide" : "Show"} ${name}`}
                        aria-pressed={!section.visible}
                        onClick={() => change(section.id, { visible: !section.visible })}
                      >
                        {section.visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                      </Button>
                      {section.kind === "custom" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${name}`}
                          onClick={() =>
                            setSections((current) => current.filter((s) => s.id !== section.id))
                          }
                        >
                          <X aria-hidden />
                        </Button>
                      )}
                    </div>
                    {section.kind === "custom" && (
                      <TextAreaField
                        label="Section text"
                        value={section.body}
                        rows={3}
                        maxLength={4000}
                        onChange={(event) => change(section.id, { body: event.target.value })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              variant="outline"
              disabled={customCount >= MAX_CUSTOM_SECTIONS}
              onClick={addSection}
            >
              <Plus data-icon="inline-start" /> Add a section
            </Button>

            <div aria-live="polite">{!pending && <FormMessage state={state} />}</div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save layout"}
            </Button>
          </CardContent>
        </Card>
      </form>

      <div className="min-w-0">
        <CvPreview cv={buildCvDocument(profile, { sections })} template={chosen} />
      </div>
    </div>
  );
}

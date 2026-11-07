"use client";

import { useActionState, useId, useState } from "react";
import { Plus, TriangleAlert, X } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import type { UngroundedField } from "@/lib/cv/grounding";
import type { CvProfile } from "@/lib/cv/profile";
import { saveVerifiedProfile } from "@/server/cv/actions";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
};

function Field({ label, value, onChange, placeholder, multiline, disabled }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          className="h-10"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <X aria-hidden />
    </Button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <Plus data-icon="inline-start" /> {label}
    </Button>
  );
}

const without = <T,>(list: T[], index: number) => list.filter((_, i) => i !== index);
const replaced = <T,>(list: T[], index: number, change: Partial<T>) =>
  list.map((item, i) => (i === index ? { ...item, ...change } : item));
const lines = (text: string) => text.split("\n");

type ReviewFormProps = {
  resumeId: string;
  initial: CvProfile;
  flagged: UngroundedField[];
  verified: boolean;
};

export function ReviewForm({ resumeId, initial, flagged, verified }: ReviewFormProps) {
  const [state, action, pending] = useActionState(saveVerifiedProfile, idleState);
  const [profile, setProfile] = useState(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join("\n"));
  const [linksText, setLinksText] = useState(initial.contact.links.join("\n"));

  const update = (change: Partial<CvProfile>) =>
    setProfile((current) => ({ ...current, ...change }));
  const contact = (change: Partial<CvProfile["contact"]>) =>
    update({ contact: { ...profile.contact, ...change } });

  const submitted: CvProfile = {
    ...profile,
    skills: lines(skillsText),
    contact: { ...profile.contact, links: lines(linksText) },
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="resumeId" value={resumeId} />
      <input type="hidden" name="profile" value={JSON.stringify(submitted)} />

      {flagged.length > 0 && (
        <div role="note" className="flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Check these first</p>
            <p className="text-muted-foreground">
              These values were not found word for word in your file:
            </p>
            <ul className="list-inside list-disc">
              {flagged.map((field) => (
                <li key={`${field.section}-${field.value}`}>
                  {field.section}: {field.value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={profile.contact.full_name} onChange={(full_name) => contact({ full_name })} />
          <Field label="Email" value={profile.contact.email} onChange={(email) => contact({ email })} />
          <Field label="Phone" value={profile.contact.phone} onChange={(phone) => contact({ phone })} />
          <Field label="Location" value={profile.contact.location} onChange={(location) => contact({ location })} />
          <div className="sm:col-span-2">
            <Field label="Links (one per line)" value={linksText} onChange={setLinksText} multiline />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Summary" value={profile.summary} onChange={(summary) => update({ summary })} multiline />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work experience</CardTitle>
          <CardDescription>Write dates as YYYY-MM or YYYY.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile.experience.map((role, index) => {
            const change = (value: Partial<typeof role>) =>
              update({ experience: replaced(profile.experience, index, value) });
            return (
              <fieldset key={index} className="space-y-3 border-b pb-6 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-medium">Role {index + 1}</legend>
                  <RemoveButton
                    label={`Remove role ${index + 1}`}
                    onClick={() => update({ experience: without(profile.experience, index) })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Job title" value={role.title} onChange={(title) => change({ title })} />
                  <Field label="Company" value={role.company} onChange={(company) => change({ company })} />
                  <Field label="Location" value={role.location} onChange={(location) => change({ location })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start" placeholder="2021-03" value={role.start_date} onChange={(start_date) => change({ start_date })} />
                    <Field label="End" placeholder="2023-06" value={role.is_current ? "" : role.end_date} disabled={role.is_current} onChange={(end_date) => change({ end_date })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={role.is_current}
                    onChange={(event) => change({ is_current: event.target.checked })}
                  />
                  I still work here
                </label>
                <Field label="Description" value={role.description} onChange={(description) => change({ description })} multiline />
              </fieldset>
            );
          })}
          <AddButton
            label="Add role"
            onClick={() =>
              update({
                experience: [
                  ...profile.experience,
                  { title: "", company: "", location: "", start_date: "", end_date: "", is_current: false, description: "" },
                ],
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Education</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile.education.map((entry, index) => {
            const change = (value: Partial<typeof entry>) =>
              update({ education: replaced(profile.education, index, value) });
            return (
              <fieldset key={index} className="space-y-3 border-b pb-6 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-medium">Education {index + 1}</legend>
                  <RemoveButton
                    label={`Remove education ${index + 1}`}
                    onClick={() => update({ education: without(profile.education, index) })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Institution" value={entry.institution} onChange={(institution) => change({ institution })} />
                  <Field label="Qualification" value={entry.qualification} onChange={(qualification) => change({ qualification })} />
                  <Field label="Field of study" value={entry.field} onChange={(field) => change({ field })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start" placeholder="2017" value={entry.start_date} onChange={(start_date) => change({ start_date })} />
                    <Field label="End" placeholder="2021" value={entry.end_date} onChange={(end_date) => change({ end_date })} />
                  </div>
                </div>
              </fieldset>
            );
          })}
          <AddButton
            label="Add education"
            onClick={() =>
              update({
                education: [
                  ...profile.education,
                  { institution: "", qualification: "", field: "", start_date: "", end_date: "" },
                ],
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Skills (one per line)" value={skillsText} onChange={setSkillsText} multiline />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certifications and languages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {profile.certifications.map((entry, index) => {
              const change = (value: Partial<typeof entry>) =>
                update({ certifications: replaced(profile.certifications, index, value) });
              return (
                <div key={index} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    <Field label="Certification" value={entry.name} onChange={(name) => change({ name })} />
                    <Field label="Issuer" value={entry.issuer} onChange={(issuer) => change({ issuer })} />
                    <Field label="Date" value={entry.date} onChange={(date) => change({ date })} />
                  </div>
                  <RemoveButton
                    label={`Remove certification ${index + 1}`}
                    onClick={() => update({ certifications: without(profile.certifications, index) })}
                  />
                </div>
              );
            })}
            <AddButton
              label="Add certification"
              onClick={() =>
                update({
                  certifications: [...profile.certifications, { name: "", issuer: "", date: "" }],
                })
              }
            />
          </div>
          <div className="space-y-3">
            {profile.languages.map((entry, index) => {
              const change = (value: Partial<typeof entry>) =>
                update({ languages: replaced(profile.languages, index, value) });
              return (
                <div key={index} className="flex items-end gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <Field label="Language" value={entry.name} onChange={(name) => change({ name })} />
                    <Field label="Level" value={entry.level} onChange={(level) => change({ level })} />
                  </div>
                  <RemoveButton
                    label={`Remove language ${index + 1}`}
                    onClick={() => update({ languages: without(profile.languages, index) })}
                  />
                </div>
              );
            })}
            <AddButton
              label="Add language"
              onClick={() => update({ languages: [...profile.languages, { name: "", level: "" }] })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <FormMessage state={state} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmed" required className="mt-0.5 size-4" />
          I have checked these details and they are accurate. Analysis and job
          matching will use only what is saved here.
        </label>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : verified ? "Save changes" : "Confirm details"}
        </Button>
      </div>
    </form>
  );
}

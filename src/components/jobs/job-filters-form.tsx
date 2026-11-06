import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";

import { MoreFilters } from "@/components/jobs/more-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  employmentOptions,
  experienceOptions,
  hasActiveFilters,
  remoteOptions,
  type JobFilters,
} from "@/lib/job-filters";

function TextFilter({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  list,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  list?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        list={list}
        className="h-10"
      />
    </div>
  );
}

function CheckboxGroup<T extends string>({
  legend,
  name,
  options,
  selected,
  hint,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  selected: T[];
  hint?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={selected.includes(option.value)}
            className="size-4 accent-primary"
          />
          {option.label}
        </label>
      ))}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}

type JobFiltersFormProps = {
  filters: JobFilters;
  locations: string[];
};

export function JobFiltersForm({ filters, locations }: JobFiltersFormProps) {
  const moreFilters = Boolean(
    filters.company ||
      filters.city ||
      filters.remote.length ||
      filters.type.length ||
      filters.level.length ||
      filters.minSalary,
  );

  return (
    <Form id="job-filters" action="/jobs" className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            <TextFilter
              id="title"
              name="title"
              label="Job title"
              defaultValue={filters.title}
              placeholder="Data analyst"
            />
            <TextFilter
              id="keywords"
              name="q"
              label="Keywords"
              defaultValue={filters.keywords}
              placeholder="Python, SQL"
            />
            <TextFilter
              id="country"
              name="country"
              label="Country or region"
              defaultValue={filters.country}
              placeholder="Greece"
              list="job-locations"
            />
            <datalist id="job-locations">
              {locations.map((location) => (
                <option key={location} value={location} />
              ))}
            </datalist>
          </div>

          <MoreFilters defaultOpen={moreFilters}>
              <TextFilter
                id="city"
                name="city"
                label="City"
                defaultValue={filters.city}
              />
              <TextFilter
                id="company"
                name="company"
                label="Company"
                defaultValue={filters.company}
              />
              <CheckboxGroup
                legend="Work arrangement"
                name="remote"
                options={remoteOptions}
                selected={filters.remote}
              />
              <CheckboxGroup
                legend="Employment type"
                name="type"
                options={employmentOptions}
                selected={filters.type}
              />
              <CheckboxGroup
                legend="Experience level"
                name="level"
                options={experienceOptions}
                selected={filters.level}
                hint="Read from the job title, so some jobs have no level."
              />
              <div className="space-y-2">
                <Label htmlFor="minSalary">Minimum yearly salary</Label>
                <Input
                  id="minSalary"
                  name="minSalary"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={filters.minSalary ?? ""}
                  aria-describedby="minSalary-hint"
                  className="h-10"
                />
                <p
                  id="minSalary-hint"
                  className="text-xs text-muted-foreground"
                >
                  Only jobs that state a salary. Amounts are not converted
                  between currencies.
                </p>
              </div>
          </MoreFilters>

          <div className="flex gap-2">
            <Button type="submit" size="lg" className="h-10 flex-1">
              <Search data-icon="inline-start" /> Search
            </Button>
            {hasActiveFilters(filters) && (
              <Button asChild variant="ghost" size="lg" className="h-10">
                <Link href="/jobs">Clear</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Form>
  );
}

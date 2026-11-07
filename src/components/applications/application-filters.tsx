import Link from "next/link";

import { SelectField, TextField } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import {
  applicationSorts,
  hasActiveFilters,
  sortLabels,
  type ApplicationFilters,
} from "@/lib/applications/filters";
import { applicationStatuses, statusLabels } from "@/lib/applications/status";

type ApplicationFiltersFormProps = {
  filters: ApplicationFilters;
  action: "/applications" | "/applications/list";
};

/** A plain GET form, so a filtered view has its own address and works without scripts. */
export function ApplicationFiltersForm({ filters, action }: ApplicationFiltersFormProps) {
  return (
    <form
      action={action}
      role="search"
      aria-label="Filter applications"
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]"
    >
      <TextField
        label="Search"
        name="q"
        type="search"
        defaultValue={filters.q}
        placeholder="Company, position, notes"
      />
      <SelectField
        label="Status"
        name="status"
        defaultValue={filters.status}
        options={[
          { value: "", label: "All" },
          ...applicationStatuses.map((value) => ({ value, label: statusLabels[value] })),
        ]}
      />
      <TextField label="Applied from" name="from" type="date" defaultValue={filters.from} />
      <TextField label="Applied to" name="to" type="date" defaultValue={filters.to} />
      <SelectField
        label="Sort by"
        name="sort"
        defaultValue={filters.sort}
        options={applicationSorts.map((value) => ({ value, label: sortLabels[value] }))}
      />
      <div className="flex gap-2">
        <Button type="submit" size="lg" variant="outline">
          Apply
        </Button>
        {hasActiveFilters(filters) && (
          <Button asChild size="lg" variant="ghost">
            <Link href={action}>Clear</Link>
          </Button>
        )}
      </div>
    </form>
  );
}

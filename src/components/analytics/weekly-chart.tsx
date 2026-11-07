import { formatDay } from "@/lib/applications/schema";
import type { WeeklyActivity } from "@/lib/analytics/summary";

type Measure = "saved" | "applied" | "interviews" | "practice";

const measures: { key: Measure; label: string }[] = [
  { key: "saved", label: "Jobs saved" },
  { key: "applied", label: "Applications sent" },
  { key: "interviews", label: "Interviews scheduled" },
  { key: "practice", label: "Practice sessions" },
];

const shortDay = (week: string) => formatDay(week).replace(/ \d{4}$/, "");

function Columns({ weekly, measure, label }: { weekly: WeeklyActivity[]; measure: Measure; label: string }) {
  const values = weekly.map((week) => week[measure]);
  const max = Math.max(...values);
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total} in 8 weeks</span>
      </figcaption>
      <div aria-hidden className="flex h-24 items-end gap-0.5 border-b">
        {weekly.map((week) => {
          const value = week[measure];
          return (
            <div key={week.week} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${max === 0 ? 0 : (value / max) * 100}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-xs text-popover-foreground shadow group-hover:block">
                {shortDay(week.week)}: {value}
              </span>
            </div>
          );
        })}
      </div>
      <p aria-hidden className="flex justify-between text-xs text-muted-foreground">
        <span>{shortDay(weekly[0].week)}</span>
        <span>{shortDay(weekly[weekly.length - 1].week)}</span>
      </p>
    </figure>
  );
}

/** One small chart per measure, so each keeps its own scale without a second axis. */
export function WeeklyChart({ weekly }: { weekly: WeeklyActivity[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {measures.map(({ key, label }) => (
          <Columns key={key} weekly={weekly} measure={key} label={label} />
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Weekly job search activity</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Week starting
                </th>
                {measures.map(({ key, label }) => (
                  <th key={key} scope="col" className="px-3 py-1 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekly.map((week) => (
                <tr key={week.week} className="border-b last:border-0">
                  <th scope="row" className="py-1 pr-3 font-normal whitespace-nowrap">
                    {shortDay(week.week)}
                  </th>
                  {measures.map(({ key }) => (
                    <td key={key} className="px-3 py-1 text-right tabular-nums">
                      {week[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

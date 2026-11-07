import { Progress } from "@/components/ui/progress";

type ScoreMeterProps = {
  label: string;
  /** Null means there was nothing to measure, which is different from zero. */
  value: number | null;
  hint?: string;
};

export function ScoreMeter({ label, value, hint }: ScoreMeterProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value === null ? "Not requested" : `${value}%`}
        </span>
      </div>
      {value !== null && (
        <Progress value={value} aria-label={`${label}: ${value}%`} className="h-1.5" />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

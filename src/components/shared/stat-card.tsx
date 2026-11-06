import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  /** Leave undefined until real data exists. Renders a dash, never a made-up number. */
  value?: string;
  hint: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-3xl font-semibold tracking-tight">
          {value ?? <span aria-label="No data yet">–</span>}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

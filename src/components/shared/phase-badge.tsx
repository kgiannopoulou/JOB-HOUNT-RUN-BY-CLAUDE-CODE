import { Badge } from "@/components/ui/badge";

/** Marks UI whose backend arrives in a later phase of docs/07-roadmap.md. */
export function PhaseBadge({ phase }: { phase: number }) {
  return <Badge variant="outline">Coming in Phase {phase}</Badge>;
}

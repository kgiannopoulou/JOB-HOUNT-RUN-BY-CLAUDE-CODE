"use client";

import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function JobsError({ retry }: { retry: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Jobs could not be loaded"
      description="Something went wrong on our side. Your saved jobs are safe."
    >
      <Button size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </EmptyState>
  );
}

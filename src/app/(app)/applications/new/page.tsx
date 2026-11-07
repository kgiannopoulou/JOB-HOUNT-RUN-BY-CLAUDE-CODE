import type { Metadata } from "next";
import Link from "next/link";

import { NewApplicationForm } from "@/components/applications/new-application-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth/user";

export const metadata: Metadata = { title: "Add application" };

export default async function NewApplicationPage() {
  await requireUser("/applications/new");

  return (
    <>
      <PageHeader
        title="Add application"
        description="For a job you found elsewhere. Jobs you save here are added for you."
      />
      <Button asChild variant="link" className="w-fit px-0">
        <Link href="/applications">Back to the board</Link>
      </Button>
      <Card className="max-w-2xl">
        <CardContent>
          <NewApplicationForm />
        </CardContent>
      </Card>
    </>
  );
}

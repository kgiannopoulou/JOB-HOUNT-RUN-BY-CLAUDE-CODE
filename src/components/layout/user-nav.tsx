import Link from "next/link";

import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/user";

export async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Button asChild variant="outline" size="lg">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  const name = String(user.user_metadata.full_name ?? "");
  return <UserMenu name={name} email={user.email ?? ""} />;
}

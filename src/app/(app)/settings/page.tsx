import type { Metadata } from "next";

import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const supabase = await createClient();

  const [profile, preferences] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (preferences.error) throw new Error(preferences.error.message);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, job preferences, appearance and data."
      />

      <Tabs defaultValue="profile" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Job preferences</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Signed in as {user.email}. Used on your CV and cover letters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={profile.data} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Job preferences</CardTitle>
              <CardDescription>
                Used to find roles and judge how well they suit you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreferencesForm preferences={preferences.data} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what JOB HUNT tells you about.</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettingsForm
                preferences={preferences.data}
                timeZones={["UTC", ...Intl.supportedValuesOf("timeZone")]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Saved in this browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <AppearanceSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Your data</CardTitle>
              <CardDescription>
                You will be able to download or permanently delete everything
                stored about you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhaseBadge phase={11} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="lg" disabled>
                  Download my data
                </Button>
                <Button variant="destructive" size="lg" disabled>
                  Delete account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

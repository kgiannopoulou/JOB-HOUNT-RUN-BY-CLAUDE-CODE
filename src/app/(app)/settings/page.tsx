import type { Metadata } from "next";

import { AppearanceSettings } from "@/components/settings/appearance-settings";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Settings" };

const profileFields = [
  { id: "full-name", label: "Full name" },
  { id: "headline", label: "Headline" },
  { id: "profile-location", label: "Location" },
  { id: "linkedin", label: "LinkedIn URL" },
];

const preferenceFields = [
  { id: "titles", label: "Target job titles" },
  { id: "pref-locations", label: "Preferred locations" },
  { id: "remote", label: "Remote policy" },
  { id: "salary", label: "Minimum salary" },
];

function DisabledFields({ fields }: { fields: typeof profileFields }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input id={field.id} className="h-10" disabled />
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, job preferences, appearance and data."
      />

      <Tabs defaultValue="appearance" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Job preferences</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Used on your CV and cover letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhaseBadge phase={3} />
              <DisabledFields fields={profileFields} />
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
            <CardContent className="space-y-4">
              <PhaseBadge phase={3} />
              <DisabledFields fields={preferenceFields} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Saved in this browser.
              </CardDescription>
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

import {
  BriefcaseBusiness,
  CircleCheck,
  CircleX,
  GraduationCap,
  ListChecks,
  TriangleAlert,
} from "lucide-react";

import { CopyButton } from "@/components/cv/copy-button";
import { ScoreMeter } from "@/components/shared/score-meter";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatExperience, type CvAnalysisResult } from "@/lib/cv/analysis";
import type { CvProfile } from "@/lib/cv/profile";

const priorityLabels = { high: "High priority", medium: "Medium priority", low: "Low priority" };

function Priority({ value }: { value: keyof typeof priorityLabels }) {
  return (
    <Badge variant={value === "high" ? "default" : "outline"}>{priorityLabels[value]}</Badge>
  );
}

type AnalysisDashboardProps = {
  result: CvAnalysisResult;
  profile: CvProfile;
};

export function AnalysisDashboard({ result, profile }: AnalysisDashboardProps) {
  const passed = result.checks.filter((check) => check.passed).length;

  return (
    <div className="space-y-6">
      <section aria-label="CV summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Completeness"
          value={`${result.completeness}%`}
          hint={`${passed} of ${result.checks.length} checks passed`}
          icon={ListChecks}
        />
        <StatCard
          label="Dated experience"
          value={formatExperience(result.experience_months)}
          hint={`${profile.experience.length} ${profile.experience.length === 1 ? "role" : "roles"} listed`}
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="Skills and education"
          value={`${profile.skills.length} / ${profile.education.length}`}
          hint="Skills listed / qualifications listed"
          icon={GraduationCap}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{result.overview}</p>
          <ScoreMeter
            label="Completeness"
            value={result.completeness}
            hint="Calculated from fixed checks. It measures what your CV includes, not how good it is."
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {result.strengths.map((strength) => (
                <li key={strength.title} className="space-y-1 text-sm">
                  <p className="font-medium">{strength.title}</p>
                  <p className="text-muted-foreground">{strength.detail}</p>
                  {strength.evidence_found ? (
                    <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground">
                      {strength.evidence}
                    </blockquote>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs">
                      <TriangleAlert className="size-3.5" aria-hidden />
                      Evidence not found in your CV. Treat this with care.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weaknesses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {result.weaknesses.map((weakness) => (
                <li key={weakness.title} className="space-y-1 text-sm">
                  <p className="font-medium">{weakness.title}</p>
                  <p className="text-muted-foreground">{weakness.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Missing information</CardTitle>
            <CardDescription>What an employer may expect to see.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {result.checks.map((check) => (
                <li key={check.label} className="flex gap-2">
                  {check.passed ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Passed" />
                  ) : (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Missing" />
                  )}
                  <span>
                    {check.label}
                    {!check.passed && (
                      <span className="block text-muted-foreground">{check.hint}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {result.missing_information.length > 0 && (
              <ul className="space-y-3 border-t pt-4">
                {result.missing_information.map((item) => (
                  <li key={item.item} className="space-y-1 text-sm">
                    <p className="font-medium">{item.item}</p>
                    <p className="text-muted-foreground">{item.why_it_matters}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested improvements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {result.improvements.map((item) => (
                <li key={`${item.section}-${item.suggestion}`} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.section}</p>
                    <Priority value={item.priority} />
                  </div>
                  <p className="text-muted-foreground">{item.suggestion}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Improved professional summary</CardTitle>
          <CardDescription>
            A rewording of your confirmed details. Your saved CV is not changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-lg bg-muted p-3 text-sm">{result.improved_summary}</p>
          {result.summary_terms_to_check.length > 0 && (
            <p role="note" className="flex gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Check before using. These are not in your CV:{" "}
                <strong>{result.summary_terms_to_check.join(", ")}</strong>
              </span>
            </p>
          )}
          <CopyButton text={result.improved_summary} label="Copy summary" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Relevant keywords</CardTitle>
            <CardDescription>
              Add a missing keyword only if it is true for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.keywords.map((keyword) => (
                <li key={keyword.term} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{keyword.term}</span>
                    <Badge variant={keyword.in_cv ? "secondary" : "outline"}>
                      {keyword.in_cv ? "In your CV" : "Not in your CV"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{keyword.reason}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended next steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {result.recommendations.map((item) => (
                <li key={item.action} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.action}</p>
                    <Priority value={item.priority} />
                  </div>
                  <p className="text-muted-foreground">{item.reason}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

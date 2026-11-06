import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileCheck2,
  FileSearch,
  Gauge,
  KanbanSquare,
  MessagesSquare,
  PenLine,
  Search,
} from "lucide-react";

import { HeroPreview } from "@/components/marketing/hero-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Search,
    title: "Find relevant roles",
    text: "Search job sources from one place, or paste any listing you find elsewhere.",
  },
  {
    icon: FileSearch,
    title: "Understand the job",
    text: "See the real requirements, seniority, salary and red flags at a glance.",
  },
  {
    icon: Gauge,
    title: "Know your fit",
    text: "Get a match score that shows its evidence and names the gaps.",
  },
  {
    icon: FileCheck2,
    title: "Tailor your CV",
    text: "Review suggested edits one by one and keep a version for each role.",
  },
  {
    icon: PenLine,
    title: "Write cover letters",
    text: "Draft a personal letter from your own experience, then make it yours.",
  },
  {
    icon: KanbanSquare,
    title: "Track applications",
    text: "See every application, what you sent, and what to do next.",
  },
  {
    icon: MessagesSquare,
    title: "Prepare for interviews",
    text: "Practise questions built from the job and your CV, with clear feedback.",
  },
  {
    icon: BarChart3,
    title: "Learn from your data",
    text: "See where applications stall and which skills keep coming up.",
  },
];

const steps = [
  {
    title: "Add your CV",
    text: "Upload it once and check the details we read from it.",
  },
  {
    title: "Find a role",
    text: "Search for jobs or paste one in, then see how well you match.",
  },
  {
    title: "Tailor and apply",
    text: "Adjust your CV and letter for the role, then apply yourself.",
  },
  {
    title: "Track and prepare",
    text: "Follow each application and practise before the interview.",
  },
];

const principles = [
  {
    title: "You send every application",
    text: "JOB HUNT never applies or contacts anyone for you.",
  },
  {
    title: "Nothing invented",
    text: "Generated text must come from your real experience. Unsupported claims are flagged for you to review.",
  },
  {
    title: "Scores you can check",
    text: "Every match score shows the evidence behind it, so you can disagree with it.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <Badge variant="secondary">In development</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Run your whole job search from one place.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            JOB HUNT finds roles, shows how well you fit, tailors your CV and
            cover letter, tracks every application and helps you prepare for
            the interview.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/register">
                Get started <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 px-5 text-base"
            >
              <Link href="/jobs">Browse jobs</Link>
            </Button>
          </div>
        </div>
        <HeroPreview />
      </section>

      <section id="features" className="scroll-mt-20 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
            Everything between the job ad and the offer
          </h2>
          <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-primary pt-4">
                <span className="text-sm font-medium text-primary">
                  Step {index + 1}
                </span>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="principles"
        className="scroll-mt-20 bg-primary text-primary-foreground"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
            AI does the reading. You make the decisions.
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {principles.map((principle) => (
              <li key={principle.title}>
                <h3 className="font-medium">{principle.title}</h3>
                <p className="mt-2 text-sm opacity-85">{principle.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Your next role deserves an organised search
        </h2>
        <Button asChild size="lg" className="mt-6 h-11 px-5 text-base">
          <Link href="/register">
            Get started <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    </>
  );
}

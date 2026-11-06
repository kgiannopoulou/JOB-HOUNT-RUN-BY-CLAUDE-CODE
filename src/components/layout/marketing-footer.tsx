import { Logo } from "@/components/layout/logo";
import { siteConfig } from "@/config/site";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
        <Logo className="text-foreground" />
        <p>An AI-powered job search platform, currently in development.</p>
        <a
          href={siteConfig.repositoryUrl}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-foreground"
        >
          View on GitHub
        </a>
      </div>
    </footer>
  );
}

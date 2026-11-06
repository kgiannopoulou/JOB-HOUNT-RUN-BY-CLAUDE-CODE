import { Check } from "lucide-react";

import { Logo } from "@/components/layout/logo";

const points = [
  "See how well you fit before you apply",
  "Tailor your CV without inventing anything",
  "Keep every application in one place",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="[&>span:first-child]:bg-primary-foreground [&>span:first-child]:text-primary" />
        <div>
          <p className="max-w-md text-3xl font-semibold tracking-tight text-balance">
            AI does the reading. You make the decisions.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check className="size-4 shrink-0" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <span />
      </aside>
      <main
        id="main"
        className="flex flex-col items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

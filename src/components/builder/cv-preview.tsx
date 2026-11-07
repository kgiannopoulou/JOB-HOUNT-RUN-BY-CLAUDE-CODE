import type { CvDocument, CvTemplate } from "@/lib/cv/document";
import { cn } from "@/lib/utils";

const themes: Record<CvTemplate, { page: string; header: string; heading: string }> = {
  classic: {
    page: "font-serif text-[13px] leading-snug",
    header: "text-center",
    heading: "border-b border-neutral-400 pb-0.5 font-bold text-neutral-900",
  },
  modern: {
    page: "font-sans text-[13px] leading-snug",
    header: "text-left",
    heading: "font-bold text-teal-700",
  },
  compact: {
    page: "font-sans text-[11px] leading-tight",
    header: "text-left",
    heading: "border-b border-neutral-400 font-bold text-neutral-900",
  },
};

type CvPreviewProps = { cv: CvDocument; template: CvTemplate };

/** A paper page, so it stays white in dark mode, like the PDF it stands for. */
export function CvPreview({ cv, template }: CvPreviewProps) {
  const theme = themes[template];
  return (
    <article
      aria-label="CV preview"
      className={cn(
        "space-y-3 rounded-lg border bg-white p-5 text-neutral-800 shadow-sm sm:p-8",
        theme.page,
      )}
    >
      <header className={theme.header}>
        <p className="text-xl font-bold text-neutral-900">{cv.name || "Your name"}</p>
        <p className="break-words text-neutral-600">{cv.contact.join(" | ")}</p>
      </header>
      {cv.sections.map((section) => (
        <section key={section.id} className="space-y-1.5">
          <h3 className={theme.heading}>{section.heading}</h3>
          {section.blocks.map((block, index) => (
            <div key={index}>
              {(block.title || block.dates) && (
                <div className="flex flex-wrap justify-between gap-x-3">
                  <p className="font-bold">{block.title}</p>
                  <p className="text-neutral-600">{block.dates}</p>
                </div>
              )}
              {block.subtitle && <p className="italic text-neutral-600">{block.subtitle}</p>}
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

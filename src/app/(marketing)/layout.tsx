import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="flex-1 overflow-x-clip">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}

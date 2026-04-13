import { WebsiteHeader } from "@/components/website/layout/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/layout/WebsiteFooter";

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WebsiteHeader />
      <main className="pt-16 font-[family-name:var(--font-manrope)]">
        {children}
      </main>
      <WebsiteFooter />
    </>
  );
}

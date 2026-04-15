import type { Metadata } from "next";
import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { Prose } from "@/components/website/ui/Prose";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "Learn how Localgrow ensures equal digital access for all users, including individuals with disabilities.",
};

export default function AccessibilityPage() {
  return (
    <>
      <Section>
        <Container size="narrow">
          <div className="mx-auto max-w-[880px]">
            {/* Hero */}
            <div className="mb-16 text-center">
              <h1 className="mb-6 font-[family-name:var(--font-manrope)] text-5xl font-light tracking-tight text-ws-text-heading md:text-6xl">
                Accessibility
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-ws-text-muted md:text-base">
                Localgrow Is Committed To Creating A Digital Experience
                That&apos;s Accessible To Everyone.
                <br className="hidden md:block" /> Learn How We Ensure Equal
                Access For All Users.
              </p>
            </div>

            {/* Commitment Box */}
            <div className="mb-16 rounded-r-2xl border-l-4 border-ws-primary-500 bg-ws-bg-warm p-8 md:p-10">
              <h2 className="mb-4 text-2xl font-normal text-ws-text-heading">
                Our Commitment
              </h2>
              <p className="text-base leading-relaxed text-ws-text-body">
                Localgrow is committed to providing a website and digital
                experience that is accessible to all users, including
                individuals with disabilities. We believe everyone deserves
                equal access to technology and the tools that power modern
                hospitality.
              </p>
            </div>

            {/* Content Sections */}
            <Prose className="text-ws-text-body">
              <div className="mb-24 space-y-12">
                <section>
                  <h2 className="mb-4 text-2xl font-normal text-ws-primary-700">
                    Standards We Follow
                  </h2>
                  <p className="text-base leading-relaxed text-ws-text-body">
                    We are actively working to align our website with the Web
                    Content Accessibility Guidelines (WCAG) 2.1 Level AA. These
                    guidelines help ensure that content is accessible to a wide
                    range of users, including those using assistive technologies
                    like screen readers, keyboard navigation, and alternative
                    input tools.
                  </p>
                </section>

                <section>
                  <h2 className="mb-4 text-2xl font-normal text-ws-primary-700">
                    What We&apos;re Doing
                  </h2>
                  <p className="mb-4 text-base leading-relaxed text-ws-text-body">
                    Our ongoing efforts include:
                  </p>
                  <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-ws-text-body marker:text-ws-text-muted">
                    <li>
                      Accessibility is an ongoing process, and we are
                      continuously working to identify and fix any barriers.
                    </li>
                    <li>Regular accessibility reviews and audits</li>
                    <li>Designing with readability and clarity in mind</li>
                    <li>
                      Ensuring proper color contrast and visual hierarchy
                    </li>
                    <li>Making interactive elements keyboard-friendly</li>
                    <li>Building a mobile-first, responsive experience</li>
                  </ul>
                </section>
              </div>
            </Prose>
          </div>
        </Container>
      </Section>

      <CTACard />
    </>
  );
}

import Image from "next/image";
import { Container } from "@/components/website/ui/Container";

function FeatureBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-full bg-[#d2d2d2] px-6 py-3 backdrop-blur-md">
      {icon}
      <span className="text-sm font-bold text-ws-text-heading">{label}</span>
    </div>
  );
}

export function GrowAgentValueProp() {
  return (
    <section className="bg-white py-24">
      <Container>
        <div className="grid grid-cols-1 items-center gap-16 md:gap-24 lg:grid-cols-2">
          {/* Left: text */}
          <div className="flex flex-col gap-8">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-ws-text-heading md:text-5xl">
              Get Discovered, Chosen, and Reordered. Managed by AI, Perfected by
              Experts.
            </h2>
            <p className="text-lg leading-relaxed text-ws-text-body">
              Deploy specialized AI Agents to take over your SEO, Social, and
              Delivery platforms, with industry veterans overseeing every
              strategic move.
            </p>
          </div>

          {/* Right: image with overlays */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            {/* Base image (desaturated) */}
            <Image
              src="/images/grow-agent/team-office.png"
              alt="Team collaborating in a modern office"
              fill
              className="object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-white mix-blend-saturation" />

            {/* Overlay image */}
            <Image
              src="/images/grow-agent/team-office-overlay.png"
              alt=""
              fill
              className="object-cover"
              aria-hidden="true"
            />

            {/* Feature badges */}
            <div className="absolute left-[13%] top-[25%] flex w-[228px] flex-col gap-4">
              <FeatureBadge
                icon={
                  <svg className="size-5 shrink-0" viewBox="0 0 22 21" fill="#FFBF00">
                    <path d="M7.6 21L5.7 17.8L2.1 17L2.45 13.3L0 10.5L2.45 7.7L2.1 4L5.7 3.2L7.6 0L11 1.45L14.4 0L16.3 3.2L19.9 4L19.55 7.7L22 10.5L19.55 13.3L19.9 17L16.3 17.8L14.4 21L11 19.55L7.6 21ZM9.95 14.05L15.6 8.4L14.2 6.95L9.95 11.2L7.8 9.1L6.4 10.5L9.95 14.05Z" />
                  </svg>
                }
                label="Expert Supervision"
              />
              <FeatureBadge
                icon={
                  <svg className="size-4 shrink-0" viewBox="0 0 16 20" fill="#FFBF00">
                    <path d="M4 20L5 13H0L9 0H11L10 8H16L6 20H4Z" />
                  </svg>
                }
                label="24/7 AI Execution"
              />
              <FeatureBadge
                icon={
                  <svg className="size-4 shrink-0" viewBox="0 0 16 20" fill="#FFBF00">
                    <path d="M6.95 13.55L12.6 7.9L11.175 6.475L6.95 10.7L4.85 8.6L3.425 10.025L6.95 13.55ZM8 20C5.683 19.417 3.771 18.088 2.263 16.013C0.754 13.938 0 11.633 0 9.1V3L8 0L16 3V9.1C16 11.633 15.246 13.938 13.738 16.013C12.229 18.088 10.317 19.417 8 20Z" />
                  </svg>
                }
                label="100% Quality Checked"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

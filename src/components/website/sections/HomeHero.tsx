import { CallDemoCard } from "./CallDemoCard";

interface HomeHeroProps {
  title?: string;
  titleHighlight?: string;
  subtitle?: string;
}

export function HomeHero({
  title = "Stop Losing Revenue To",
  titleHighlight = "Missed Calls",
  subtitle = "Our AI Voice Agent that handles 100% of your phone orders with human-like precision, 24/7.",
}: HomeHeroProps) {
  return (
    <section className="relative bg-ws-bg-page px-6 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center pt-16 pb-12">
        {/* Title */}
        <h1 className="relative max-w-5xl text-center text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-[96px] lg:leading-[1.1]">
          <span className="text-ws-text-heading">{title} </span>
          {titleHighlight && (
            <span className="relative inline text-[#ffbf00]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2 bg-[rgba(255,191,0,0.2)] md:bottom-1 md:h-3"
              />
              <span className="relative">{titleHighlight}</span>
            </span>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-center text-lg font-light leading-8 text-ws-text-body md:text-2xl">
          {subtitle}
        </p>

        {/* Conversation demo card */}
        <div className="mt-12 flex w-full justify-center">
          <CallDemoCard />
        </div>
      </div>
    </section>
  );
}

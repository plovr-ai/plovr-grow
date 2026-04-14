import Image from "next/image";
import { Container } from "@/components/website/ui/Container";

function SeoMiniTable() {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#fff9e5] p-4 text-sm text-[#ffbf00]">
      <div>
        <p className="font-normal uppercase text-ws-text-body">keywords</p>
        <p className="font-bold text-ws-text-heading">Italian restaurant near me</p>
        <p className="font-bold text-ws-text-heading">Best Pasta in LA</p>
      </div>
      <div className="text-right">
        <p className="font-normal uppercase text-ws-text-body">Rank</p>
        <p className="font-bold text-ws-text-heading">#1</p>
        <p className="font-bold text-ws-text-heading">#2</p>
      </div>
    </div>
  );
}

function ConversionMini() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[100px] shrink-0 overflow-hidden rounded-lg">
        <Image
          src="/images/grow-agent/food-sandwich.png"
          alt="Menu item"
          fill
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[11px] font-bold capitalize leading-snug text-ws-text-body">
          &quot;Optimize the beef sandwich image, move it to &apos;New &amp;
          Hot,&apos; and suggest a set with Cola.&quot;
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#edecea]">
          <div className="h-full w-3/4 bg-[#ffbf00]" />
        </div>
      </div>
    </div>
  );
}

function RevenueMini() {
  return (
    <div className="flex flex-col gap-3">
      {/* Completed task */}
      <div className="rounded-lg border-l-4 border-[rgba(255,180,171,0.4)] bg-[#edecea] px-4 py-3">
        <p className="text-sm text-[#a4a19f]">
          &quot;The retention campaign for returning guests wrapped up last
          week; here&apos;s the performance report...&quot;
        </p>
      </div>
      {/* Active task */}
      <div className="rounded-lg border-l-4 border-[#ffbf00] bg-[rgba(255,191,0,0.1)] px-4 py-3">
        <p className="text-sm font-medium text-[#ffbf00]">
          &quot;With local schools heading into break next week, should we
          launch a new promotion to capture the crowd?&quot;
        </p>
      </div>
    </div>
  );
}

const bentoCards = [
  {
    iconPath:
      "M1.4 12L0 10.6L7.4 3.15L11.4 7.15L16.6 2H14V0H20V6H18V3.4L11.4 10L7.4 6L1.4 12Z",
    iconViewBox: "0 0 20 12",
    title: "More Traffic",
    description:
      "SEO Agent, Review Agent, Social Media Agent ensure you're always the top choice on local search.",
    mini: <SeoMiniTable />,
  },
  {
    iconPath:
      "M24 14C18.478 14 14 18.478 14 24C14 29.522 18.478 34 24 34C29.523 34 34 29.522 34 24C34 18.478 29.523 14 24 14ZM23.549 18.012C25.141 17.904 26.779 18.343 28.076 19.629C29.264 20.83 30.168 22.505 30.149 24.074H31.927L28.223 28.222L24.519 24.074H26.447C26.446 22.633 26.091 21.782 24.963 20.666C23.859 19.55 22.741 18.903 20.815 18.741C21.674 18.331 22.601 18.083 23.549 18.012ZM19.778 19.779L23.483 23.927H21.555C21.555 25.368 21.91 26.219 23.037 27.334C24.142 28.451 25.259 29.1 27.185 29.261C24.948 30.321 22.002 30.43 19.927 28.372C18.738 27.171 17.833 25.496 17.853 23.927H16.073L19.778 19.779Z",
    iconViewBox: "0 0 48 48",
    title: "More Conversation",
    description:
      "Conversion Agents optimize your menus and direct-order channels to maximize lifetime value.",
    mini: <ConversionMini />,
  },
  {
    iconPath:
      "M24.75 22.75C24.25 22.625 23.75 22.375 23.375 22C23 21.875 22.875 21.5 22.875 21.25C22.875 21 23 20.625 23.25 20.5C23.625 20.25 24 20 24.375 20.125C25.125 20.125 25.75 20.5 26.125 21L27.25 19.5C26.875 19.125 26.5 18.875 26.125 18.625C25.75 18.375 25.25 18.25 24.75 18.25V16.5H23.25V18.25C22.625 18.375 22 18.75 21.5 19.25C21 19.875 20.625 20.625 20.75 21.375C20.75 22.125 21 22.875 21.5 23.375C22.125 24 23 24.375 23.75 24.75C24.125 24.875 24.625 25.125 25 25.375C25.25 25.625 25.375 26 25.375 26.375C25.375 26.75 25.25 27.125 25 27.5C24.625 27.875 24.125 28 23.75 28C23.25 28 22.625 27.875 22.25 27.5C21.875 27.25 21.5 26.875 21.25 26.5L20 27.875C20.375 28.375 20.75 28.75 21.25 29.125C21.875 29.5 22.625 29.875 23.375 29.875V31.5H24.75V29.625C25.5 29.5 26.125 29.125 26.625 28.625C27.25 28 27.625 27 27.625 26.125C27.625 25.375 27.375 24.5 26.75 24C26.125 23.375 25.5 23 24.75 22.75ZM24 14C18.5 14 14 18.5 14 24C14 29.5 18.5 34 24 34C29.5 34 34 29.5 34 24C34 18.5 29.5 14 24 14ZM24 32.625C19.25 32.625 15.375 28.75 15.375 24C15.375 19.25 19.25 15.375 24 15.375C28.75 15.375 32.625 19.25 32.625 24C32.625 28.75 28.75 32.625 24 32.625Z",
    iconViewBox: "0 0 48 48",
    title: "More Revenue",
    description:
      "Marketing Agent helps shift 3P orders to your own store. Drive repeat sales and reclaim your margins.",
    mini: <RevenueMini />,
  },
];

export function GrowAgentBentoGrid() {
  return (
    <section className="bg-[#f9f9f8] pb-24">
      <Container>
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ffbf00]">
            Hands-free Growth
          </span>
          <h2 className="text-center text-3xl font-bold tracking-tight text-ws-text-heading md:text-5xl">
            Your marketing on Auto pilot
          </h2>
        </div>

        {/* Cards grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {bentoCards.map((card) => (
            <div
              key={card.title}
              className="flex flex-col justify-between rounded-2xl border border-[rgba(80,69,50,0.1)] bg-white p-8"
            >
              {/* Top section */}
              <div>
                {/* Icon */}
                <div className="flex size-12 items-center justify-center rounded-lg bg-[#fff9e5]">
                  <svg
                    className="size-5"
                    viewBox={card.iconViewBox}
                    fill="#FFBF00"
                  >
                    <path d={card.iconPath} />
                  </svg>
                </div>

                {/* Title */}
                <h3 className="mt-6 text-2xl font-bold text-ws-text-heading">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="mt-3 text-base leading-relaxed text-[#6d6a66]">
                  {card.description}
                </p>
              </div>

              {/* Mini UI */}
              <div className="mt-8">{card.mini}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

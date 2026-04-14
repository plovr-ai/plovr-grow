import { Container } from "@/components/website/ui/Container";

interface PainPointCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface GrowAgentPainPointsProps {
  cards: PainPointCard[];
}

export function GrowAgentPainPoints({ cards }: GrowAgentPainPointsProps) {
  return (
    <section className="bg-[#f3f4f5] py-24">
      <Container>
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ws-text-heading md:text-4xl">
            Most restaurants lack a growth team.{" "}
            <span className="block">You don&apos;t have to.</span>
          </h2>
          <p className="mt-4 text-lg text-ws-text-body">
            Don&apos;t fight a pro war with a solo army.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="flex flex-col gap-4">
              {/* Icon */}
              <div className="flex size-12 items-center justify-center rounded-full border border-[#ffbf00]">
                {card.icon}
              </div>
              {/* Title */}
              <h3 className="text-xl font-bold text-ws-text-heading">
                {card.title}
              </h3>
              {/* Description */}
              <p className="text-base leading-relaxed text-ws-text-body">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

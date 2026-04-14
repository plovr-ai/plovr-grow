interface AutoPilotCard {
  title: string;
  description: string;
  richContent?: "seo" | "review" | "instagram";
}

interface AutoPilotProps {
  eyebrow?: string;
  title: string;
  description?: string;
  cards: AutoPilotCard[];
}

function CardIcon({ type }: { type?: "seo" | "review" | "instagram" }) {
  if (type === "seo") {
    return (
      <svg
        className="w-6 h-6 text-ws-primary-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  if (type === "review") {
    return (
      <svg
        className="w-6 h-6 text-ws-primary-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M13 8H7" />
        <path d="M17 12H7" />
      </svg>
    );
  }
  if (type === "instagram") {
    return (
      <svg
        className="w-6 h-6 text-ws-primary-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  }
  // Default: sparkles
  return (
    <svg
      className="w-6 h-6 text-ws-primary-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  );
}

function RichContent({ type }: { type?: "seo" | "review" | "instagram" }) {
  if (type === "seo") {
    return (
      <div className="bg-ws-primary-50 rounded-xl p-4">
        <div className="flex justify-between text-sm">
          <div>
            <div className="text-ws-primary-700 uppercase text-xs font-semibold mb-2">
              Keywords
            </div>
            <div className="font-bold text-ws-text text-sm mb-1">
              Italian restaurant near me
            </div>
            <div className="font-bold text-ws-text text-sm">
              Best Pasta in LA
            </div>
          </div>
          <div className="text-right">
            <div className="text-ws-primary-700 uppercase text-xs font-semibold mb-2">
              Rank
            </div>
            <div className="font-bold text-ws-text text-sm mb-1">#1</div>
            <div className="font-bold text-ws-text text-sm">#2</div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "review") {
    return (
      <div className="space-y-3">
        <div className="bg-gray-100 border-l-4 border-red-300 rounded-lg p-3">
          <p className="text-ws-text-muted text-sm">
            &ldquo;...unfortunately it&apos;s been a miss the last couple of
            times I ordered ....&rdquo;
          </p>
        </div>
        <div className="bg-ws-primary-50 border-l-4 border-ws-primary-400 rounded-lg p-3">
          <p className="text-ws-primary-700 text-sm font-medium">
            Draft: &ldquo;We&apos;re truly sorry for the miss, we&apos;d like to
            make it right...&rdquo;
          </p>
        </div>
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center">
          <span className="text-2xl">&#127837;</span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold text-ws-text-muted uppercase mb-1.5">
            New post is uploading
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-ws-primary-400 h-2 rounded-full"
              style={{ width: "75%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function AutoPilot({
  eyebrow = "Hands-free Growth",
  title,
  description,
  cards,
}: AutoPilotProps) {
  return (
    <section id="autopilot" className="relative bg-ws-bg-subtle px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto text-center mb-16">
        {eyebrow && (
          <div className="mb-4">
            <span className="text-xs font-bold text-ws-primary-500 uppercase tracking-widest">
              {eyebrow}
            </span>
          </div>
        )}
        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-ws-text tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-lg md:text-xl text-ws-text-muted font-medium max-w-3xl mx-auto">
            {description}
          </p>
        )}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {cards.map((card, i) => (
          <div
            key={i}
            className="bg-white border border-ws-border rounded-2xl p-8 flex flex-col justify-between min-h-[410px]"
          >
            {/* Top Section */}
            <div>
              <div className="w-14 h-14 bg-ws-primary-50 rounded-xl flex items-center justify-center mb-6">
                <CardIcon type={card.richContent} />
              </div>
              <h3 className="text-2xl font-bold text-ws-text mb-3">
                {card.title}
              </h3>
              <p className="text-ws-text-muted mb-6 leading-relaxed text-base">
                {card.description}
              </p>
            </div>

            {/* Rich Bottom Content */}
            <div aria-hidden="true">
              <RichContent type={card.richContent} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

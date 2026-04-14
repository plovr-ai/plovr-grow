interface Bullet {
  label: string;
}

interface VoiceAgentProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  bullets: Bullet[];
  agentName?: string;
  primaryCta?: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; external?: boolean };
}

const audioBars = [
  { height: "30%", delay: "0ms" },
  { height: "60%", delay: "150ms" },
  { height: "90%", delay: "300ms" },
  { height: "45%", delay: "100ms" },
  { height: "75%", delay: "250ms" },
  { height: "35%", delay: "50ms" },
  { height: "55%", delay: "200ms" },
];

export function VoiceAgent({
  eyebrow = "Human-Parity",
  title,
  titleAccent,
  description,
  bullets,
  agentName = "Ava",
  primaryCta,
  secondaryCta,
}: VoiceAgentProps) {
  return (
    <section id="voice-agent" className="relative bg-ws-bg-subtle px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Content */}
        <div className="md:col-span-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-ws-primary-400" />
            <span className="text-xs font-bold text-ws-primary-500 uppercase tracking-widest">
              {eyebrow}
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl font-semibold mb-6 leading-tight">
            <span className="block text-ws-text">{title}</span>
            {titleAccent && (
              <span className="block text-ws-text">{titleAccent}</span>
            )}
          </h2>

          <p className="text-lg text-ws-text-muted mb-8 leading-relaxed">
            {description}
          </p>

          <div className="space-y-4">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* Lucide: circle-check */}
                <svg
                  className="w-5 h-5 text-ws-primary-500 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-base font-medium text-ws-text">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Interactive Card */}
        <div className="md:col-span-6 flex items-center justify-center">
          <div className="bg-white border border-ws-border rounded-xl shadow-lg p-8 max-w-md w-full relative">
            {/* LIVE Badge */}
            <div className="absolute -top-3 -right-3 bg-ws-primary-400 text-ws-primary-700 text-xs font-extrabold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ws-primary-700 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ws-primary-700" />
              </span>
              LIVE
            </div>

            {/* Voice Agent Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center border-2 border-ws-primary-400/30">
                {/* Lucide: mic */}
                <svg
                  className="w-7 h-7 text-ws-primary-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ws-text">
                  Speak with {agentName}
                </h3>
                <div className="flex items-center gap-2 text-ws-primary-600">
                  {/* Lucide: audio-lines */}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 10v3" />
                    <path d="M6 6v11" />
                    <path d="M10 3v18" />
                    <path d="M14 8v7" />
                    <path d="M18 5v13" />
                    <path d="M22 10v3" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Hearing is Believing
                  </span>
                </div>
              </div>
            </div>

            {/* Audio Visualization */}
            <div className="bg-gray-100 rounded-2xl p-6 mb-8">
              <div
                className="flex items-end justify-center gap-1.5 h-14 mb-3"
                aria-hidden="true"
              >
                {audioBars.map((bar, i) => (
                  <div
                    key={i}
                    className="w-1 bg-ws-primary-400 rounded-full animate-pulse"
                    style={{ height: bar.height, animationDelay: bar.delay }}
                  />
                ))}
              </div>
              <p className="text-sm text-ws-text-muted text-center">
                &ldquo;How can I help you with your order today?&rdquo;
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              {primaryCta && (
                <a
                  href={primaryCta.href}
                  rel={primaryCta.external ? "noopener noreferrer" : undefined}
                  target={primaryCta.external ? "_blank" : undefined}
                  className="bg-ws-primary-400 text-ws-primary-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-ws-primary-500 transition-colors text-sm"
                >
                  {/* Lucide: phone */}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {primaryCta.label}
                </a>
              )}
              {secondaryCta && (
                <a
                  href={secondaryCta.href}
                  rel={
                    secondaryCta.external ? "noopener noreferrer" : undefined
                  }
                  target={secondaryCta.external ? "_blank" : undefined}
                  className="bg-gray-200 text-ws-text font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors text-sm"
                >
                  {/* Lucide: phone-incoming */}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="16 2 16 8 22 8" />
                    <line x1="22" x2="16" y1="2" y2="8" />
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {secondaryCta.label}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

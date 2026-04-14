interface DarkChatSectionProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  suggestions: string[];
  workspaceName?: string;
}

/* Each suggestion gets a contextual icon — converted from Astro set:html to React path arrays */
const suggestionIconPaths: string[][] = [
  /* bar-chart-2: "Analyze labor costs vs revenue" */
  ["M18 20V10", "M12 20V4", "M6 20v-6"],
  /* file-text: "Draft a new seasonal menu post" */
  [
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
    "M14 2v4a2 2 0 0 0 2 2h4",
    "M10 9H8",
    "M16 13H8",
    "M16 17H8",
  ],
  /* message-circle: "Summarize guest feedback" */
  ["M7.9 20A9 9 0 1 0 4 16.1L2 22z"],
];

export function DarkChatSection({
  eyebrow = "Agentic Manager",
  title,
  titleAccent,
  description,
  suggestions,
  workspaceName = "LocalGrow Manager",
}: DarkChatSectionProps) {
  return (
    <section id="manager" className="relative bg-ws-dark px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Left: Text Content */}
        <div className="flex flex-col justify-center">
          {eyebrow && (
            <span className="text-xs font-bold text-ws-primary-400 uppercase tracking-widest mb-6">
              {eyebrow}
            </span>
          )}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {title}
            {titleAccent && (
              <>
                {" "}
                <span className="text-white">{titleAccent}</span>
              </>
            )}
          </h2>
          <p className="text-lg text-ws-text-subtle leading-relaxed">{description}</p>
        </div>

        {/* Right: Interactive Card */}
        <div className="relative">
          <div
            className="absolute -left-12 -top-12 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "rgba(255, 191, 0, 0.15)",
              filter: "blur(60px)",
            }}
          />
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-ws-primary-400 rounded-full flex items-center justify-center text-ws-primary-700 font-bold text-lg">
                LG
              </div>
              <div>
                <h3 className="text-white font-bold">{workspaceName}</h3>
                <p className="text-ws-text-subtle text-sm">AI Strategic Advisor</p>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-6">
              What can I do for you today?
            </h3>

            <div className="space-y-4">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between gap-3"
                >
                  <span className="text-white text-sm">&ldquo;{s}&rdquo;</span>
                  <svg
                    className="w-5 h-5 text-white/50 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {(suggestionIconPaths[i] || suggestionIconPaths[0]).map(
                      (d, j) => (
                        <path key={j} d={d} />
                      )
                    )}
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

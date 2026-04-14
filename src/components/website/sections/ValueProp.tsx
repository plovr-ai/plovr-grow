interface ValuePropProps {
  title: string;
  titleAccent?: string;
  description: string;
  cta?: { label: string; href: string; external?: boolean };
}

export function ValueProp({ title, titleAccent, description, cta }: ValuePropProps) {
  return (
    <section className="relative bg-gray-100 px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight max-w-3xl">
          <span className="text-ws-text block leading-tight">{title}</span>
          {titleAccent && (
            <span className="text-ws-primary-400 block leading-tight">
              {titleAccent}
            </span>
          )}
        </h2>

        <p className="text-lg md:text-xl text-ws-text-muted mb-8 max-w-2xl leading-relaxed">
          {description}
        </p>

        {cta && (
          <a
            href={cta.href}
            rel={cta.external ? "noopener noreferrer" : undefined}
            target={cta.external ? "_blank" : undefined}
            className="inline-block px-8 py-4 bg-ws-primary-400 text-ws-primary-700 font-bold text-lg rounded-lg shadow-lg shadow-ws-primary-400/20 hover:bg-ws-primary-500 transition-colors"
          >
            {cta.label}
          </a>
        )}
      </div>
    </section>
  );
}

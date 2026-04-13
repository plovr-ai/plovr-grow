interface ProseProps {
  className?: string;
  children: React.ReactNode;
}

export function Prose({ className = "", children }: ProseProps) {
  return (
    <div
      className={`prose prose-lg max-w-none
        prose-headings:font-[family-name:var(--font-manrope)] prose-headings:text-[#0a0a0a]
        prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[#0a0a0a] prose-code:text-amber-700
        prose-blockquote:border-l-amber-500
        ${className}`}
    >
      {children}
    </div>
  );
}

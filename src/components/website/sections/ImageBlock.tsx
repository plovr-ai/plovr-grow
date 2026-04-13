import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";

interface ImageBlockProps {
  src?: string;
  alt?: string;
  ratio?: "wide" | "ultra-wide";
}

export function ImageBlock({
  src,
  alt = "",
  ratio = "ultra-wide",
}: ImageBlockProps) {
  const ratioClass = ratio === "ultra-wide" ? "aspect-[21/9]" : "aspect-[16/9]";

  return (
    <Section variant="default" className="!pt-0">
      <Container size="narrow">
        {src ? (
          <img
            src={src}
            alt={alt}
            className={`w-full rounded-2xl object-cover shadow-elev-md ${ratioClass}`}
          />
        ) : (
          <div
            className={`w-full overflow-hidden rounded-2xl shadow-elev-md ${ratioClass}`}
            role="img"
            aria-label={alt}
          >
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, #F8DBB0 0%, #E9B989 50%, #D49A64 100%)",
              }}
            >
              <div
                className="h-full w-full"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 20%, rgba(255,240,210,0.5), transparent 60%)",
                }}
              />
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}

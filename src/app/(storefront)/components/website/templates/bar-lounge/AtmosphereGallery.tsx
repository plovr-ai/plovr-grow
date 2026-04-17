import type { FeaturedItem } from "@/types/website";

interface AtmosphereGalleryProps {
  heroImage: string;
  items: FeaturedItem[];
}

export function AtmosphereGallery({
  heroImage,
  items,
}: AtmosphereGalleryProps) {
  // Collect all available images
  const images: { src: string; alt: string }[] = [];

  if (heroImage) {
    images.push({ src: heroImage, alt: "Atmosphere" });
  }

  for (const item of items) {
    if (item.image) {
      images.push({ src: item.image, alt: item.name });
    }
  }

  if (images.length === 0) return null;

  return (
    <section className="py-24 bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-sm tracking-[0.3em] uppercase text-white mb-16">
          The Experience
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg overflow-hidden"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="absolute inset-0 h-full w-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

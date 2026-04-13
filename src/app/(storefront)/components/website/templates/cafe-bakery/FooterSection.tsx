import Image from "next/image";
import type { SocialLink, BusinessHoursMap } from "@/types/website";

interface FooterSectionProps {
  name: string;
  logo: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  businessHours: BusinessHoursMap;
  socialLinks: SocialLink[];
}

function SocialIcon({ platform }: { platform: SocialLink["platform"] }) {
  switch (platform) {
    case "facebook":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "yelp":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.47-.8-.82-1.544l2.88-3.3c.43-.495.15-1.24-.52-1.34l-4.33-.65c-.67-.1-1.14-.72-.95-1.37l1.62-5.33c.19-.62-.35-1.21-.96-1.04L7.3 1.114c-.61.17-.76.95-.26 1.38l3.33 2.86c.5.43.25 1.24-.42 1.38l-5.26 1.08c-.67.14-.92.97-.43 1.45l3.95 3.9c.5.49.18 1.32-.54 1.42l-5.72.77c-.72.1-1 1.03-.45 1.55l4.26 4.05c.54.51.2 1.42-.58 1.52l-6.16.8c-.78.1-1.07 1.12-.45 1.6l5.05 3.95c.62.48 1.52-.02 1.52-.84V17.67c0-.78.74-1.37 1.5-1.2l5.93 1.35c.76.17 1.38-.63 1.03-1.33l-2.82-5.62c-.35-.7.23-1.5 1-1.37l6.06 1c.77.13 1.3-.76.87-1.45l-3.43-5.55c-.43-.7.12-1.6.93-1.5l6.43.8c.8.1 1.28-.87.75-1.5z" />
        </svg>
      );
    case "google":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      );
  }
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function FooterSection({
  name,
  logo,
  address,
  city,
  state,
  zipCode,
  phone,
  businessHours,
  socialLinks,
}: FooterSectionProps) {
  const fullAddress =
    address && city && state
      ? `${address}, ${city}, ${state} ${zipCode}`
      : "";

  return (
    <footer className="py-16 bg-stone-800 text-stone-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left: Logo & Name */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {logo && (
                <Image
                  src={logo}
                  alt={name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              )}
              <span className="font-serif text-xl text-white">{name}</span>
            </div>
            {fullAddress && (
              <p className="text-stone-400 text-sm mb-1">{fullAddress}</p>
            )}
            {phone && (
              <p className="text-stone-400 text-sm">{phone}</p>
            )}
          </div>

          {/* Right: Business Hours */}
          <div>
            <h3 className="text-sm font-medium text-stone-300 uppercase tracking-wider mb-4">
              Hours
            </h3>
            <div className="space-y-1.5">
              {DAY_ORDER.map((day) => {
                const hours = businessHours[day];
                if (!hours) return null;
                return (
                  <div
                    key={day}
                    className="flex justify-between text-sm text-stone-400"
                  >
                    <span>{DAY_LABELS[day]}</span>
                    <span>
                      {hours.closed ? "Closed" : `${hours.open} - ${hours.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="flex justify-center gap-4 mt-12 pt-8 border-t border-stone-700">
            {socialLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-stone-300 hover:bg-stone-600 hover:text-white transition-colors"
                aria-label={link.platform}
              >
                <SocialIcon platform={link.platform} />
              </a>
            ))}
          </div>
        )}

        {/* Copyright */}
        <p className="text-stone-500 text-xs text-center mt-8">
          &copy; {new Date().getFullYear()} {name}
        </p>
      </div>
    </footer>
  );
}

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

const PLACE_DETAILS_FIELDS = [
  "displayName", "formattedAddress", "addressComponents",
  "nationalPhoneNumber", "regularOpeningHours", "photos",
  "reviews", "websiteUri", "googleMapsUri",
].join(",");

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface BusinessHourEntry {
  open: string;
  close: string;
  closed: boolean;
}

export interface PlaceDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  businessHours: Record<string, BusinessHourEntry>;
  photoReferences: string[];
  reviews: PlaceReview[];
}

interface AddressComponent {
  types: string[];
  longText?: string;
  shortText?: string;
}

interface OpeningHourPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

function findAddressComponent(
  components: AddressComponent[], type: string, variant: "long" | "short" = "long"
): string {
  const match = components.find((c) => c.types.includes(type));
  if (!match) return "";
  return variant === "short" ? (match.shortText ?? "") : (match.longText ?? "");
}

function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function convertOpeningHours(
  periods: OpeningHourPeriod[] | undefined
): Record<string, BusinessHourEntry> {
  if (!periods || periods.length === 0) return {};
  const hours: Record<string, BusinessHourEntry> = {};
  for (const period of periods) {
    const dayName = DAY_NAMES[period.open.day];
    if (!dayName) continue;
    hours[dayName] = {
      open: padTime(period.open.hour, period.open.minute),
      close: period.close ? padTime(period.close.hour, period.close.minute) : "23:59",
      closed: false,
    };
  }
  return hours;
}

function getProxyDispatcher(): import("undici").Dispatcher | undefined {
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY ||
    process.env.http_proxy || process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent } = require("undici") as typeof import("undici");
    return new ProxyAgent(proxyUrl);
  } catch {
    return undefined;
  }
}

export class GooglePlacesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const dispatcher = getProxyDispatcher();
    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELDS,
      },
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API error: ${response.status} ${response.statusText} — ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const components: AddressComponent[] = (data.addressComponents as AddressComponent[]) ?? [];

    return {
      name: (data.displayName as { text?: string } | undefined)?.text ?? "",
      address: (data.formattedAddress as string | undefined) ?? "",
      city: findAddressComponent(components, "locality"),
      state: findAddressComponent(components, "administrative_area_level_1", "short"),
      zipCode: findAddressComponent(components, "postal_code"),
      phone: (data.nationalPhoneNumber as string | undefined) ?? null,
      websiteUrl: (data.websiteUri as string | undefined) ?? null,
      googleMapsUrl: (data.googleMapsUri as string | undefined) ?? null,
      businessHours: convertOpeningHours(
        (data.regularOpeningHours as { periods?: OpeningHourPeriod[] } | undefined)?.periods
      ),
      photoReferences: ((data.photos as Array<{ name: string }> | undefined) ?? []).map((p) => p.name),
      reviews: ((data.reviews as Array<{
        authorAttribution?: { displayName: string };
        rating: number;
        text?: { text: string };
        relativePublishTimeDescription?: string;
      }> | undefined) ?? []).map((r) => ({
        author: r.authorAttribution?.displayName ?? "Anonymous",
        rating: r.rating,
        text: r.text?.text ?? "",
        relativeTime: r.relativePublishTimeDescription ?? "",
      })),
    };
  }
}

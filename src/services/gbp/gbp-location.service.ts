import { AppError, ErrorCodes } from "@/lib/errors";
import { getProxyDispatcher } from "@/lib/proxy";
import type {
  GbpAccount,
  GbpLocation,
  GbpLocationMerchantData,
  GbpTimePeriod,
} from "./gbp.types";

const ACCOUNTS_API_URL =
  "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const BUSINESS_INFO_API_URL =
  "https://mybusinessbusinessinformation.googleapis.com/v1";
const LOCATION_READ_MASK =
  "name,title,phoneNumbers,storefrontAddress,regularHours,websiteUri,profile";

const DAY_MAP: Record<string, string> = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
};

async function listAccounts(accessToken: string): Promise<GbpAccount[]> {
  const dispatcher = getProxyDispatcher();
  const response = await fetch(ACCOUNTS_API_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GBP] listAccounts failed:", errorBody);
    throw new AppError(
      ErrorCodes.GBP_ACCOUNT_FETCH_FAILED,
      undefined,
      500
    );
  }

  const data = (await response.json()) as {
    accounts?: Array<{ name: string; accountName: string; type: string }>;
  };

  return (data.accounts ?? []).map((acc) => ({
    name: acc.name,
    accountName: acc.accountName,
    type: acc.type,
  }));
}

async function listLocations(
  accessToken: string,
  accountName: string
): Promise<GbpLocation[]> {
  const url = `${BUSINESS_INFO_API_URL}/${accountName}/locations?readMask=${LOCATION_READ_MASK}`;
  const dispatcher = getProxyDispatcher();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GBP] listLocations failed:", errorBody);
    throw new AppError(
      ErrorCodes.GBP_LOCATION_FETCH_FAILED,
      undefined,
      500
    );
  }

  const data = (await response.json()) as {
    locations?: GbpLocation[];
  };

  return data.locations ?? [];
}

async function getLocation(
  accessToken: string,
  locationName: string
): Promise<GbpLocation> {
  const url = `${BUSINESS_INFO_API_URL}/${locationName}?readMask=${LOCATION_READ_MASK}`;
  const dispatcher = getProxyDispatcher();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GBP] getLocation failed:", errorBody);
    throw new AppError(
      ErrorCodes.GBP_LOCATION_FETCH_FAILED,
      undefined,
      500
    );
  }

  return (await response.json()) as GbpLocation;
}

function mapLocationToMerchantData(location: GbpLocation): GbpLocationMerchantData {
  const address = location.storefrontAddress;
  const result: GbpLocationMerchantData = {};

  if (address) {
    result.address = address.addressLines?.join(", ");
    result.city = address.locality;
    result.state = address.administrativeArea;
    result.zipCode = address.postalCode;
  }

  if (location.phoneNumbers?.primaryPhone) {
    result.phone = location.phoneNumbers.primaryPhone;
  }

  if (location.profile?.description) {
    result.description = location.profile.description;
  }

  if (location.regularHours?.periods) {
    result.businessHours = mapBusinessHours(
      location.regularHours.periods
    );
  }

  return result;
}

function mapBusinessHours(
  periods: GbpTimePeriod[]
): Record<string, { open: string; close: string }> {
  const hours: Record<string, { open: string; close: string }> = {};

  for (const period of periods) {
    const day = DAY_MAP[period.openDay];
    if (!day) continue;

    const openTime = formatTime(period.openTime);
    const closeTime = formatTime(period.closeTime);

    hours[day] = { open: openTime, close: closeTime };
  }

  return hours;
}

function formatTime(time: { hours: number; minutes?: number }): string {
  const h = String(time.hours).padStart(2, "0");
  const m = String(time.minutes ?? 0).padStart(2, "0");
  return `${h}:${m}`;
}

export const gbpLocationService = {
  listAccounts,
  listLocations,
  getLocation,
  mapLocationToMerchantData,
};

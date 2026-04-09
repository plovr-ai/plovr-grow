export interface GbpTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OAuthState {
  tenantId: string;
  merchantId: string;
  returnUrl: string;
}

export interface GbpAccount {
  name: string;
  accountName: string;
  type: string;
}

export interface GbpLocationAddress {
  regionCode?: string;
  languageCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  addressLines?: string[];
}

export interface GbpTimePeriod {
  openDay: string;
  openTime: { hours: number; minutes?: number };
  closeDay: string;
  closeTime: { hours: number; minutes?: number };
}

export interface GbpLocation {
  name: string;
  title: string;
  phoneNumbers?: { primaryPhone?: string };
  storefrontAddress?: GbpLocationAddress;
  regularHours?: { periods?: GbpTimePeriod[] };
  websiteUri?: string;
  profile?: { description?: string };
}

export interface GbpConnectionStatus {
  connected: boolean;
  externalAccountId?: string;
  externalLocationId?: string;
  tokenExpiresAt?: Date;
}

export interface GbpLocationMerchantData {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  businessHours?: Record<string, { open: string; close: string }>;
  description?: string;
}

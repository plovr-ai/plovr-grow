import type { PlaceDetails } from "./google-places.client";

export const GENERATION_STATUS = {
  PENDING: "pending",
  FETCHING_DATA: "fetching_data",
  BUILDING: "building",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type GenerationStatus = (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS];

export interface CreateGenerationInput {
  placeId: string;
  placeName: string;
}

export interface CreateGenerationResult {
  generationId?: string;
  existingSlug?: string;
}

export interface GenerationStatusResult {
  status: GenerationStatus;
  stepDetail: string | null;
  companySlug: string | null;
  errorMessage: string | null;
}

export interface GeneratedTenantData {
  tenantId: string;
  merchantId: string;
  companySlug: string;
  merchantSlug: string;
}

export type { PlaceDetails };

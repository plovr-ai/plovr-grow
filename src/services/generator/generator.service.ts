import { generatorRepository } from "@/repositories/generator.repository";
import { tenantService } from "@/services/tenant/tenant.service";
import { resolveTemplate } from "@/types/website-template";
import { GooglePlacesClient } from "./google-places.client";
import type { PlaceDetails } from "./google-places.client";
import type {
  CreateGenerationInput,
  CreateGenerationResult,
  GenerationStatusResult,
} from "./generator.types";

export class GeneratorService {
  private placesClient: GooglePlacesClient;

  constructor(placesClient: GooglePlacesClient) {
    this.placesClient = placesClient;
  }

  async create(input: CreateGenerationInput): Promise<CreateGenerationResult> {
    const existing = await generatorRepository.findCompletedByPlaceId(input.placeId);
    if (existing?.tenantSlug) {
      return { existingSlug: existing.tenantSlug };
    }
    const generation = await generatorRepository.create(input.placeId, input.placeName);
    return { generationId: generation.id };
  }

  async getStatus(generationId: string): Promise<GenerationStatusResult | null> {
    const generation = await generatorRepository.getById(generationId);
    if (!generation) return null;
    return {
      status: generation.status as GenerationStatusResult["status"],
      stepDetail: generation.stepDetail,
      tenantSlug: generation.tenantSlug,
      errorMessage: generation.errorMessage,
    };
  }

  async generate(generationId: string): Promise<void> {
    const generation = await generatorRepository.getById(generationId);
    if (!generation) return;

    try {
      await generatorRepository.updateStatus(generationId, "fetching_data", "Fetching restaurant information...");
      const placeDetails = await this.placesClient.getPlaceDetails(generation.placeId);
      await generatorRepository.updateGoogleData(generationId, placeDetails);

      await generatorRepository.updateStatus(generationId, "building", "Building your website...");
      const result = await this.buildTenant(placeDetails);

      await generatorRepository.markCompleted(generationId, result.tenantId, result.tenantSlug);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await generatorRepository.markFailed(generationId, message);
    }
  }

  private async buildTenant(details: PlaceDetails) {
    const reviews = details.reviews.slice(0, 5).map((r) => ({
      author: r.author,
      rating: r.rating,
      text: r.text,
    }));

    const websiteTemplate = resolveTemplate(details.primaryType, details.types);

    const tenantSettings = {
      themePreset: "blue",
      websiteTemplate,
      website: { tagline: "", heroImage: "", socialLinks: [], reviews },
    };

    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: details.name,
      source: "generator",
      websiteUrl: details.websiteUrl,
      settings: tenantSettings,
      merchant: {
        address: details.address,
        city: details.city,
        state: details.state,
        zipCode: details.zipCode,
        phone: details.phone,
        businessHours: details.businessHours,
      },
    });

    return {
      tenantId: tenant.id,
      merchantId: merchant.id,
      // Slug is non-null by construction: createTenantWithMerchant always sets one.
      tenantSlug: tenant.slug as string,
      merchantSlug: merchant.slug,
    };
  }
}

let _generatorService: GeneratorService | null = null;

export function getGeneratorService(): GeneratorService {
  if (!_generatorService) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
    _generatorService = new GeneratorService(new GooglePlacesClient(apiKey));
  }
  return _generatorService;
}

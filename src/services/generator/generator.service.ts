import { generatorRepository } from "@/repositories/generator.repository";
import { companyService } from "@/services/company/company.service";
import type { GooglePlacesClient, PlaceDetails } from "./google-places.client";
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
    if (existing?.companySlug) {
      return { existingSlug: existing.companySlug };
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
      companySlug: generation.companySlug,
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

      await generatorRepository.markCompleted(generationId, result.tenantId, result.companySlug);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await generatorRepository.markFailed(generationId, message);
    }
  }

  private async buildTenant(details: PlaceDetails) {
    const reviews = details.reviews.slice(0, 5).map((r) => ({
      author: r.author, rating: r.rating, text: r.text,
    }));

    const companySettings = {
      themePreset: "blue",
      website: { tagline: "", heroImage: "", socialLinks: [], reviews },
    };

    const result = await companyService.createTenantWithCompanyAndMerchant({
      companyName: details.name,
      companyWebsiteUrl: details.websiteUrl ?? undefined,
      companySettings,
      source: "generator",
      subscriptionStatus: "trial",
      merchantName: details.name,
      merchantAddress: details.address,
      merchantCity: details.city,
      merchantState: details.state,
      merchantZipCode: details.zipCode,
      merchantPhone: details.phone ?? undefined,
      merchantBusinessHours: details.businessHours,
    });

    return {
      tenantId: result.tenant.id,
      companyId: result.company.id,
      merchantId: result.merchant.id,
      companySlug: result.companySlug,
      merchantSlug: result.merchantSlug,
    };
  }
}

let _generatorService: GeneratorService | null = null;

export function getGeneratorService(): GeneratorService {
  if (!_generatorService) {
    // Dynamic import to avoid circular dependency at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GooglePlacesClient } = require("./google-places.client");
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
    _generatorService = new GeneratorService(new GooglePlacesClient(apiKey));
  }
  return _generatorService;
}

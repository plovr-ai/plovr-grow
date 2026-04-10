import { generatorRepository } from "@/repositories/generator.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { generateEntityId } from "@/lib/id";
import { generateUniqueSlug } from "./slug.util";
import prisma from "@/lib/db";
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
    const tenantId = generateEntityId();
    const merchantId = generateEntityId();

    const tenantSlug = await generateUniqueSlug(
      details.name,
      async (slug) => (await tenantRepository.getBySlug(slug)) === null
    );
    const merchantSlug = await generateUniqueSlug(
      details.name,
      async (slug) => merchantRepository.isSlugAvailable(slug)
    );

    const reviews = details.reviews.slice(0, 5).map((r) => ({
      author: r.author, rating: r.rating, text: r.text,
    }));

    const tenantSettings = {
      themePreset: "blue",
      website: { tagline: "", heroImage: "", socialLinks: [], reviews },
    };

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: details.name,
        slug: tenantSlug,
        websiteUrl: details.websiteUrl,
        settings: tenantSettings,
        source: "generator",
        subscriptionStatus: "trial",
      },
    });

    await merchantRepository.create(tenantId, {
      slug: merchantSlug, name: details.name,
      address: details.address, city: details.city,
      state: details.state, zipCode: details.zipCode,
      phone: details.phone, businessHours: details.businessHours as never,
    });

    return { tenantId, merchantId, companySlug: tenantSlug, merchantSlug };
  }
}

let _generatorService: GeneratorService | null = null;

export function getGeneratorService(): GeneratorService {
  if (!_generatorService) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GooglePlacesClient } = require("./google-places.client");
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
    _generatorService = new GeneratorService(new GooglePlacesClient(apiKey));
  }
  return _generatorService;
}

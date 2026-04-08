import prisma from "@/lib/db";

export class GeneratorRepository {
  async findCompletedByPlaceId(placeId: string) {
    return prisma.websiteGeneration.findFirst({
      where: { placeId, status: "completed" },
    });
  }

  async create(placeId: string, placeName: string) {
    return prisma.websiteGeneration.create({
      data: { placeId, placeName },
    });
  }

  async getById(id: string) {
    return prisma.websiteGeneration.findUnique({ where: { id } });
  }

  async updateStatus(id: string, status: string, stepDetail: string | null = null) {
    return prisma.websiteGeneration.update({
      where: { id },
      data: { status, stepDetail },
    });
  }

  async markCompleted(id: string, tenantId: string, companySlug: string) {
    return prisma.websiteGeneration.update({
      where: { id },
      data: { status: "completed", stepDetail: null, tenantId, companySlug },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    return prisma.websiteGeneration.update({
      where: { id },
      data: { status: "failed", stepDetail: null, errorMessage },
    });
  }

  async updateGoogleData(id: string, googleData: unknown) {
    return prisma.websiteGeneration.update({
      where: { id },
      data: { googleData: googleData as never },
    });
  }
}

export const generatorRepository = new GeneratorRepository();

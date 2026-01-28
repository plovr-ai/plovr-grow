import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export class SequenceRepository {
  /**
   * Get next order sequence (atomic operation)
   * Uses database-level upsert + increment for thread-safety
   */
  async getNextOrderSequence(
    tenantId: string,
    merchantId: string,
    date: string
  ): Promise<number> {
    const result = await prisma.orderSequence.upsert({
      where: {
        tenantId_merchantId_date: {
          tenantId,
          merchantId,
          date,
        },
      },
      update: {
        sequence: { increment: 1 },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        date,
        sequence: 1,
      },
      select: {
        sequence: true,
      },
    });

    return result.sequence;
  }

  /**
   * Get next company order sequence (for gift card orders)
   */
  async getNextCompanyOrderSequence(
    tenantId: string,
    companyId: string,
    date: string
  ): Promise<number> {
    const result = await prisma.companyOrderSequence.upsert({
      where: {
        tenantId_companyId_date: {
          tenantId,
          companyId,
          date,
        },
      },
      update: {
        sequence: { increment: 1 },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        companyId,
        date,
        sequence: 1,
      },
      select: {
        sequence: true,
      },
    });

    return result.sequence;
  }

  /**
   * Get next catering order sequence
   */
  async getNextCateringOrderSequence(
    tenantId: string,
    merchantId: string,
    date: string
  ): Promise<number> {
    const result = await prisma.cateringOrderSequence.upsert({
      where: {
        tenantId_merchantId_date: {
          tenantId,
          merchantId,
          date,
        },
      },
      update: {
        sequence: { increment: 1 },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        date,
        sequence: 1,
      },
      select: {
        sequence: true,
      },
    });

    return result.sequence;
  }

  /**
   * Get next invoice sequence (tenant-level, never resets)
   */
  async getNextInvoiceSequence(tenantId: string): Promise<number> {
    const result = await prisma.invoiceSequence.upsert({
      where: {
        tenantId,
      },
      update: {
        sequence: { increment: 1 },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        sequence: 1,
      },
      select: {
        sequence: true,
      },
    });

    return result.sequence;
  }
}

export const sequenceRepository = new SequenceRepository();

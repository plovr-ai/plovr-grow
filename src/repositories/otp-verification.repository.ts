import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export const OTP_PURPOSES = ["login", "register"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export class OtpVerificationRepository {
  /**
   * Create or update OTP verification record
   */
  async upsert(
    tenantId: string,
    phone: string,
    purpose: OtpPurpose,
    code: string,
    expiresAt: Date
  ) {
    return prisma.otpVerification.upsert({
      where: {
        tenantId_phone_purpose: {
          tenantId,
          phone,
          purpose,
        },
      },
      update: {
        code,
        attempts: 0,
        expiresAt,
        verifiedAt: null,
      },
      create: {
        id: generateEntityId(),
        tenantId,
        phone,
        purpose,
        code,
        expiresAt,
      },
    });
  }

  /**
   * Get OTP verification record
   */
  async get(tenantId: string, phone: string, purpose: OtpPurpose) {
    return prisma.otpVerification.findFirst({
      where: {
        tenantId,
        phone,
        purpose,
        deleted: false,
      },
    });
  }

  /**
   * Increment attempt count
   */
  async incrementAttempts(tenantId: string, phone: string, purpose: OtpPurpose) {
    return prisma.otpVerification.update({
      where: {
        tenantId_phone_purpose: {
          tenantId,
          phone,
          purpose,
        },
      },
      data: {
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Mark OTP as verified
   */
  async markVerified(tenantId: string, phone: string, purpose: OtpPurpose) {
    return prisma.otpVerification.update({
      where: {
        tenantId_phone_purpose: {
          tenantId,
          phone,
          purpose,
        },
      },
      data: {
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Delete OTP verification record
   */
  async delete(tenantId: string, phone: string, purpose: OtpPurpose) {
    return prisma.otpVerification.update({
      where: {
        tenantId_phone_purpose: {
          tenantId,
          phone,
          purpose,
        },
      },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  /**
   * Delete expired OTP records (for cleanup job)
   */
  async deleteExpired() {
    return prisma.otpVerification.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        deleted: false,
      },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  /**
   * Check if OTP is valid and not expired
   */
  async isValid(
    tenantId: string,
    phone: string,
    purpose: OtpPurpose,
    code: string,
    maxAttempts: number = 3
  ): Promise<{
    valid: boolean;
    reason?: "not_found" | "expired" | "invalid_code" | "max_attempts" | "already_verified";
  }> {
    const record = await this.get(tenantId, phone, purpose);

    if (!record) {
      return { valid: false, reason: "not_found" };
    }

    if (record.verifiedAt) {
      return { valid: false, reason: "already_verified" };
    }

    if (new Date() > record.expiresAt) {
      return { valid: false, reason: "expired" };
    }

    if (record.attempts >= maxAttempts) {
      return { valid: false, reason: "max_attempts" };
    }

    if (record.code !== code) {
      return { valid: false, reason: "invalid_code" };
    }

    return { valid: true };
  }
}

export const otpVerificationRepository = new OtpVerificationRepository();

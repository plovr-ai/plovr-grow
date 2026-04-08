import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { GiftCardService } from "../giftcard.service";

// Mock repository
vi.mock("@/repositories/giftcard.repository", () => ({
  giftCardRepository: {
    getById: vi.fn(),
    getByIdForUpdate: vi.fn(),
    updateBalance: vi.fn(),
    createTransaction: vi.fn(),
  },
}));

import { giftCardRepository } from "@/repositories/giftcard.repository";

describe("GiftCardService", () => {
  let service: GiftCardService;

  const now = new Date();

  const mockGiftCard = {
    id: "gc-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    cardNumber: "1234-5678-9012-3456",
    initialAmount: new Decimal(50),
    currentBalance: new Decimal(50),
    purchaseOrderId: "order-0",
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const mockLockedGiftCard = {
    id: "gc-1",
    currentBalance: "50",
  };

  const mockTransaction = {
    id: "tx-1",
    tenantId: "tenant-1",
    giftCardId: "gc-1",
    orderId: "order-1" as string | null,
    type: "redemption",
    amount: new Decimal(20),
    balanceBefore: new Decimal(50),
    balanceAfter: new Decimal(30),
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GiftCardService();
  });

  describe("redeemGiftCard", () => {
    it("should call getByIdForUpdate when tx is provided", async () => {
      const mockTx = {} as Parameters<typeof service.redeemGiftCard>[4];
      vi.mocked(giftCardRepository.getByIdForUpdate).mockResolvedValue(mockLockedGiftCard);
      vi.mocked(giftCardRepository.updateBalance).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      await service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20, mockTx);

      expect(giftCardRepository.getByIdForUpdate).toHaveBeenCalledWith(
        "tenant-1",
        "gc-1",
        mockTx
      );
      expect(giftCardRepository.getById).not.toHaveBeenCalled();
    });

    it("should call getById when tx is not provided", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.updateBalance).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      await service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20);

      expect(giftCardRepository.getById).toHaveBeenCalledWith("tenant-1", "gc-1");
      expect(giftCardRepository.getByIdForUpdate).not.toHaveBeenCalled();
    });

    it("should throw if gift card is not found", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue(null);

      await expect(
        service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20)
      ).rejects.toThrow("Gift card not found");
    });

    it("should throw if gift card has no balance", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue({
        ...mockGiftCard,
        currentBalance: new Decimal(0),
      });

      await expect(
        service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20)
      ).rejects.toThrow("Gift card has no balance");
    });

    it("should redeem only up to available balance", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue({
        ...mockGiftCard,
        currentBalance: new Decimal(10),
      });
      vi.mocked(giftCardRepository.updateBalance).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      const result = await service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20);

      expect(result.amountRedeemed).toBe(10);
      expect(result.remainingBalance).toBe(0);
      expect(giftCardRepository.updateBalance).toHaveBeenCalledWith(
        "tenant-1",
        "gc-1",
        0,
        undefined
      );
    });

    it("should return correct result on successful redemption", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.updateBalance).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      const result = await service.redeemGiftCard("tenant-1", "gc-1", "order-1", 20);

      expect(result).toEqual({
        success: true,
        amountRedeemed: 20,
        remainingBalance: 30,
        transactionId: "tx-1",
      });
    });
  });
});

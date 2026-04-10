import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { GiftCardService } from "../giftcard.service";

// Mock giftcard utils
vi.mock("@/lib/giftcard", () => ({
  generateGiftCardNumber: vi.fn(() => "1111-2222-3333-4444"),
  normalizeGiftCardNumber: vi.fn((n: string) => n.replace(/[-\s]/g, "")),
  formatGiftCardNumber: vi.fn((n: string) => {
    const clean = n.replace(/-/g, "");
    const chunks = clean.match(/.{1,4}/g) || [];
    return chunks.join("-");
  }),
  isValidGiftCardFormat: vi.fn(() => true),
}));

// Mock repository
vi.mock("@/repositories/giftcard.repository", () => ({
  giftCardRepository: {
    getById: vi.fn(),
    getByIdForUpdate: vi.fn(),
    getByCardNumber: vi.fn(),
    getByPurchaseOrderId: vi.fn(),
    getStatsByCompany: vi.fn(),
    getByCompany: vi.fn(),
    cardNumberExists: vi.fn(),
    create: vi.fn(),
    updateBalance: vi.fn(),
    createTransaction: vi.fn(),
  },
}));

import { giftCardRepository } from "@/repositories/giftcard.repository";
import { generateGiftCardNumber, isValidGiftCardFormat } from "@/lib/giftcard";

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

  describe("createGiftCard", () => {
    it("should create a gift card with a unique number", async () => {
      vi.mocked(giftCardRepository.cardNumberExists).mockResolvedValue(false);
      vi.mocked(giftCardRepository.create).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      const result = await service.createGiftCard("tenant-1", "company-1", {
        amount: 50,
        purchaseOrderId: "order-0",
      });

      expect(giftCardRepository.cardNumberExists).toHaveBeenCalled();
      expect(giftCardRepository.create).toHaveBeenCalledWith("tenant-1", "company-1", {
        cardNumber: "1111-2222-3333-4444",
        initialAmount: 50,
        purchaseOrderId: "order-0",
      });
      expect(giftCardRepository.createTransaction).toHaveBeenCalledWith("tenant-1", {
        giftCardId: "gc-1",
        orderId: "order-0",
        type: "purchase",
        amount: 50,
        balanceBefore: 0,
        balanceAfter: 50,
      });
      expect(result).toEqual({
        id: "gc-1",
        cardNumber: "1234-5678-9012-3456",
        initialAmount: 50,
        currentBalance: 50,
        createdAt: now,
      });
    });

    it("should retry when card number already exists", async () => {
      vi.mocked(giftCardRepository.cardNumberExists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vi.mocked(giftCardRepository.create).mockResolvedValue(mockGiftCard);
      vi.mocked(giftCardRepository.createTransaction).mockResolvedValue(mockTransaction);

      await service.createGiftCard("tenant-1", "company-1", {
        amount: 50,
        purchaseOrderId: "order-0",
      });

      expect(generateGiftCardNumber).toHaveBeenCalledTimes(2);
    });

    it("should throw after max attempts to generate unique number", async () => {
      vi.mocked(giftCardRepository.cardNumberExists).mockResolvedValue(true);

      await expect(
        service.createGiftCard("tenant-1", "company-1", {
          amount: 50,
          purchaseOrderId: "order-0",
        })
      ).rejects.toThrow("Failed to generate unique gift card number");
    });
  });

  describe("validateGiftCard", () => {
    it("should return invalid_format when card number format is bad", async () => {
      vi.mocked(isValidGiftCardFormat).mockReturnValueOnce(false);

      const result = await service.validateGiftCard("tenant-1", "company-1", "bad");

      expect(result).toEqual({ valid: false, error: "invalid_format" });
    });

    it("should return not_found when card does not exist", async () => {
      vi.mocked(giftCardRepository.getByCardNumber).mockResolvedValue(null);

      const result = await service.validateGiftCard(
        "tenant-1",
        "company-1",
        "1234-5678-9012-3456"
      );

      expect(result).toEqual({ valid: false, error: "not_found" });
    });

    it("should return no_balance when card balance is zero", async () => {
      vi.mocked(giftCardRepository.getByCardNumber).mockResolvedValue({
        ...mockGiftCard,
        currentBalance: new Decimal(0),
      });

      const result = await service.validateGiftCard(
        "tenant-1",
        "company-1",
        "1234-5678-9012-3456"
      );

      expect(result).toEqual({ valid: false, error: "no_balance" });
    });

    it("should return valid with gift card data when card is good", async () => {
      vi.mocked(giftCardRepository.getByCardNumber).mockResolvedValue(mockGiftCard);

      const result = await service.validateGiftCard(
        "tenant-1",
        "company-1",
        "1234-5678-9012-3456"
      );

      expect(result.valid).toBe(true);
      expect(result.giftCard).toEqual({
        id: "gc-1",
        cardNumber: "1234-5678-9012-3456",
        initialAmount: 50,
        currentBalance: 50,
        createdAt: now,
      });
    });
  });

  describe("getBalance", () => {
    it("should return null when gift card is not found", async () => {
      vi.mocked(giftCardRepository.getByCardNumber).mockResolvedValue(null);

      const result = await service.getBalance("tenant-1", "company-1", "1234567890123456");

      expect(result).toBeNull();
    });

    it("should return the current balance as a number", async () => {
      vi.mocked(giftCardRepository.getByCardNumber).mockResolvedValue(mockGiftCard);

      const result = await service.getBalance("tenant-1", "company-1", "1234567890123456");

      expect(result).toBe(50);
    });
  });

  describe("getGiftCard", () => {
    it("should return null when gift card is not found", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue(null);

      const result = await service.getGiftCard("tenant-1", "gc-1");

      expect(result).toBeNull();
    });

    it("should return gift card data when found", async () => {
      vi.mocked(giftCardRepository.getById).mockResolvedValue(mockGiftCard);

      const result = await service.getGiftCard("tenant-1", "gc-1");

      expect(result).toEqual({
        id: "gc-1",
        cardNumber: "1234-5678-9012-3456",
        initialAmount: 50,
        currentBalance: 50,
        createdAt: now,
      });
    });
  });

  describe("getGiftCardByOrderId", () => {
    it("should return null when not found", async () => {
      vi.mocked(giftCardRepository.getByPurchaseOrderId).mockResolvedValue(null);

      const result = await service.getGiftCardByOrderId("tenant-1", "order-0");

      expect(result).toBeNull();
    });

    it("should return gift card data when found", async () => {
      vi.mocked(giftCardRepository.getByPurchaseOrderId).mockResolvedValue(mockGiftCard);

      const result = await service.getGiftCardByOrderId("tenant-1", "order-0");

      expect(result).toEqual({
        id: "gc-1",
        cardNumber: "1234-5678-9012-3456",
        initialAmount: 50,
        currentBalance: 50,
        createdAt: now,
      });
    });
  });

  describe("getCompanyGiftCardStats", () => {
    it("should delegate to repository", async () => {
      const mockStats = {
        totalCards: 10,
        totalSold: 500,
        totalRedeemed: 200,
        totalBalance: 300,
      };
      vi.mocked(giftCardRepository.getStatsByCompany).mockResolvedValue(mockStats);

      const result = await service.getCompanyGiftCardStats("tenant-1", "company-1");

      expect(giftCardRepository.getStatsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        {}
      );
      expect(result).toEqual(mockStats);
    });

    it("should pass date options to repository", async () => {
      const mockStats = {
        totalCards: 5,
        totalSold: 250,
        totalRedeemed: 100,
        totalBalance: 150,
      };
      vi.mocked(giftCardRepository.getStatsByCompany).mockResolvedValue(mockStats);
      const dateFrom = new Date("2026-01-01");
      const dateTo = new Date("2026-03-01");

      await service.getCompanyGiftCardStats("tenant-1", "company-1", {
        dateFrom,
        dateTo,
      });

      expect(giftCardRepository.getStatsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        { dateFrom, dateTo }
      );
    });
  });

  describe("getCompanyGiftCards", () => {
    it("should map repository results to GiftCardWithOrder format", async () => {
      vi.mocked(giftCardRepository.getByCompany).mockResolvedValue({
        items: [
          {
            id: "gc-1",
            cardNumber: "1234-5678-9012-3456",
            initialAmount: new Decimal(50),
            currentBalance: new Decimal(30),
            createdAt: now,
            purchaseOrder: {
              id: "order-1",
              orderNumber: "ORD-001",
              customerFirstName: "John",
              customerLastName: "Doe",
              customerEmail: "john@example.com",
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      const result = await service.getCompanyGiftCards("tenant-1", "company-1");

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: "gc-1",
        cardNumber: "1234-5678-9012-3456",
        initialAmount: 50,
        currentBalance: 30,
        createdAt: now,
        purchaseOrder: {
          id: "order-1",
          orderNumber: "ORD-001",
          customerFirstName: "John",
          customerLastName: "Doe",
          customerEmail: "john@example.com",
        },
      });
      expect(result.total).toBe(1);
    });

    it("should pass pagination and search options", async () => {
      vi.mocked(giftCardRepository.getByCompany).mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await service.getCompanyGiftCards("tenant-1", "company-1", {
        page: 2,
        pageSize: 10,
        search: "1234",
      });

      expect(giftCardRepository.getByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        { page: 2, pageSize: 10, search: "1234" }
      );
    });
  });
});

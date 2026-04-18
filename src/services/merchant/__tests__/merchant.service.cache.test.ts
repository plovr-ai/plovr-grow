import { describe, it, expect, vi, beforeEach } from "vitest";

// Real React `cache()` only dedupes inside a Server Component render context,
// which is impractical to set up in a unit test. Instead we replace `cache`
// with a simple per-wrapper Map that we can reset between tests to simulate
// request boundaries. These tests verify that our call graph (including
// delegating methods like `getMerchantBySlugWithTenant`) correctly shares the
// wrapped reference — i.e. that a future refactor cannot accidentally bypass
// the dedup by calling `merchantService.getMerchantBySlug` via the public
// export instead of the local binding.
const { cacheStores, mockCache } = vi.hoisted(() => {
  const stores: Map<string, unknown>[] = [];
  return {
    cacheStores: stores,
    mockCache: <F extends (...args: never[]) => unknown>(fn: F): F => {
      const store = new Map<string, unknown>();
      stores.push(store);
      return ((...args: never[]) => {
        const key = JSON.stringify(args);
        if (store.has(key)) return store.get(key);
        const result = fn(...args);
        store.set(key, result);
        return result;
      }) as F;
    },
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: mockCache };
});

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getBySlugWithTenant: vi.fn(),
    getByIdWithTenant: vi.fn(),
  },
}));

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    getBySlugWithMerchants: vi.fn(),
  },
}));

vi.mock("@/services/menu", () => ({
  menuService: {},
}));

import { merchantService } from "../merchant.service";
import { merchantRepository } from "@/repositories/merchant.repository";
import { tenantRepository } from "@/repositories/tenant.repository";

function resetCaches(): void {
  for (const store of cacheStores) store.clear();
}

describe("merchantService request-scope cache() dedup (#303)", () => {
  const mockMerchant = {
    id: "m-1",
    tenantId: "t-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    settings: {},
    tenant: { id: "t-1", tenantId: "t-1", slug: "joes", name: "Joe's", settings: {} },
  };

  const mockTenant = {
    id: "t-1",
    tenantId: "t-1",
    slug: "joes",
    name: "Joe's",
    settings: {},
    merchants: [],
  };

  beforeEach(() => {
    resetCaches();
    vi.clearAllMocks();
    vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
      mockTenant as never
    );
  });

  describe("getMerchantBySlug", () => {
    it("dedupes repeated calls with the same slug within one request", async () => {
      await merchantService.getMerchantBySlug("joes-pizza");
      await merchantService.getMerchantBySlug("joes-pizza");
      await merchantService.getMerchantBySlug("joes-pizza");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledTimes(1);
    });

    it("does not dedupe calls with different slugs", async () => {
      await merchantService.getMerchantBySlug("a");
      await merchantService.getMerchantBySlug("b");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledTimes(2);
    });

    it("dedupe is scoped per request (resetting simulates a new request)", async () => {
      await merchantService.getMerchantBySlug("joes-pizza");
      resetCaches();
      await merchantService.getMerchantBySlug("joes-pizza");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledTimes(2);
    });

    it("getMerchantBySlugWithTenant shares the same cached reference", async () => {
      await merchantService.getMerchantBySlugWithTenant("joes-pizza");
      await merchantService.getMerchantBySlug("joes-pizza");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTenantBySlug", () => {
    it("dedupes repeated calls with the same slug within one request", async () => {
      await merchantService.getTenantBySlug("joes");
      await merchantService.getTenantBySlug("joes");

      expect(tenantRepository.getBySlugWithMerchants).toHaveBeenCalledTimes(1);
    });

    it("dedupe is independent from getMerchantBySlug's cache", async () => {
      await merchantService.getTenantBySlug("joes");
      await merchantService.getMerchantBySlug("joes");

      expect(tenantRepository.getBySlugWithMerchants).toHaveBeenCalledTimes(1);
      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledTimes(1);
    });
  });
});

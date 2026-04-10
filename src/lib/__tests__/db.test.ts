import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@prisma/client", () => {
  class MockPrismaClient {}
  return {
    PrismaClient: MockPrismaClient,
    Prisma: {},
  };
});

describe("db", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    const g = globalThis as unknown as { prisma: unknown };
    delete g.prisma;
    vi.resetModules();
  });

  it("should export a prisma instance", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const mod = await import("../db");
    expect(mod.default).toBeDefined();
  });

  it("should cache prisma on globalThis in non-production mode", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const mod = await import("../db");
    const g = globalThis as unknown as { prisma: unknown };
    expect(g.prisma).toBe(mod.default);
  });
});

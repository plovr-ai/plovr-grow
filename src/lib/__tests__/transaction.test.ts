import { describe, it, expect, vi } from "vitest";

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: { $transaction: mockTransaction },
}));

import { runInTransaction } from "../transaction";

describe("runInTransaction", () => {
  it("delegates to prisma.$transaction and returns its result", async () => {
    const fakeTx = { marker: "tx" };
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)
    );

    const result = await runInTransaction(async (tx) => {
      expect(tx).toBe(fakeTx);
      return "done";
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result).toBe("done");
  });

  it("propagates errors thrown inside the callback", async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({})
    );

    await expect(
      runInTransaction(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});

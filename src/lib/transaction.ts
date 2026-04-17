import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";

/**
 * Run a callback inside a Prisma transaction.
 *
 * Services and API routes must not import the default Prisma client directly.
 * Use this helper to orchestrate multi-repository atomic writes while still
 * relying on Repository methods for all DB access.
 *
 * ```ts
 * await runInTransaction(async (tx) => {
 *   await fooRepository.create(data, tx);
 *   await barRepository.update(id, patch, tx);
 * });
 * ```
 */
export function runInTransaction<T>(
  fn: (tx: DbClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}

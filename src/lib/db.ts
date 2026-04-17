import { PrismaClient, Prisma } from "@prisma/client";
import { maybeAttachDbPerf } from "./db-instrumentation";

export type DbClient = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cache the *base* (unextended) client in globalThis so dev hot-reload does
// not accumulate $extends wrappers on top of each other. The extension is
// reapplied on each module load via `maybeAttachDbPerf`.
const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

// No-op unless DB_PERF_LOG=1 — see src/lib/db-instrumentation.ts.
const prisma = maybeAttachDbPerf(base);

export default prisma;

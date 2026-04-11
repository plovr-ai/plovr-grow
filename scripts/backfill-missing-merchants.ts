/**
 * One-shot backfill: create a default merchant for any tenant that has none.
 *
 * Repairs data from the regression introduced in commit e61be27 where
 * direct Stytch signup created a tenant without a merchant.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-merchants.ts
 *
 * Idempotent: safe to re-run.
 */
import prisma from "@/lib/db";
import { merchantRepository } from "@/repositories/merchant.repository";
import { generateUniqueSlug } from "@/services/generator/slug.util";

async function main() {
  // Match the dashboard's invariant: a tenant is broken when it has zero
  // *non-deleted* merchants. Tenants whose only merchants are soft-deleted
  // also surface as "no store" via tenantRepository.getWithMerchants.
  const broken = await prisma.tenant.findMany({
    where: { merchants: { none: { deleted: false } }, deleted: false },
    select: { id: true, name: true, slug: true },
  });

  if (broken.length === 0) {
    console.log("No tenants need backfill — all good.");
    return;
  }

  console.log(`Found ${broken.length} tenant(s) missing a merchant:`);
  for (const tenant of broken) {
    const slug = await generateUniqueSlug(tenant.name, async (s) =>
      merchantRepository.isSlugAvailable(s)
    );
    const merchant = await merchantRepository.create(tenant.id, {
      slug,
      name: tenant.name,
    });
    console.log(
      `  ✓ ${tenant.name} (${tenant.id}) → merchant ${merchant.id} (${slug})`
    );
  }

  console.log(`\nBackfilled ${broken.length} merchant(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

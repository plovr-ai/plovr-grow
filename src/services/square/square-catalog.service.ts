import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { squareConfig } from "./square.config";
import type { TaxInclusionType } from "@/services/menu/tax-config.types";
import {
  createEmptyCatalogSyncStats,
  type CatalogSyncStats,
} from "@/repositories/integration.types";

export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
  images: CatalogObject[];
}

export interface IncrementalCatalogResult extends SquareCatalogResult {
  deletedIds: string[];
}

export interface MappedModifierOption {
  name: string;
  price: number;
  externalId: string;
  isDefault: boolean;
  ordinal: number;
}

export interface MappedModifierGroup {
  externalId: string | null;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MappedModifierOption[];
}

export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryExternalIds: string[];
  taxExternalIds: string[];
  modifierGroups: MappedModifierGroup[];
  variationMappings: {
    externalId: string;
    name: string;
    groupId?: string;
    optionId?: string;
  }[];
}

export interface MappedCategory {
  externalId: string;
  name: string;
  sortOrder: number;
}

export interface MappedTax {
  externalId: string;
  name: string;
  percentage: number;
  inclusionType: TaxInclusionType;
}

export interface MappedCatalog {
  categories: MappedCategory[];
  items: MappedMenuItem[];
  taxes: MappedTax[];
  stats: CatalogSyncStats;
}

function getClient(accessToken: string): SquareClient {
  return new SquareClient({
    token: accessToken,
    environment:
      squareConfig.environment === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

function moneyToNumber(amountCents?: bigint | null): number {
  if (!amountCents) return 0;
  return Number(amountCents) / 100;
}

/**
 * Fetch catalog objects modified after `beginTime` (RFC 3339).
 * Uses `catalog.search()` with manual cursor-based pagination.
 * Includes deleted objects so we can propagate deletions.
 */
async function fetchIncrementalCatalog(
  accessToken: string,
  beginTime: string
): Promise<IncrementalCatalogResult> {
  const client = getClient(accessToken);
  const objectTypes: Array<"CATEGORY" | "ITEM" | "MODIFIER_LIST" | "TAX" | "IMAGE"> = [
    "CATEGORY",
    "ITEM",
    "MODIFIER_LIST",
    "TAX",
    "IMAGE",
  ];

  const allObjects: CatalogObject[] = [];
  const deletedIds: string[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.catalog.search({
      beginTime,
      objectTypes,
      includeDeletedObjects: true,
      includeRelatedObjects: false,
      cursor,
      limit: 1000,
    });

    const objects = response.objects ?? [];
    for (const obj of objects) {
      if (obj.isDeleted) {
        if (obj.id) {
          deletedIds.push(obj.id);
        }
      } else {
        allObjects.push(obj);
      }
    }

    cursor = response.cursor;
  } while (cursor);

  return {
    categories: allObjects.filter((o) => o.type === "CATEGORY"),
    items: allObjects.filter((o) => o.type === "ITEM"),
    modifierLists: allObjects.filter((o) => o.type === "MODIFIER_LIST"),
    taxes: allObjects.filter((o) => o.type === "TAX"),
    images: allObjects.filter((o) => o.type === "IMAGE"),
    deletedIds,
  };
}

async function fetchFullCatalog(accessToken: string): Promise<SquareCatalogResult> {
  const client = getClient(accessToken);
  const allObjects: CatalogObject[] = [];

  const page = await client.catalog.list();
  for await (const obj of page) {
    allObjects.push(obj);
  }

  return {
    categories: allObjects.filter((o) => o.type === "CATEGORY"),
    items: allObjects.filter((o) => o.type === "ITEM"),
    modifierLists: allObjects.filter((o) => o.type === "MODIFIER_LIST"),
    taxes: allObjects.filter((o) => o.type === "TAX"),
    images: allObjects.filter((o) => o.type === "IMAGE"),
  };
}

function mapToMenuModels(catalog: SquareCatalogResult): MappedCatalog {
  const stats = createEmptyCatalogSyncStats();

  const modifierListMap = new Map(
    catalog.modifierLists.map((ml) => [ml.id, ml])
  );

  // Build image URL map from IMAGE catalog objects
  const imageUrlMap = new Map<string, string>();
  for (const img of catalog.images) {
    if (img.type === "IMAGE" && img.imageData?.url) {
      imageUrlMap.set(img.id, img.imageData.url);
    }
  }

  const categories: MappedCategory[] = catalog.categories
    .filter((cat): cat is CatalogObject & { type: "CATEGORY" } => cat.type === "CATEGORY" && !!cat.id)
    .map((cat, index) => ({
      externalId: cat.id!,
      name: cat.categoryData?.name ?? "Unnamed",
      sortOrder: index,
    }));

  // Count categories with a parent (flattened hierarchy)
  stats.categoriesFlattened = catalog.categories.filter(
    (c) => c.type === "CATEGORY" && c.categoryData?.parentCategory
  ).length;

  const items: MappedMenuItem[] = [];

  for (const item of catalog.items) {
    if (item.type !== "ITEM") continue;
    const data = item.itemData;
    if (!data) continue;

    // Skip non-supported product types
    // Cast to string to future-proof against SDK type additions (e.g., FOOD_AND_BEV_ITEM)
    const productType: string = data.productType ?? "REGULAR";
    if (
      productType !== "REGULAR" &&
      productType !== "FOOD_AND_BEV" &&
      productType !== "FOOD_AND_BEV_ITEM"
    ) {
      stats.itemsSkipped++;
      stats.warnings.push(`Item ${item.id} skipped: product_type=${productType}`);
      continue;
    }

    // Extract all ITEM_VARIATION subtypes
    const allVariations = (data.variations ?? []).filter(
      (v): v is CatalogObject & { type: "ITEM_VARIATION" } => v.type === "ITEM_VARIATION"
    );

    // Filter out VARIABLE_PRICING variations
    const variations = allVariations.filter((v) => {
      if (v.itemVariationData?.pricingType === "VARIABLE_PRICING") {
        stats.warnings.push(`Variation ${v.id} skipped: VARIABLE_PRICING`);
        return false;
      }
      return true;
    });

    // Skip item if no valid variations remain
    if (variations.length === 0) {
      stats.itemsSkipped++;
      stats.warnings.push(`Item ${item.id} skipped: no valid variations`);
      continue;
    }

    // Count location_overrides
    for (const v of variations) {
      const overrides = v.itemVariationData?.locationOverrides ?? [];
      if (overrides.length > 0) {
        stats.locationOverridesDropped += overrides.length;
        stats.warnings.push(
          `Variation ${v.id} has ${overrides.length} location overrides (dropped)`
        );
      }
    }

    const categoryExternalIds = data.categoryId ? [data.categoryId] : [];

    // Sort variations by ordinal (stable fallback to array order)
    const sortedVariations = [...variations].sort((a, b) => {
      const ao = a.itemVariationData?.ordinal ?? 0;
      const bo = b.itemVariationData?.ordinal ?? 0;
      return ao - bo;
    });

    // Base price = min of all variation prices
    const variationPrices = sortedVariations.map((v) =>
      moneyToNumber(v.itemVariationData?.priceMoney?.amount)
    );
    const basePrice = variationPrices.length > 0 ? Math.min(...variationPrices) : 0;

    // Build modifier groups
    const groups: MappedModifierGroup[] = [];
    const variationMappings: MappedMenuItem["variationMappings"] = [];

    if (sortedVariations.length > 1) {
      const groupId = randomUUID();

      let firstDefaultAssigned = false;
      const options: MappedModifierOption[] = sortedVariations.map((v, i) => {
        const price = variationPrices[i];
        const optionId = randomUUID();
        const name = v.itemVariationData?.name ?? "Default";
        const isDefault = !firstDefaultAssigned && price === basePrice;
        if (isDefault) firstDefaultAssigned = true;

        variationMappings.push({
          externalId: v.id,
          name,
          groupId,
          optionId,
        });

        return {
          name,
          price: Math.round((price - basePrice) * 100) / 100,
          externalId: v.id,
          isDefault,
          ordinal: v.itemVariationData?.ordinal ?? i,
        };
      });

      groups.push({
        externalId: null,
        name: "Options",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options,
      });

      stats.variationsAsOptions++;
    } else {
      // sortedVariations.length === 1 (already guaranteed > 0 above)
      const v = sortedVariations[0];
      variationMappings.push({
        externalId: v.id,
        name: v.itemVariationData?.name ?? "Default",
        // no groupId/optionId on single-variation path
      });
    }

    // Modifier lists → additional modifier groups
    const modifierListInfo = data.modifierListInfo ?? [];
    let enabledModifierListCount = 0;
    for (const mlInfo of modifierListInfo) {
      if (mlInfo.enabled === false) continue;
      const ml = modifierListMap.get(mlInfo.modifierListId!);
      if (!ml || ml.type !== "MODIFIER_LIST") continue;
      const mlData = ml.modifierListData;
      if (!mlData) continue;

      enabledModifierListCount++;

      const isSingle = mlData.selectionType === "SINGLE";
      const min = Number(mlData.minSelectedModifiers ?? 0);
      const rawModifiers = (mlData.modifiers ?? []).filter(
        (mod): mod is CatalogObject & { type: "MODIFIER" } => mod.type === "MODIFIER"
      );
      const max = Number(
        mlData.maxSelectedModifiers ?? (isSingle ? 1 : rawModifiers.length)
      );
      const sortedMods = [...rawModifiers].sort(
        (a, b) => (a.modifierData?.ordinal ?? 0) - (b.modifierData?.ordinal ?? 0)
      );

      groups.push({
        externalId: mlInfo.modifierListId ?? null,
        name: mlData.name ?? "Options",
        required: min > 0,
        minSelect: min,
        maxSelect: max,
        options: sortedMods.map((mod, idx) => ({
          name: mod.modifierData?.name ?? "Option",
          price: moneyToNumber(mod.modifierData?.priceMoney?.amount),
          externalId: mod.id,
          isDefault: false,
          ordinal: mod.modifierData?.ordinal ?? idx,
        })),
      });
    }
    stats.modifierListsFlattened += enabledModifierListCount;

    // Resolve imageUrl from first imageId
    const imageIds = data.imageIds ?? [];
    const imageUrl = imageIds.length > 0
      ? imageUrlMap.get(imageIds[0]) ?? null
      : null;

    // Count extra images dropped
    if (imageIds.length > 1) {
      stats.imagesDropped += imageIds.length - 1;
    }

    items.push({
      externalId: item.id,
      name: data.name ?? "Unnamed",
      description: data.descriptionPlaintext ?? data.description ?? null,
      price: basePrice,
      imageUrl,
      categoryExternalIds,
      taxExternalIds: data.taxIds ?? [],
      modifierGroups: groups,
      variationMappings,
    });

    stats.itemsMapped++;
  }

  const taxes: MappedTax[] = catalog.taxes
    .filter((t): t is CatalogObject & { type: "TAX" } => t.type === "TAX" && t.taxData?.enabled !== false)
    .map((t) => ({
      externalId: t.id,
      name: t.taxData?.name ?? "Tax",
      percentage: parseFloat(t.taxData?.percentage ?? "0"),
      inclusionType: (t.taxData?.inclusionType === "INCLUSIVE" ? "inclusive" : "additive") as TaxInclusionType,
    }));

  // Count tax inclusion types
  for (const t of taxes) {
    if (t.inclusionType === "inclusive") stats.taxesInclusive++;
    else stats.taxesAdditive++;
  }

  return { categories, items, taxes, stats };
}

export const squareCatalogService = {
  fetchIncrementalCatalog,
  fetchFullCatalog,
  mapToMenuModels,
};

import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { squareConfig } from "./square.config";
import type { TaxInclusionType } from "@/services/menu/tax-config.types";

export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
  images: CatalogObject[];
}

export interface MappedModifierOption {
  name: string;
  price: number;
  externalId: string;
  isDefault: boolean;
  ordinal: number;
}

export interface MappedModifierGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MappedModifierOption[];
}

export interface MappedModifiers {
  groups: MappedModifierGroup[];
}

export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryExternalIds: string[];
  taxExternalIds: string[];
  modifiers: MappedModifiers | null;
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
}

export class SquareCatalogService {
  private getClient(accessToken: string): SquareClient {
    return new SquareClient({
      token: accessToken,
      environment:
        squareConfig.environment === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }

  async fetchFullCatalog(accessToken: string): Promise<SquareCatalogResult> {
    const client = this.getClient(accessToken);
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

  mapToMenuModels(catalog: SquareCatalogResult): MappedCatalog {
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

    const items: MappedMenuItem[] = catalog.items
      .filter((item): item is CatalogObject & { type: "ITEM" } => item.type === "ITEM")
      .map((item) => {
        const data = item.itemData!;
        const allVariations = data.variations ?? [];
        // Filter to only ITEM_VARIATION subtypes for type safety
        const variations = allVariations.filter(
          (v): v is CatalogObject & { type: "ITEM_VARIATION" } => v.type === "ITEM_VARIATION"
        );
        const categoryExternalIds = data.categoryId
          ? [data.categoryId]
          : [];

        // Sort variations by ordinal (stable fallback to array order)
        const sortedVariations = [...variations].sort((a, b) => {
          const ao = a.itemVariationData?.ordinal ?? 0;
          const bo = b.itemVariationData?.ordinal ?? 0;
          return ao - bo;
        });

        // Base price = min of all variation prices
        const variationPrices = sortedVariations.map((v) =>
          this.moneyToNumber(v.itemVariationData?.priceMoney?.amount)
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
            name: "Options",
            required: true,
            minSelect: 1,
            maxSelect: 1,
            options,
          });
        } else if (sortedVariations.length === 1) {
          const v = sortedVariations[0];
          variationMappings.push({
            externalId: v.id,
            name: v.itemVariationData?.name ?? "Default",
            // no groupId/optionId on single-variation path
          });
        }

        // Modifier lists → additional modifier groups
        const modifierListInfo = data.modifierListInfo ?? [];
        for (const mlInfo of modifierListInfo) {
          if (mlInfo.enabled === false) continue;
          const ml = modifierListMap.get(mlInfo.modifierListId!);
          if (!ml || ml.type !== "MODIFIER_LIST") continue;
          const mlData = ml.modifierListData;
          if (!mlData) continue;

          const isSingle = mlData.selectionType === "SINGLE";
          const min = mlData.minSelectedModifiers ?? 0;
          const rawModifiers = (mlData.modifiers ?? []).filter(
            (mod): mod is CatalogObject & { type: "MODIFIER" } => mod.type === "MODIFIER"
          );
          const max = mlData.maxSelectedModifiers ?? (isSingle ? 1 : rawModifiers.length);
          const sortedMods = [...rawModifiers].sort(
            (a, b) => (a.modifierData?.ordinal ?? 0) - (b.modifierData?.ordinal ?? 0)
          );

          groups.push({
            name: mlData.name ?? "Options",
            required: min > 0,
            minSelect: min,
            maxSelect: max,
            options: sortedMods.map((mod, idx) => ({
              name: mod.modifierData?.name ?? "Option",
              price: this.moneyToNumber(mod.modifierData?.priceMoney?.amount),
              externalId: mod.id,
              isDefault: false,
              ordinal: mod.modifierData?.ordinal ?? idx,
            })),
          });
        }

        // Resolve imageUrl from first imageId
        const imageIds = data.imageIds ?? [];
        const imageUrl = imageIds.length > 0
          ? imageUrlMap.get(imageIds[0]) ?? null
          : null;

        return {
          externalId: item.id,
          name: data.name ?? "Unnamed",
          description: data.description ?? null,
          price: basePrice,
          imageUrl,
          categoryExternalIds,
          taxExternalIds: data.taxIds ?? [],
          modifiers: groups.length > 0 ? { groups } : null,
          variationMappings,
        };
      });

    const taxes: MappedTax[] = catalog.taxes
      .filter((t): t is CatalogObject & { type: "TAX" } => t.type === "TAX" && t.taxData?.enabled !== false)
      .map((t) => ({
        externalId: t.id,
        name: t.taxData?.name ?? "Tax",
        percentage: parseFloat(t.taxData?.percentage ?? "0"),
        inclusionType: (t.taxData?.inclusionType === "INCLUSIVE" ? "inclusive" : "additive") as TaxInclusionType,
      }));

    return { categories, items, taxes };
  }

  private moneyToNumber(amountCents?: bigint | null): number {
    if (!amountCents) return 0;
    return Number(amountCents) / 100;
  }
}

export const squareCatalogService = new SquareCatalogService();

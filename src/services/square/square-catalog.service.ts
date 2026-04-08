import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { squareConfig } from "./square.config";

export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
}

export interface MappedModifierGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: {
    name: string;
    price: number;
    externalId: string;
  }[];
}

export interface MappedModifiers {
  groups: MappedModifierGroup[];
}

export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  categoryExternalIds: string[];
  modifiers: MappedModifiers | null;
  variationMappings: { externalId: string; name: string }[];
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
    };
  }

  mapToMenuModels(catalog: SquareCatalogResult): MappedCatalog {
    const modifierListMap = new Map(
      catalog.modifierLists.map((ml) => [ml.id, ml])
    );

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

        // Base price from first variation
        const basePrice = this.moneyToNumber(
          variations[0]?.itemVariationData?.priceMoney?.amount
        );

        // Build modifier groups
        const groups: MappedModifierGroup[] = [];

        // Multi-variation → size/variation modifier group
        if (variations.length > 1) {
          groups.push({
            name: "Size",
            required: true,
            minSelect: 1,
            maxSelect: 1,
            options: variations.map((v) => {
              const varPrice = this.moneyToNumber(
                v.itemVariationData?.priceMoney?.amount
              );
              return {
                name: v.itemVariationData?.name ?? "Default",
                price: Math.round((varPrice - basePrice) * 100) / 100,
                externalId: v.id,
              };
            }),
          });
        }

        // Modifier lists → additional modifier groups
        const modifierListInfo = data.modifierListInfo ?? [];
        for (const mlInfo of modifierListInfo) {
          if (!mlInfo.enabled) continue;
          const ml = modifierListMap.get(mlInfo.modifierListId!);
          if (!ml || ml.type !== "MODIFIER_LIST") continue;
          const mlData = ml.modifierListData;
          if (!mlData) continue;
          const isSingle = mlData.selectionType === "SINGLE";
          const allModifiers = mlData.modifiers ?? [];
          const modifiers = allModifiers.filter(
            (mod): mod is CatalogObject & { type: "MODIFIER" } => mod.type === "MODIFIER"
          );

          groups.push({
            name: mlData.name ?? "Options",
            required: false,
            minSelect: 0,
            maxSelect: isSingle ? 1 : (modifiers.length || 10),
            options: modifiers.map((mod) => ({
              name: mod.modifierData?.name ?? "Option",
              price: this.moneyToNumber(
                mod.modifierData?.priceMoney?.amount
              ),
              externalId: mod.id,
            })),
          });
        }

        return {
          externalId: item.id,
          name: data.name ?? "Unnamed",
          description: data.description ?? null,
          price: basePrice,
          categoryExternalIds,
          modifiers: groups.length > 0 ? { groups } : null,
          variationMappings: variations.map((v) => ({
            externalId: v.id,
            name: v.itemVariationData?.name ?? "Default",
          })),
        };
      });

    const taxes: MappedTax[] = catalog.taxes
      .filter((t): t is CatalogObject & { type: "TAX" } => t.type === "TAX" && t.taxData?.enabled !== false)
      .map((t) => ({
        externalId: t.id,
        name: t.taxData?.name ?? "Tax",
        percentage: parseFloat(t.taxData?.percentage ?? "0"),
      }));

    return { categories, items, taxes };
  }

  private moneyToNumber(amountCents?: bigint | null): number {
    if (!amountCents) return 0;
    return Number(amountCents) / 100;
  }
}

export const squareCatalogService = new SquareCatalogService();

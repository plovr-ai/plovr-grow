import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { squareConfig } from "./square.config";

// ==================== Types ====================

export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
  itemOptions: CatalogObject[];
  measurementUnits: CatalogObject[];
  images: CatalogObject[];
}

export type ModifierGroupSourceKind =
  | "MODIFIER_LIST"
  | "VARIATION"
  | "ITEM_OPTION";

export type ModifierGroupType = "single" | "multiple" | "text";

export interface MappedModifierOption {
  name: string;
  price: number;
  externalId: string;
  isDefault: boolean;
  ordinal: number | null;
  kitchenName: string | null;
  imageUrl: string | null;
  hiddenOnline: boolean;
}

export interface MappedModifierGroup {
  name: string;
  type: ModifierGroupType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  ordinal: number | null;
  allowQuantity: boolean;
  hiddenFromCustomer: boolean;
  internalName: string | null;
  sourceKind: ModifierGroupSourceKind;
  sourceExternalId: string | null;
  options: MappedModifierOption[];
}

export interface MappedModifiers {
  groups: MappedModifierGroup[];
}

export interface MappedVariationMapping {
  externalId: string;
  name: string;
  sku: string | null;
  upc: string | null;
  pricingType: "FIXED" | "VARIABLE";
  priceAmount: number;
  measurementUnitId: string | null;
  ordinal: number;
  sellable: boolean;
  stockable: boolean;
  itemOptionValues: { itemOptionId: string; itemOptionValueId: string }[];
}

export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  pricingType: "FIXED" | "VARIABLE";
  kitchenName: string | null;
  imageUrl: string | null;
  categoryExternalIds: string[];
  tags: string[];
  taxExternalIds: string[];
  modifiers: MappedModifiers | null;
  variationMappings: MappedVariationMapping[];
  sourceMetadata: Record<string, unknown>;
}

export interface MappedCategory {
  externalId: string;
  name: string;
  sortOrder: number;
  imageUrl: string | null;
  sourceMetadata: Record<string, unknown>;
}

export interface MappedTax {
  externalId: string;
  name: string;
  percentage: number;
  inclusionType: "ADDITIVE" | "INCLUSIVE";
  calculationPhase: "SUBTOTAL" | "TOTAL";
  appliesToCustomAmounts: boolean;
}

export interface MappedMeasurementUnit {
  externalId: string;
  name: string;
  abbreviation: string | null;
  precision: number;
  type: string;
}

export interface MappedCatalog {
  categories: MappedCategory[];
  items: MappedMenuItem[];
  taxes: MappedTax[];
  measurementUnits: MappedMeasurementUnit[];
}

// ==================== Service ====================

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
      itemOptions: allObjects.filter((o) => o.type === "ITEM_OPTION"),
      measurementUnits: allObjects.filter((o) => o.type === "MEASUREMENT_UNIT"),
      images: allObjects.filter((o) => o.type === "IMAGE"),
    };
  }

  mapToMenuModels(catalog: SquareCatalogResult): MappedCatalog {
    const imageMap = this.buildImageMap(catalog.images);
    const modifierListMap = new Map<string, CatalogObject>(
      catalog.modifierLists
        .filter((ml): ml is CatalogObject & { id: string } => !!ml.id)
        .map((ml) => [ml.id, ml]),
    );
    const itemOptionMap = new Map<string, CatalogObject>(
      catalog.itemOptions
        .filter((opt): opt is CatalogObject & { id: string } => !!opt.id)
        .map((opt) => [opt.id, opt]),
    );

    const categories = this.mapCategories(catalog.categories, imageMap);
    const measurementUnits = this.mapMeasurementUnits(catalog.measurementUnits);
    const taxes = this.mapTaxes(catalog.taxes);
    const items = this.mapItems(
      catalog.items,
      modifierListMap,
      itemOptionMap,
      imageMap,
    );

    return { categories, items, taxes, measurementUnits };
  }

  // ---------- Images ----------

  private buildImageMap(images: CatalogObject[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const img of images) {
      if (img.type !== "IMAGE" || !img.id) continue;
      const url = img.imageData?.url;
      if (url) map.set(img.id, url);
    }
    return map;
  }

  private resolveImages(
    imageMap: Map<string, string>,
    imageIds: string[] | null | undefined,
  ): string[] {
    if (!imageIds) return [];
    const urls: string[] = [];
    for (const id of imageIds) {
      const url = imageMap.get(id);
      if (url) urls.push(url);
    }
    return urls;
  }

  // ---------- Categories ----------

  private mapCategories(
    categories: CatalogObject[],
    imageMap: Map<string, string>,
  ): MappedCategory[] {
    return categories
      .filter(
        (cat): cat is CatalogObject & { type: "CATEGORY" } =>
          cat.type === "CATEGORY" && !!cat.id,
      )
      .map((cat, index) => {
        const data = cat.categoryData;
        const imageUrls = this.resolveImages(imageMap, data?.imageIds);
        const metadata: Record<string, unknown> = {};
        if (data?.categoryType) metadata.categoryType = data.categoryType;
        if (data?.parentCategory?.id)
          metadata.parentExternalId = data.parentCategory.id;
        if (data?.isTopLevel !== undefined && data.isTopLevel !== null)
          metadata.isTopLevel = data.isTopLevel;
        if (data?.channels && data.channels.length > 0)
          metadata.channels = data.channels;
        if (
          data?.onlineVisibility !== undefined &&
          data.onlineVisibility !== null
        )
          metadata.onlineVisibility = data.onlineVisibility;
        if (imageUrls.length > 1) metadata.imageUrls = imageUrls;

        return {
          externalId: cat.id!,
          name: data?.name ?? "Unnamed",
          sortOrder: index,
          imageUrl: imageUrls[0] ?? null,
          sourceMetadata: metadata,
        };
      });
  }

  // ---------- Measurement Units ----------

  private mapMeasurementUnits(units: CatalogObject[]): MappedMeasurementUnit[] {
    return units
      .filter(
        (u): u is CatalogObject & { type: "MEASUREMENT_UNIT" } =>
          u.type === "MEASUREMENT_UNIT" && !!u.id,
      )
      .map((u) => {
        const data = u.measurementUnitData;
        const mu = data?.measurementUnit;
        const customName = mu?.customUnit?.name;
        const customAbbr = mu?.customUnit?.abbreviation;
        return {
          externalId: u.id!,
          name: customName ?? mu?.type ?? "Unit",
          abbreviation: customAbbr ?? null,
          precision: data?.precision ?? 0,
          type: mu?.type ?? "GENERIC",
        };
      });
  }

  // ---------- Taxes ----------

  private mapTaxes(taxes: CatalogObject[]): MappedTax[] {
    return taxes
      .filter(
        (t): t is CatalogObject & { type: "TAX" } =>
          t.type === "TAX" && t.taxData?.enabled !== false,
      )
      .map((t) => {
        const data = t.taxData!;
        const inclusionType: MappedTax["inclusionType"] =
          data.inclusionType === "INCLUSIVE" ? "INCLUSIVE" : "ADDITIVE";
        const calculationPhase: MappedTax["calculationPhase"] =
          data.calculationPhase === "TAX_TOTAL_PHASE" ? "TOTAL" : "SUBTOTAL";
        return {
          externalId: t.id,
          name: data.name ?? "Tax",
          percentage: parseFloat(data.percentage ?? "0"),
          inclusionType,
          calculationPhase,
          appliesToCustomAmounts: data.appliesToCustomAmounts === true,
        };
      });
  }

  // ---------- Items ----------

  private mapItems(
    items: CatalogObject[],
    modifierListMap: Map<string, CatalogObject>,
    itemOptionMap: Map<string, CatalogObject>,
    imageMap: Map<string, string>,
  ): MappedMenuItem[] {
    const mapped: MappedMenuItem[] = [];

    for (const item of items) {
      if (item.type !== "ITEM") continue;
      const data = item.itemData;
      if (!data) continue;

      const productType = data.productType;
      if (
        productType &&
        productType !== "REGULAR" &&
        productType !== "FOOD_AND_BEV"
      ) {
        continue;
      }

      const allVariations = data.variations ?? [];
      const variations = allVariations.filter(
        (v): v is CatalogObject & { type: "ITEM_VARIATION" } =>
          v.type === "ITEM_VARIATION",
      );

      const sellableVariations = variations
        .filter((v) => v.itemVariationData?.sellable !== false)
        .sort(
          (a, b) =>
            (a.itemVariationData?.ordinal ?? 0) -
            (b.itemVariationData?.ordinal ?? 0),
        );

      const allVariable =
        sellableVariations.length > 0 &&
        sellableVariations.every(
          (v) => v.itemVariationData?.pricingType === "VARIABLE_PRICING",
        );
      const pricingType: "FIXED" | "VARIABLE" = allVariable
        ? "VARIABLE"
        : "FIXED";

      const basePrice =
        pricingType === "VARIABLE"
          ? 0
          : this.moneyToNumber(
              sellableVariations[0]?.itemVariationData?.priceMoney?.amount,
            );

      const categoryExternalIds: string[] = [];
      if (data.categories && data.categories.length > 0) {
        for (const c of data.categories) {
          if (c.id) categoryExternalIds.push(c.id);
        }
      } else if (data.categoryId) {
        categoryExternalIds.push(data.categoryId);
      }

      const groups: MappedModifierGroup[] = [];

      // ItemOption groups take priority over variation folding
      const itemOptionIds = (data.itemOptions ?? [])
        .map((io) => io.itemOptionId)
        .filter((id): id is string => !!id);

      if (itemOptionIds.length > 0) {
        for (const optId of itemOptionIds) {
          const optObj = itemOptionMap.get(optId);
          if (!optObj || optObj.type !== "ITEM_OPTION") continue;
          const optData = optObj.itemOptionData;
          if (!optData) continue;
          const values = (optData.values ?? []).filter(
            (v): v is CatalogObject & { type: "ITEM_OPTION_VAL" } =>
              v.type === "ITEM_OPTION_VAL",
          );
          groups.push({
            name: optData.displayName ?? optData.name ?? "Option",
            type: "single",
            required: true,
            minSelect: 1,
            maxSelect: 1,
            ordinal: null,
            allowQuantity: false,
            hiddenFromCustomer: false,
            internalName: optData.name ?? null,
            sourceKind: "ITEM_OPTION",
            sourceExternalId: optObj.id ?? null,
            options: values
              .sort(
                (a, b) =>
                  (a.itemOptionValueData?.ordinal ?? 0) -
                  (b.itemOptionValueData?.ordinal ?? 0),
              )
              .map((v) => ({
                name:
                  v.itemOptionValueData?.name ??
                  v.itemOptionValueData?.description ??
                  "Option",
                price: 0,
                externalId: v.id,
                isDefault: false,
                ordinal: v.itemOptionValueData?.ordinal ?? null,
                kitchenName: null,
                imageUrl: null,
                hiddenOnline: false,
              })),
          });
        }
      } else if (sellableVariations.length > 1) {
        // Multi-variation without item options → synthetic Size group
        groups.push({
          name: "Size",
          type: "single",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          ordinal: null,
          allowQuantity: false,
          hiddenFromCustomer: false,
          internalName: null,
          sourceKind: "VARIATION",
          sourceExternalId: null,
          options: sellableVariations.map((v) => {
            const vd = v.itemVariationData;
            const varPrice = this.moneyToNumber(vd?.priceMoney?.amount);
            return {
              name: vd?.name ?? "Default",
              price: Math.round((varPrice - basePrice) * 100) / 100,
              externalId: v.id,
              isDefault: false,
              ordinal: vd?.ordinal ?? null,
              kitchenName: vd?.kitchenName ?? null,
              imageUrl: this.resolveImages(imageMap, vd?.imageIds)[0] ?? null,
              hiddenOnline: false,
            };
          }),
        });
      }

      // Modifier list groups
      const modifierListInfo = (data.modifierListInfo ?? [])
        .slice()
        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));

      for (const mlInfo of modifierListInfo) {
        if (mlInfo.enabled === false) continue;
        const ml = modifierListMap.get(mlInfo.modifierListId);
        if (!ml || ml.type !== "MODIFIER_LIST") continue;
        const mlData = ml.modifierListData;
        if (!mlData) continue;

        const isText = mlData.modifierType === "TEXT";
        if (isText) {
          groups.push({
            name: mlData.name ?? "Text",
            type: "text",
            required: mlData.textRequired === true,
            minSelect: mlData.textRequired === true ? 1 : 0,
            maxSelect: 1,
            ordinal: mlInfo.ordinal ?? mlData.ordinal ?? null,
            allowQuantity: false,
            hiddenFromCustomer: mlData.hiddenFromCustomer === true,
            internalName: mlData.internalName ?? null,
            sourceKind: "MODIFIER_LIST",
            sourceExternalId: ml.id ?? null,
            options: [],
          });
          continue;
        }

        const allModifiers = mlData.modifiers ?? [];
        const modifiers = allModifiers
          .filter(
            (mod): mod is CatalogObject & { type: "MODIFIER" } =>
              mod.type === "MODIFIER",
          )
          .filter((mod) => mod.modifierData?.hiddenOnline !== true)
          .sort(
            (a, b) =>
              (a.modifierData?.ordinal ?? 0) -
              (b.modifierData?.ordinal ?? 0),
          );

        const { minSelect, maxSelect } = this.resolveSelectionLimits(
          mlData,
          mlInfo,
          modifiers.length,
        );
        const required = minSelect > 0;
        const groupType: ModifierGroupType =
          maxSelect === 1 ? "single" : "multiple";

        groups.push({
          name: mlData.name ?? "Options",
          type: groupType,
          required,
          minSelect,
          maxSelect,
          ordinal: mlInfo.ordinal ?? mlData.ordinal ?? null,
          allowQuantity: mlData.allowQuantities === true,
          hiddenFromCustomer: mlData.hiddenFromCustomer === true,
          internalName: mlData.internalName ?? null,
          sourceKind: "MODIFIER_LIST",
          sourceExternalId: ml.id ?? null,
          options: modifiers.map((mod) => {
            const md = mod.modifierData;
            return {
              name: md?.name ?? "Option",
              price: this.moneyToNumber(md?.priceMoney?.amount),
              externalId: mod.id,
              isDefault: md?.onByDefault === true,
              ordinal: md?.ordinal ?? null,
              kitchenName: md?.kitchenName ?? null,
              imageUrl: md?.imageId ? (imageMap.get(md.imageId) ?? null) : null,
              hiddenOnline: md?.hiddenOnline === true,
            };
          }),
        });
      }

      // Tags: dietary + alcoholic
      const tags: string[] = [];
      const fnb = data.foodAndBeverageDetails;
      if (fnb?.dietaryPreferences) {
        for (const dp of fnb.dietaryPreferences) {
          const n = dp.standardName ?? dp.customName;
          if (n) tags.push(String(n).toLowerCase());
        }
      }
      if (data.isAlcoholic === true) tags.push("alcoholic");

      const imageUrls = this.resolveImages(imageMap, data.imageIds);

      const metadata: Record<string, unknown> = {};
      if (data.abbreviation) metadata.abbreviation = data.abbreviation;
      if (data.labelColor) metadata.labelColor = data.labelColor;
      if (data.buyerFacingName) metadata.buyerFacingName = data.buyerFacingName;
      if (data.sortName) metadata.sortName = data.sortName;
      if (data.descriptionHtml) metadata.descriptionHtml = data.descriptionHtml;
      if (
        data.skipModifierScreen !== undefined &&
        data.skipModifierScreen !== null
      )
        metadata.skipModifierScreen = data.skipModifierScreen;
      if (data.isTaxable !== undefined && data.isTaxable !== null)
        metadata.isTaxable = data.isTaxable;
      if (productType) metadata.productType = productType;
      if (data.isArchived === true) metadata.isArchived = true;
      if (data.isAlcoholic === true) metadata.isAlcoholic = true;
      if (data.reportingCategory?.id)
        metadata.reportingCategoryExternalId = data.reportingCategory.id;
      if (imageUrls.length > 1) metadata.imageUrls = imageUrls;
      if (fnb?.ingredients && fnb.ingredients.length > 0)
        metadata.ingredients = fnb.ingredients.map(
          (i) => i.standardName ?? i.customName,
        );
      if (fnb?.calorieCount !== undefined && fnb.calorieCount !== null)
        metadata.calorieCount = fnb.calorieCount;
      if (itemOptionIds.length > 0) metadata.itemOptionIds = itemOptionIds;

      const variationMappings: MappedVariationMapping[] =
        sellableVariations.map((v) => {
          const vd = v.itemVariationData;
          return {
            externalId: v.id,
            name: vd?.name ?? "Default",
            sku: vd?.sku ?? null,
            upc: vd?.upc ?? null,
            pricingType:
              vd?.pricingType === "VARIABLE_PRICING" ? "VARIABLE" : "FIXED",
            priceAmount: this.moneyToNumber(vd?.priceMoney?.amount),
            measurementUnitId: vd?.measurementUnitId ?? null,
            ordinal: vd?.ordinal ?? 0,
            sellable: vd?.sellable !== false,
            stockable: vd?.stockable !== false,
            itemOptionValues: (vd?.itemOptionValues ?? [])
              .filter((iov) => iov.itemOptionId && iov.itemOptionValueId)
              .map((iov) => ({
                itemOptionId: iov.itemOptionId!,
                itemOptionValueId: iov.itemOptionValueId!,
              })),
          };
        });
      if (variationMappings.length > 0)
        metadata.variations = variationMappings;

      mapped.push({
        externalId: item.id,
        name: data.name ?? "Unnamed",
        description: data.descriptionPlaintext ?? data.description ?? null,
        price: basePrice,
        pricingType,
        kitchenName: data.kitchenName ?? null,
        imageUrl: imageUrls[0] ?? null,
        categoryExternalIds,
        tags,
        taxExternalIds: data.taxIds ?? [],
        modifiers: groups.length > 0 ? { groups } : null,
        variationMappings,
        sourceMetadata: metadata,
      });
    }

    return mapped;
  }

  private resolveSelectionLimits(
    mlData: {
      selectionType?: string | null;
      minSelectedModifiers?: bigint | null;
      maxSelectedModifiers?: bigint | null;
    },
    mlInfo: {
      minSelectedModifiers?: number | null;
      maxSelectedModifiers?: number | null;
    },
    modifierCount: number,
  ): { minSelect: number; maxSelect: number } {
    // Item-level override takes priority; -1 means "not set"
    const rawMin =
      mlInfo.minSelectedModifiers !== undefined &&
      mlInfo.minSelectedModifiers !== null &&
      mlInfo.minSelectedModifiers >= 0
        ? mlInfo.minSelectedModifiers
        : mlData.minSelectedModifiers !== undefined &&
            mlData.minSelectedModifiers !== null &&
            mlData.minSelectedModifiers >= BigInt(0)
          ? Number(mlData.minSelectedModifiers)
          : null;

    const rawMax =
      mlInfo.maxSelectedModifiers !== undefined &&
      mlInfo.maxSelectedModifiers !== null &&
      mlInfo.maxSelectedModifiers >= 0
        ? mlInfo.maxSelectedModifiers
        : mlData.maxSelectedModifiers !== undefined &&
            mlData.maxSelectedModifiers !== null &&
            mlData.maxSelectedModifiers >= BigInt(0)
          ? Number(mlData.maxSelectedModifiers)
          : null;

    if (rawMin === null && rawMax === null) {
      const isSingle = mlData.selectionType === "SINGLE";
      return {
        minSelect: 0,
        maxSelect: isSingle ? 1 : (modifierCount || 10),
      };
    }

    return {
      minSelect: rawMin ?? 0,
      maxSelect: rawMax ?? (modifierCount || 10),
    };
  }

  private moneyToNumber(amountCents?: bigint | null): number {
    if (!amountCents) return 0;
    return Number(amountCents) / 100;
  }
}

export const squareCatalogService = new SquareCatalogService();

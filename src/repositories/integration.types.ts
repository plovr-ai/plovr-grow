/**
 * Statistics collected during a Square catalog sync.
 * Persisted to IntegrationSyncRecord.stats (Json? column).
 */
export interface CatalogSyncStats {
  itemsMapped: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  variationsAsOptions: number;
  modifierListsFlattened: number;
  categoriesFlattened: number;
  locationOverridesDropped: number;
  imagesDropped: number;
  taxesInclusive: number;
  taxesAdditive: number;
  discountsSkipped: number;
  pricingRulesSkipped: number;
  warnings: string[];
}

export function createEmptyCatalogSyncStats(): CatalogSyncStats {
  return {
    itemsMapped: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    variationsAsOptions: 0,
    modifierListsFlattened: 0,
    categoriesFlattened: 0,
    locationOverridesDropped: 0,
    imagesDropped: 0,
    taxesInclusive: 0,
    taxesAdditive: 0,
    discountsSkipped: 0,
    pricingRulesSkipped: 0,
    warnings: [],
  };
}

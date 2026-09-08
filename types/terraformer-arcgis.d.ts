// @terraformer/arcgis ships no types for this version; declare just the
// narrow surface lib/veredas/boundaries.ts relies on (Esri JSON -> GeoJSON).
declare module "@terraformer/arcgis" {
  export function arcgisToGeoJSON(
    arcgis: { geometry?: unknown; attributes?: Record<string, unknown> } | Record<string, unknown>,
    idAttribute?: string,
  ): { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> | null }
}

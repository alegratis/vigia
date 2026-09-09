/**
 * Known misspellings of vereda names in the third-party sources this app
 * reads directly — Esri Colombia's "Veredas de Colombia" layer (see
 * lib/veredas/boundaries.ts) and ArcGIS Online's `AmenazaIncendios` layer
 * (see lib/incendios/client.ts) — corrected here rather than upstream,
 * since we don't control either source. Both call this from their own
 * fetch path so every vereda name in the app (population/hazard summaries,
 * fire-threat popups, the shared sidebar card) reads the same, correct
 * name and can be matched against each other reliably. Keyed by the
 * title-cased name.
 */
const VEREDA_NOMBRE_CORRECTIONS: Record<string, string> = {
  Comingales: "Cominales",
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

/** Title-cases a raw vereda name and corrects any known upstream misspelling (e.g. "COMINGALES" -> "Cominales"). */
export function normalizeVeredaNombre(raw: string): string {
  const titled = toTitleCase(raw)
  return VEREDA_NOMBRE_CORRECTIONS[titled] ?? titled
}

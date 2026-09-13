import type { WeatherGroup } from "./api-types"

/**
 * Inline SVG weather glyphs, as markup strings, for the surfaces that can't
 * render React components: Leaflet `divIcon` municipality markers and the
 * HTML strings passed to `bindPopup`/`bindTooltip` on the map. The stroke
 * defaults to `currentColor` so the marker container's `color` (a theme
 * token) drives it. The React report card below the map uses matching
 * lucide-react icons instead (see components/home/clima-panel-content.tsx),
 * so the same weather reads consistently in both places.
 *
 * Shapes mirror the feather/lucide weather set (cloud, cloud-rain,
 * cloud-lightning, sun, moon, …) rather than being freehand illustrations.
 */
function glyphInner(group: WeatherGroup, esDia: boolean): string {
  const cloud = `<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>`
  const cloudHigh = `<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/>`
  switch (group) {
    case "despejado":
      return esDia
        ? `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`
        : `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`
    case "parcial":
      return `<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`
    case "nublado":
      return cloud
    case "niebla":
      return `${cloud}<path d="M16 17H7"/><path d="M17 21H9"/>`
    case "llovizna":
      return `${cloud}<path d="M8 19v1"/><path d="M8 14v1"/><path d="M16 19v1"/><path d="M16 14v1"/><path d="M12 21v1"/><path d="M12 16v1"/>`
    case "lluvia":
      return `${cloud}<path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>`
    case "aguacero":
      return `${cloud}<path d="m9 14-1 6"/><path d="m13 14-1 6"/><path d="m17 14-1 6"/>`
    case "tormenta":
      return `${cloudHigh}<path d="m13 12-3 5h4l-3 5"/>`
    case "nieve":
      return `${cloud}<path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>`
    default:
      return cloud
  }
}

export function weatherGlyphSvg(
  group: WeatherGroup,
  opts?: { size?: number; color?: string; esDia?: boolean },
): string {
  const { size = 20, color = "currentColor", esDia = true } = opts ?? {}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphInner(group, esDia)}</svg>`
}

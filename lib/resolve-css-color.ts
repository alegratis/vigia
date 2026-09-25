/**
 * Resolves a CSS color value (e.g. "var(--chart-2)", which may be OKLCH) to
 * a plain `rgb(...)` string every rendering surface can consume.
 *
 * `getComputedStyle` alone isn't enough: modern browsers may serialize a
 * computed color back out in `lab()`/`oklab()` notation to preserve
 * wide-gamut precision. SVG (Leaflet) renders that fine since the browser's
 * own CSS engine handles it, but MapLibre GL parses paint-property color
 * strings with its own lightweight parser that only understands the legacy
 * `rgb`/`hsl`/hex syntax — a `lab()` string silently fails to parse there.
 * Painting the color onto a 1x1 canvas and reading the pixel back forces a
 * conversion through sRGB, which every consumer understands.
 */
export function resolveCssColor(value: string): string {
  if (typeof document === "undefined") return value
  const probe = document.createElement("span")
  probe.style.color = value
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  document.body.removeChild(probe)
  if (!computed) return value

  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return computed
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a / 255})`
}

/**
 * Resolves a CSS color value (e.g. "var(--chart-2)", which may be OKLCH) to
 * a computed color string the browser can hand to non-CSS rendering
 * surfaces like Leaflet's SVG path attributes or a <canvas> context.
 */
export function resolveCssColor(value: string): string {
  if (typeof document === "undefined") return value
  const probe = document.createElement("span")
  probe.style.color = value
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  document.body.removeChild(probe)
  return resolved || value
}

const POPUP_WIDTH = 820
const POPUP_HEIGHT = 760

/**
 * Opens a chromeless popup window for informative, low-priority content
 * (currently the demografía and exposición panels) instead of navigating to
 * it in-app. That content is a standalone reference view with little
 * bearing on the hazard workspace, so a full route change away from the
 * live map — losing whatever the user had open — was a disproportionate
 * interruption. All browser UI (menu bar, toolbar, address bar, status bar)
 * is stripped via the window features below, leaving only the content
 * itself, and the shared window name means clicking the link again focuses
 * the existing popup instead of spawning duplicates.
 *
 * `size` lets a caller ask for a bigger default than the standard
 * 820x760 — the exposición popup overlays a map legend (bottom-left) and a
 * hazard toggle list (top-left) that need more vertical room than the
 * default height gives them, or the legend ends up covering the toggles.
 * Either dimension is clamped to the available screen so the window never
 * opens larger than the display.
 */
export function openInfoPopup(url: string, name: string, size?: { width?: number; height?: number }) {
  const width = Math.min(size?.width ?? POPUP_WIDTH, window.screen.availWidth)
  const height = Math.min(size?.height ?? POPUP_HEIGHT, window.screen.availHeight)
  const left = Math.max(window.screenX + (window.outerWidth - width) / 2, 0)
  const top = Math.max(window.screenY + (window.outerHeight - height) / 2, 0)
  const popup = window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
  )
  popup?.focus()
}

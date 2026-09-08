const POPUP_WIDTH = 820
const POPUP_HEIGHT = 760

/**
 * Opens a chromeless popup window for informative, low-priority content
 * (currently just the demografía panel) instead of navigating to it in-app.
 * That panel is a standalone reference view with little bearing on the
 * hazard workspace, so a full route change away from the live map — losing
 * whatever the user had open — was a disproportionate interruption. All
 * browser UI (menu bar, toolbar, address bar, status bar) is stripped via
 * the window features below, leaving only the content itself, and the
 * shared window name means clicking the link again focuses the existing
 * popup instead of spawning duplicates.
 */
export function openInfoPopup(url: string, name: string) {
  const left = Math.max(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2, 0)
  const top = Math.max(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2, 0)
  const popup = window.open(
    url,
    name,
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
  )
  popup?.focus()
}

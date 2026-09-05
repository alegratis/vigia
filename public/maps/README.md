# qgis2web map exports

**Inundaciones does not use this folder.** GEOGLOWS already publishes its own
live, open, CORS-enabled map layer (Esri Living Atlas'
`GlobalWaterModel_Medium` feed), so the flood page renders that directly —
see `components/maps/geoglows-live-map.tsx`. There's no reason to re-publish
a static copy of a map that already exists and updates on its own.

For hazards where no equivalent open live map service exists, each section
embeds a static Leaflet map exported from QGIS with the **qgis2web** plugin.
Export with the Leaflet engine, then copy the entire output folder's contents
(including `index.html`, `main.js`, `data/`, `legend/`, etc.) into the
matching subfolder here — **do not rename any of the exported files**, only
place them inside the right folder:

- `public/maps/incendios/` → `public/maps/incendios/index.html`
- `public/maps/deslizamientos/` → `public/maps/deslizamientos/index.html`

The site checks for `index.html` at each of these paths and embeds it in an
iframe automatically once it exists; until then, the page shows a "mapa aún
no publicado" placeholder.

## Live demographics bridge (optional but recommended)

To make the "Población en el encuadre actual" panel update as someone pans
or zooms the embedded map, open the exported `index.html` and paste the
bridge snippet shown in the in-app "Cómo publicar este mapa desde QGIS"
guide (visible on each hazard page) right before `</body>`. It posts the
current Leaflet bounds to the parent page on every `moveend`/`zoomend`.
qgis2web names the global Leaflet map variable `map` by default — if a
future plugin version changes that, update the variable name in the
snippet accordingly.

In development, files placed here are served immediately with no restart.
In production, redeploy the site after adding or updating a map export.

"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  AttributionControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"
import { setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { toast } from "sonner"
import { LAYER_DEFINITIONS, LAYER_ORDER, type LabVeredaFeature, type LabVeredasFeatureCollection, type LayerKey } from "@/lib/laboratorio/layers"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreMapStyle } from "@/lib/maps/maplibre-basemap-style"
import { useThemeSyncedBasemap } from "@/lib/maps/use-theme-synced-basemap"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { VeredaPopupContent } from "@/components/maps/vereda-popup-content"
import { isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"

// Turbopack rewrites maplibre-gl's internal `import.meta.url`-based worker
// resolution into a blob URL, which breaks the worker's own relative asset
// resolution. Pointing at a self-hosted copy of the worker script sidesteps
// that bundler-specific failure mode (same fix as every other MapLibre map).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}

// Same AOI framing as every other MapLibre hazard map in the app (see
// deslizamientos-live-map.tsx) — `[[west, south], [east, north]]`.
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

const GRAY_FILL = "#9ca3af"

interface LabMapProps {
  veredas: LabVeredasFeatureCollection | null
  activeLayers: LayerKey[]
  /** A disabled layer currently hovered in the rail — rendered dimmed as a preview, doesn't count toward the 3-layer limit. */
  previewLayer: LayerKey | null
  layerOpacity: Record<LayerKey, number>
  municipio: string | null
  is3D: boolean
  onToggle3D: () => void
  onVeredaSelect: (feature: LabVeredaFeature | null) => void
}

/**
 * Single shared `<Map>` rendering up to 3 hazard fills (plus a hover
 * preview) over the same vereda geometry — the core of the laboratorio
 * prototype. One `Source`+`Layer` pair per hazard layer rather than a
 * single merged source, so each layer's paint (color ramp, opacity) stays
 * fully independent and toggling one never requires recomputing the
 * others' GeoJSON.
 */
export function LabMap({
  veredas,
  activeLayers,
  previewLayer,
  layerOpacity,
  municipio,
  is3D,
  onToggle3D,
  onVeredaSelect,
}: LabMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [basemap, setBasemap] = useThemeSyncedBasemap()
  const [popupInfo, setPopupInfo] = useState<{ feature: LabVeredaFeature; layer: LayerKey } | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])

  const geojsonForLayer = useCallback(
    (layer: LayerKey): LabVeredasFeatureCollection | null => {
      if (!veredas) return null
      const def = LAYER_DEFINITIONS[layer]
      return {
        type: "FeatureCollection",
        features: veredas.features.map((feature) => {
          const inMunicipio = !municipio || isMunicipioActive(feature.properties.municipio, [municipio])
          const level = feature.properties[def.levelProperty] as string | null
          const style = level ? def.levelStyles[level] : undefined
          const color = inMunicipio && style ? resolveCssColor(style.colorToken) : resolveCssColor(GRAY_FILL)
          return {
            ...feature,
            properties: {
              ...feature.properties,
              __fillColor: color,
              __inMunicipio: inMunicipio,
              __hasData: Boolean(style),
            },
          }
        }),
      }
    },
    [veredas, municipio],
  )

  const handleToggle3D = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) {
      onToggle3D()
      return
    }
    const next = !is3D
    setTransitioning(true)
    map.once("moveend", () => {
      setTransitioning(false)
      onToggle3D()
      toast(next ? "Vista 3D activada" : "Vista 2D activada")
    })
    map.easeTo({
      pitch: next ? 60 : 0,
      bearing: next ? 30 : 0,
      duration: 2000,
    })
  }, [is3D, onToggle3D])

  const flyToMunicipio = useCallback(
    (name: string | null) => {
      const map = mapRef.current?.getMap()
      if (!map || !veredas) return
      if (!name) {
        map.fitBounds(AOI_BOUNDS, { padding: 40, duration: 1500 })
        return
      }
      const bounds = boundsForActiveMunicipios(veredas, [name])
      if (!bounds) return
      const [[south, west], [north, east]] = bounds as [[number, number], [number, number]]
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 60, duration: 1800 },
      )
    },
    [veredas],
  )

  const interactiveLayerIds = useMemo(
    () => [...activeLayers].reverse().map((layer) => `lab-${layer}-fill`),
    [activeLayers],
  )

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature || !feature.properties) {
        setPopupInfo(null)
        onVeredaSelect(null)
        return
      }
      const layerId = feature.layer?.id ?? ""
      const layer = LAYER_ORDER.find((key) => `lab-${key}-fill` === layerId)
      const veredaFeature = veredas?.features.find(
        (f) => f.properties.codigoVereda === feature.properties?.codigoVereda,
      )
      if (!veredaFeature || !layer) return
      setPopupInfo({ feature: veredaFeature, layer })
      onVeredaSelect(veredaFeature)
    },
    [veredas, onVeredaSelect],
  )

  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ bounds: AOI_BOUNDS, fitBoundsOptions: { padding: 40 } }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={handleMapClick}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl position="bottom-right" compact />
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={handleToggle3D} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />

        {!is3D &&
          activeLayers.map((layer) => {
            const data = geojsonForLayer(layer)
            if (!data) return null
            return (
              <Source key={layer} id={`lab-${layer}-source`} type="geojson" data={data}>
                <Layer
                  id={`lab-${layer}-fill`}
                  type="fill"
                  paint={{
                    "fill-color": ["get", "__fillColor"],
                    "fill-opacity": layerOpacity[layer] ?? 0.55,
                  }}
                />
                <Layer
                  id={`lab-${layer}-line`}
                  type="line"
                  paint={{ "line-color": "rgba(0,0,0,0.25)", "line-width": 0.5 }}
                />
              </Source>
            )
          })}

        {(() => {
          const previewData = !is3D && previewLayer && !activeLayers.includes(previewLayer)
            ? geojsonForLayer(previewLayer)
            : null
          if (!previewData || !previewLayer) return null
          return (
            <Source id={`lab-preview-${previewLayer}-source`} type="geojson" data={previewData}>
              <Layer
                id={`lab-preview-${previewLayer}-fill`}
                type="fill"
                paint={{ "fill-color": ["get", "__fillColor"], "fill-opacity": 0.35 }}
              />
            </Source>
          )
        })()}

        {popupInfo && (
          <Popup
            key={popupInfo.feature.properties.codigoVereda}
            longitude={centroidOf(popupInfo.feature)[0]}
            latitude={centroidOf(popupInfo.feature)[1]}
            onClose={() => {
              setPopupInfo(null)
              onVeredaSelect(null)
            }}
            closeOnClick={false}
            maxWidth="260px"
          >
            <VeredaPopupContent feature={popupInfo.feature} hazardKind={popupInfo.layer} colored />
          </Popup>
        )}
      </Map>

      {transitioning && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/30 backdrop-blur-sm">
          <p className="rounded-full bg-card/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
            Generando vista 3D…
          </p>
        </div>
      )}

      {/* Exposed for the workspace's municipio selector via a DOM-free ref callback pattern would be cleaner,
          but `flyToMunicipio` needs the live MapRef — the workspace calls back into this via the `municipio`
          prop change below instead of a hoisted imperative handle, keeping this component's public surface
          to plain props. */}
      <MunicipioFlyToEffect municipio={municipio} onFly={flyToMunicipio} />
    </div>
  )
}

/** Fires `onFly` whenever `municipio` changes, without exposing the map's imperative handle to the parent. */
function MunicipioFlyToEffect({ municipio, onFly }: { municipio: string | null; onFly: (name: string | null) => void }) {
  const previous = useRef<string | null | undefined>(undefined)
  if (previous.current !== municipio) {
    previous.current = municipio
    // Scheduled on the next tick so it runs after the map has (re)rendered its current sources.
    queueMicrotask(() => onFly(municipio))
  }
  return null
}

function centroidOf(feature: LabVeredaFeature): [number, number] {
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const polygon of feature.geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        sumLon += lon
        sumLat += lat
        count++
      }
    }
  }
  return count > 0 ? [sumLon / count, sumLat / count] : [-75.93, 4.27]
}

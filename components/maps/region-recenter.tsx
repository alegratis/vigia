"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"

/**
 * Drop-in child of any hazard map's <MapContainer>. Reframes the map to the
 * selected municipio (Sevilla by default), which — since the viewport-driven
 * layers (FIRMS hotspots, precipitation, clima, OSM infrastructure, live
 * population) refetch from the map bounds — pulls those models to the area
 * automatically.
 */
export function RegionRecenter() {
  const map = useMap()
  const { region } = useSelectedPlace()

  useEffect(() => {
    map.fitBounds(region.bounds as LatLngBoundsExpression)
  }, [map, region])

  return null
}

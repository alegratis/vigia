"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"

/**
 * Drop-in child of any hazard map's <MapContainer>. When a specific
 * municipio is selected it reframes the map to that municipio, which — since
 * the viewport-driven layers (FIRMS hotspots, precipitation, clima, OSM
 * infrastructure, live population) refetch from the map bounds — pulls those
 * models to the new area automatically. For the study-area default it does
 * nothing, leaving each map's own hand-tuned initial framing intact.
 */
export function RegionRecenter() {
  const map = useMap()
  const { region } = useSelectedPlace()

  useEffect(() => {
    if (region.isStudyArea) return
    map.fitBounds(region.bounds as LatLngBoundsExpression)
  }, [map, region])

  return null
}

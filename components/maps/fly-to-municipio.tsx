"use client"

import { useEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"

interface FlyToMunicipioProps {
  veredas: Parameters<typeof boundsForActiveMunicipios>[0]
  activeMunicipios: string[]
}

/**
 * Smoothly flies the map to frame whichever municipios are toggled on in
 * the shared rail's "Municipios" section, instead of leaving the view
 * static after a toggle click. Skips the very first render (the map
 * already opens framed on the full AOI via `bounds` on `MapContainer`;
 * flying on mount would just replay that same shot) and skips an
 * "every municipio active" selection, since flying to the whole AOI on
 * every-on isn't a meaningful transition.
 */
export function FlyToMunicipio({ veredas, activeMunicipios }: FlyToMunicipioProps) {
  const map = useMap()
  const isFirstRender = useRef(true)
  const previousKey = useRef(activeMunicipios.join("|"))

  useEffect(() => {
    const key = activeMunicipios.join("|")
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousKey.current = key
      return
    }
    if (key === previousKey.current) return
    previousKey.current = key

    const bounds = boundsForActiveMunicipios(veredas, activeMunicipios)
    if (!bounds) return
    map.flyToBounds(bounds, { padding: [48, 48], duration: 0.9, maxZoom: 14 })
  }, [map, veredas, activeMunicipios])

  return null
}

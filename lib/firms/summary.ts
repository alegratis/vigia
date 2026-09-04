import type { FireDetection } from "./client"
import { REFERENCE_POINTS } from "./area"

export type FireSummary = {
  total: number
  highConfidence: number
  totalFrp: number
  maxFrp: number
  latestAt: string | null
  byMunicipality: { name: string; count: number; highConfidence: number }[]
  byConfidence: { high: number; nominal: number; low: number; unknown: number }
}

export function summarize(detections: FireDetection[]): FireSummary {
  const byMunMap = new Map<string, { count: number; highConfidence: number }>()
  for (const p of REFERENCE_POINTS) {
    byMunMap.set(p.name, { count: 0, highConfidence: 0 })
  }

  const byConfidence = { high: 0, nominal: 0, low: 0, unknown: 0 }
  let totalFrp = 0
  let maxFrp = 0
  let highConfidence = 0
  let latestAt: string | null = null

  for (const d of detections) {
    totalFrp += d.frp
    if (d.frp > maxFrp) maxFrp = d.frp
    byConfidence[d.confidence] += 1
    if (d.confidence === "high") highConfidence += 1
    if (latestAt === null || d.acquiredAt > latestAt) latestAt = d.acquiredAt

    const mun = byMunMap.get(d.nearest.name)
    if (mun) {
      mun.count += 1
      if (d.confidence === "high") mun.highConfidence += 1
    }
  }

  const byMunicipality = REFERENCE_POINTS.map((p) => ({
    name: p.name,
    count: byMunMap.get(p.name)?.count ?? 0,
    highConfidence: byMunMap.get(p.name)?.highConfidence ?? 0,
  })).sort((a, b) => b.count - a.count)

  return {
    total: detections.length,
    highConfidence,
    totalFrp: Math.round(totalFrp * 10) / 10,
    maxFrp: Math.round(maxFrp * 10) / 10,
    latestAt,
    byMunicipality,
    byConfidence,
  }
}

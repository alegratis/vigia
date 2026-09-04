"use client"

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatDate, formatDateTime, formatFlow, levelStyle } from "@/lib/flood-ui"
import type { FloodPoint, FloodLevelKey } from "@/lib/geoglows/flood"
import type { ReturnPeriodYears } from "@/lib/geoglows/gumbel"

const chartConfig = {
  median: { label: "Caudal previsto", color: "var(--chart-1)" },
  band: { label: "Incertidumbre", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Return-period reference lines to draw, from least to most severe. */
const THRESHOLD_LEVELS: { rp: ReturnPeriodYears; level: FloodLevelKey }[] = [
  { rp: 2, level: "vigilancia" },
  { rp: 5, level: "alerta" },
  { rp: 10, level: "alerta_alta" },
  { rp: 25, level: "emergencia" },
  { rp: 50, level: "extrema" },
]

interface ChartRow {
  datetime: string
  median: number
  band: [number, number]
}

export function Hydrograph({
  series,
  thresholds,
}: {
  series: FloodPoint[]
  thresholds: Record<string, number>
}) {
  const data: ChartRow[] = series.map((p) => ({
    datetime: p.datetime,
    median: p.median,
    band: [p.lower, p.upper],
  }))

  const maxUpper = Math.max(...series.map((p) => p.upper))
  // Only show thresholds within/near the plotted range so the axis isn't
  // squashed by a distant, never-approached 50-year line.
  const visibleThresholds = THRESHOLD_LEVELS.filter(({ rp }) => {
    const t = thresholds[String(rp)]
    return t != null && t <= maxUpper * 1.15
  })

  const topThreshold = visibleThresholds.length
    ? Math.max(...visibleThresholds.map((t) => thresholds[String(t.rp)]))
    : 0
  const yMax = Math.max(maxUpper, topThreshold) * 1.1

  return (
    <ChartContainer config={chartConfig} className="h-[420px] w-full">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="datetime"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={48}
          tickFormatter={formatDate}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          domain={[0, Math.ceil(yMax)]}
        />

        <Area
          dataKey="band"
          stroke="none"
          fill="var(--color-band)"
          fillOpacity={0.15}
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          dataKey="median"
          type="monotone"
          stroke="var(--color-median)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        {visibleThresholds.map(({ rp, level }) => {
          const style = levelStyle(level)
          return (
            <ReferenceLine
              key={rp}
              y={thresholds[String(rp)]}
              stroke={style.color}
              strokeDasharray="5 4"
              strokeOpacity={0.85}
              label={{
                value: `${style.label} · ${rp} a`,
                position: "insideTopRight",
                fill: style.color,
                fontSize: 10,
              }}
            />
          )
        })}

        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null
            const row = payload[0].payload as ChartRow
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="mb-1 font-medium text-popover-foreground">
                  {formatDateTime(row.datetime)}
                </p>
                <p className="text-muted-foreground">
                  Mediana:{" "}
                  <span className="font-medium text-popover-foreground">
                    {formatFlow(row.median)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Rango: {formatFlow(row.band[0])} – {formatFlow(row.band[1])}
                </p>
              </div>
            )
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

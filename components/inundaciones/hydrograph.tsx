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
  className = "h-[420px] w-full",
  compact = false,
}: {
  series: FloodPoint[]
  thresholds: Record<string, number>
  /** Container height/width classes; defaults to the full-size detail view. */
  className?: string
  /** Hides axis ticks and threshold labels for small, glanceable summary cards. */
  compact?: boolean
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
    <ChartContainer config={chartConfig} className={className}>
      <ComposedChart
        data={data}
        margin={compact ? { top: 4, right: 4, bottom: 0, left: 4 } : { top: 8, right: 12, bottom: 8, left: 4 }}
      >
        {!compact && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        {!compact && (
          <XAxis
            dataKey="datetime"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={48}
            tickFormatter={formatDate}
          />
        )}
        <YAxis
          hide={compact}
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
              label={
                compact
                  ? undefined
                  : {
                      value: `${style.label} · ${rp} a`,
                      position: "insideTopRight",
                      fill: style.color,
                      fontSize: 10,
                    }
              }
            />
          )
        })}

        {!compact && (
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const row = payload[0].payload as ChartRow
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1.5 font-medium text-popover-foreground">
                    {formatDateTime(row.datetime)}
                  </p>
                  <div className="grid gap-1">
                    <TooltipRow
                      swatchClassName="rounded-full"
                      color="var(--color-median)"
                      label="Mediana"
                      value={formatFlow(row.median)}
                    />
                    <TooltipRow
                      color="var(--color-band)"
                      opacity={0.6}
                      label="Máximo"
                      value={formatFlow(row.band[1])}
                    />
                    <TooltipRow
                      color="var(--color-band)"
                      opacity={0.3}
                      label="Mínimo"
                      value={formatFlow(row.band[0])}
                    />
                  </div>
                </div>
              )
            }}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}

/** One labeled value in the hydrograph's hover tooltip, with a color swatch matching the chart series it reads from. */
function TooltipRow({
  color,
  opacity = 1,
  label,
  value,
  swatchClassName = "rounded-[2px]",
}: {
  color: string
  opacity?: number
  label: string
  value: string
  swatchClassName?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`size-2.5 shrink-0 ${swatchClassName}`}
        style={{ backgroundColor: color, opacity }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-auto font-medium text-popover-foreground">{value}</span>
    </div>
  )
}

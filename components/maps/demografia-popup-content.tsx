import { MANZANA_FIELD_LABEL, type DemografiaIndicator, type ManzanaField } from "@/lib/laboratorio/use-demografia-experience"

interface DemografiaPopupContentProps {
  indicator: DemografiaIndicator
  properties: Record<string, unknown>
}

/**
 * Popup body for a clicked demografía column — reads only the `__kind`-tagged
 * properties `use-demografia-experience.ts` already stamps onto each feature
 * (`__color`, `combinedLevel`, `ipm`, the three manzana counts), so it stays
 * in sync automatically whenever that hook's indicator math changes.
 */
export function DemografiaPopupContent({ indicator, properties }: DemografiaPopupContentProps) {
  const name = (properties.nombre as string | undefined) ?? (properties.codigoManzana as string | undefined) ?? "Zona"

  if (indicator === "vulnerabilidad") {
    const level = properties.combinedLevel as string | undefined
    const score = properties.combinedScore as number | undefined
    return (
      <div className="flex flex-col gap-1 text-sm">
        <strong className="text-foreground">{name}</strong>
        <span className="text-muted-foreground">Índice de vulnerabilidad compuesto</span>
        <span className="font-medium" style={{ color: properties.__color as string }}>
          {level ?? "Sin dato"}
          {score != null ? ` · ${score.toFixed(2)}` : ""}
        </span>
      </div>
    )
  }

  if (indicator === "pobreza") {
    const ipm = properties.ipm as number | undefined
    return (
      <div className="flex flex-col gap-1 text-sm">
        <strong className="text-foreground">{name}</strong>
        <span className="text-muted-foreground">Índice de pobreza multidimensional</span>
        <span className="font-medium" style={{ color: properties.__color as string }}>
          {ipm != null ? `${ipm.toFixed(1)}%` : "Sin dato"}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <strong className="text-foreground">{name}</strong>
      {(Object.keys(MANZANA_FIELD_LABEL) as ManzanaField[]).map((field) => (
        <span key={field} className="text-muted-foreground">
          {MANZANA_FIELD_LABEL[field]}: <span className="font-medium text-foreground">{String(properties[field] ?? "—")}</span>
        </span>
      ))}
    </div>
  )
}

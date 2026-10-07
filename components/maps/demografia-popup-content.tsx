import { MANZANA_FIELD_LABEL, type DemografiaIndicator, type ManzanaField } from "@/lib/laboratorio/use-demografia-experience"
import type { BarrioProperties } from "@/lib/barrios/api-types"

interface DemografiaPopupContentProps {
  indicator: DemografiaIndicator
  properties: Record<string, unknown>
  /** The SIRD barrio polygon containing the clicked point, when one exists (Sevilla only). */
  barrio?: BarrioProperties | null
}

const IVS_WHAT =
  "El IVS mide la magnitud de privación social acumulada: vivienda, servicios públicos, inasistencia escolar y dependencia económica del hogar."

function Explainer({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-border pt-1.5 text-xs leading-snug text-muted-foreground">{children}</p>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{children}</span>
    </p>
  )
}

function BarrioHazardRows({ barrio }: { barrio: BarrioProperties }) {
  return (
    <>
      {barrio.frecuenciaInundacion && <Row label="Frecuencia de inundación">{barrio.frecuenciaInundacion}</Row>}
      {barrio.frecuenciaMovimientoMasa && (
        <Row label="Frecuencia de movimiento en masa">{barrio.frecuenciaMovimientoMasa}</Row>
      )}
    </>
  )
}

/**
 * Popup body for a clicked demografía feature. Header is always the barrio
 * (SIRD polygon the click falls in, else the manzana's nearest OSM place
 * name) plus municipio, mirroring the production map's popups.
 */
export function DemografiaPopupContent({ indicator, properties, barrio }: DemografiaPopupContentProps) {
  const municipio = properties.municipio as string | undefined

  if (properties.__kind === "barrio") {
    const props = properties as unknown as BarrioProperties
    return (
      <div className="flex w-56 flex-col gap-1 text-sm">
        <p className="font-medium text-foreground">
          {props.nombre} <span className="text-muted-foreground">({props.municipio})</span>
        </p>
        <BarrioHazardRows barrio={props} />
        <Explainer>Límite de barrio del Dashboard SIRD Sevilla (post-sismo), referencia únicamente.</Explainer>
      </div>
    )
  }

  const barrioName = barrio?.nombre ?? (properties.barrio as string | null | undefined) ?? null
  const place = barrioName ? `${barrioName}${municipio ? ` · ${municipio}` : ""}` : (municipio ?? "Zona")

  if (indicator === "vulnerabilidad") {
    const level = properties.combinedLevel as string | undefined
    const ivs = properties.ivs as number | undefined
    const compound = properties.compoundLevel as string | null | undefined
    const rural = properties.codigoManzana == null
    return (
      <div className="flex w-64 flex-col gap-1 text-sm">
        <p className="font-medium text-foreground">
          {rural ? ((properties.nombre as string | undefined) ?? place) : place}
        </p>
        <Row label="Vulnerabilidad compuesta">
          <span style={{ color: properties.__color as string }}>{level ?? "Sin dato"}</span>
        </Row>
        <p className="text-muted-foreground">
          IVS (por manzana): <span className="font-medium text-foreground">{ivs != null ? ivs.toFixed(2) : "—"}</span>
          {" · "}
          Amenaza del casco urbano: <span className="font-medium text-foreground">{compound ?? "—"}</span>
        </p>
        {barrio && <BarrioHazardRows barrio={barrio} />}
        <Explainer>{IVS_WHAT}</Explainer>
      </div>
    )
  }

  if (indicator === "pobreza") {
    const ipm = properties.ipm as number | undefined
    const categoria = properties.categoria as string | undefined
    return (
      <div className="flex w-56 flex-col gap-1 text-sm">
        <p className="font-medium text-foreground">{place}</p>
        <Row label="IPM">
          <span style={{ color: properties.__color as string }}>{ipm != null ? `${ipm.toFixed(1)}%` : "Sin dato"}</span>
        </Row>
        {categoria && <Row label="Categoría">{categoria}</Row>}
        {barrio && <BarrioHazardRows barrio={barrio} />}
        <Explainer>
          Índice de Pobreza Multidimensional (IPM) del DANE: porcentaje de privaciones (vivienda, servicios, educación,
          salud) que sufren los hogares.
        </Explainer>
      </div>
    )
  }

  return (
    <div className="flex w-56 flex-col gap-1 text-sm">
      <p className="font-medium text-foreground">{place}</p>
      {(Object.keys(MANZANA_FIELD_LABEL) as ManzanaField[]).map((field) => (
        <Row key={field} label={MANZANA_FIELD_LABEL[field]}>
          {typeof properties[field] === "number" ? (properties[field] as number).toLocaleString("es-CO") : "—"}
        </Row>
      ))}
      {barrio && <BarrioHazardRows barrio={barrio} />}
    </div>
  )
}
